const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const crypto   = require('crypto');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// ── Static files ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── In-memory state ───────────────────────────────────────────────────────
// rooms: Map<code, Room>
// Room { code, players:[{id,symbol}], board, currentTurn, gameOver, rematchVotes:Set }
const rooms = new Map();

// queue: [{id, socket}]  — waiting for random match
const queue = [];

// ── Helpers ────────────────────────────────────────────────────────────────
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function freshRoom(code) {
  return { code, players: [], board: Array(9).fill(null), currentTurn: 'X', gameOver: false, rematchVotes: new Set() };
}

function checkWin(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line: [a, b, c] };
  }
  if (board.every(Boolean)) return { winner: 'draw', line: null };
  return null;
}

function getRoom(socketId) {
  for (const room of rooms.values())
    if (room.players.find(p => p.id === socketId)) return room;
  return null;
}

function getSymbol(room, socketId) {
  return room.players.find(p => p.id === socketId)?.symbol ?? null;
}

function emitRoomState(room) {
  io.to(room.code).emit('game:update', {
    board:       room.board,
    currentTurn: room.currentTurn,
  });
}

// ── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[+] ${socket.id} connected  (total: ${io.engine.clientsCount})`);

  // ── Random matchmaking ─────────────────────────────────────────────────
  socket.on('queue:join', () => {
    // Don't re-queue
    if (queue.find(p => p.id === socket.id)) return;
    if (getRoom(socket.id)) return; // already in a room

    if (queue.length > 0) {
      // Pop opponent and create room
      const opp  = queue.shift();
      let   code;
      do { code = generateCode(); } while (rooms.has(code));

      const room = freshRoom(code);
      // Randomise who is X
      const first = Math.random() < 0.5;
      room.players.push({ id: first ? opp.id : socket.id,  symbol: 'X' });
      room.players.push({ id: first ? socket.id : opp.id,  symbol: 'O' });
      rooms.set(code, room);

      opp.socket.join(code);
      socket.join(code);

      room.players.forEach(p => {
        const sym = p.symbol;
        io.to(p.id).emit('room:joined', { code, symbol: sym });
      });
      io.to(code).emit('room:ready', { code });
    } else {
      queue.push({ id: socket.id, socket });
      socket.emit('queue:waiting');
    }
  });

  socket.on('queue:leave', () => {
    const idx = queue.findIndex(p => p.id === socket.id);
    if (idx !== -1) queue.splice(idx, 1);
  });

  // ── Private rooms ──────────────────────────────────────────────────────
  socket.on('room:create', () => {
    if (getRoom(socket.id)) return; // already in a room
    let code;
    do { code = generateCode(); } while (rooms.has(code));

    const room = freshRoom(code);
    room.players.push({ id: socket.id, symbol: 'X' });
    rooms.set(code, room);
    socket.join(code);
    socket.emit('room:created', { code, symbol: 'X' });
  });

  socket.on('room:join', ({ code }) => {
    const upper = (code || '').toUpperCase().trim();
    const room  = rooms.get(upper);

    if (!room)                         return socket.emit('room:error', { message: 'Room not found. Check the code and try again.' });
    if (room.players.length >= 2)      return socket.emit('room:error', { message: 'Room is already full.' });
    if (room.players.find(p => p.id === socket.id))
                                       return socket.emit('room:error', { message: 'You are already in this room.' });

    room.players.push({ id: socket.id, symbol: 'O' });
    socket.join(upper);
    socket.emit('room:joined', { code: upper, symbol: 'O' });
    io.to(upper).emit('room:ready', { code: upper });
  });

  // ── Game: move ─────────────────────────────────────────────────────────
  socket.on('game:move', ({ index, code }) => {
    const room = rooms.get(code);
    if (!room || room.gameOver) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player)                        return;
    if (player.symbol !== room.currentTurn) return;
    if (room.board[index] !== null)     return;
    if (index < 0 || index > 8)        return;

    room.board[index]   = player.symbol;
    room.currentTurn    = player.symbol === 'X' ? 'O' : 'X';

    const result = checkWin(room.board);
    emitRoomState(room);

    if (result) {
      room.gameOver = true;
      io.to(code).emit('game:over', { winner: result.winner, line: result.line });
    }
  });

  // ── Game: rematch request ──────────────────────────────────────────────
  socket.on('game:rematch', ({ code }) => {
    const room = rooms.get(code);
    if (!room || !room.gameOver) return;

    room.rematchVotes.add(socket.id);

    if (room.rematchVotes.size === 2) {
      // Both voted — swap symbols and reset
      room.players.forEach(p => { p.symbol = p.symbol === 'X' ? 'O' : 'X'; });
      room.board        = Array(9).fill(null);
      room.currentTurn  = 'X';
      room.gameOver     = false;
      room.rematchVotes = new Set();

      const symbolMap = Object.fromEntries(room.players.map(p => [p.id, p.symbol]));
      io.to(code).emit('game:rematch:start', { symbols: symbolMap });
    } else {
      // Notify opponent that this player wants a rematch
      socket.to(code).emit('game:rematch:requested');
    }
  });

  // ── Disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', reason => {
    console.log(`[-] ${socket.id} disconnected (${reason})`);

    // Remove from matchmaking queue
    const qi = queue.findIndex(p => p.id === socket.id);
    if (qi !== -1) queue.splice(qi, 1);

    // Notify room partner and clean up
    const room = getRoom(socket.id);
    if (room) {
      socket.to(room.code).emit('player:disconnected');
      rooms.delete(room.code);
    }
  });
});

// ── Start server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮  Tic-Tac-Toe server ready`);
  console.log(`    Local:  http://localhost:${PORT}\n`);
});
