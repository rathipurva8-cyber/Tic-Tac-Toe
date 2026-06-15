# 🎮 Tic-Tac-Toe Multiplayer

A full-stack, real-time Tic-Tac-Toe game with three play modes, built with **Node.js**, **Express**, and **Socket.io**.

![Tic-Tac-Toe](https://img.shields.io/badge/Game-Tic--Tac--Toe-a78bfa?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-24.x-339933?style=for-the-badge&logo=node.js)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socket.io)

---

## ✨ Features

| Mode | Description |
|------|-------------|
| 🤖 **vs AI** | Play locally against Easy / Medium / Hard AI (unbeatable minimax with alpha-beta pruning) |
| 🌐 **Random Match** | Auto-paired with a random online player via matchmaking queue |
| 🔒 **Private Room** | Create a room, share the 6-character code, play with a friend |

- Real-time moves with **Socket.io**
- Rematch system (symbols swap each round)
- Disconnect detection with instant banner
- Animated strike-through line on win
- Confetti celebration 🎉
- Fully responsive, premium dark glassmorphism UI

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+

### Install & Run

```bash
# Clone the repo
git clone https://github.com/rathipurva8-cyber/tic-tac-toe.git
cd tic-tac-toe

# Install dependencies
npm install

# Start the server
node server.js
```

Then open **http://localhost:3000** in your browser.

To test **online multiplayer**, open two browser tabs at `http://localhost:3000` and click **Random Match** in both.

---

## 📁 Project Structure

```
├── server.js        ← Express + Socket.io backend
├── package.json     ← Dependencies
└── public/
    └── index.html   ← Full single-page app (5 views)
```

## 🛠 Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **AI**: Minimax algorithm with alpha-beta pruning
- **Design**: Glassmorphism dark theme, Google Fonts (Outfit)
