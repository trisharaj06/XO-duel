const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
require('dotenv').config();

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

/**
 * rooms: Map<code, {
 *   code, hostId,
 *   players: [{ id, name, symbol }],
 *   board: (null | "X" | "O")[9],
 *   turn: "X" | "O", starter: "X" | "O",
 *   status: "waiting" | "playing" | "finished",
 *   winner: null | "X" | "O" | "draw", winLine: number[],
 *   scores: { X, O, draw }
 * }>
 */
const rooms = new Map();

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// No 0/O or 1/I so codes are easy to read out loud
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 6) {
  let code;
  do {
    code = Array.from({ length }, () =>
      CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  const n = String(name || "").trim().slice(0, 20);
  return n || "Player";
}

function checkWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (board.every(Boolean)) return { winner: "draw", line: [] };
  return null;
}

function resetBoard(room) {
  room.board = Array(9).fill(null);
  room.turn = room.starter;
  room.winner = null;
  room.winLine = [];
}

function publicState(room) {
  const { code, hostId, players, board, turn, status, winner, winLine, scores } = room;
  return { code, hostId, players, board, turn, status, winner, winLine, scores };
}

function broadcast(room) {
  io.to(room.code).emit("room_state", publicState(room));
}

function leaveCurrentRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  socket.data.roomCode = null;
  socket.leave(code);

  const room = rooms.get(code);
  if (!room) return;

  if (room.hostId === socket.id) {
    // Host left: close the space for everyone
    socket.to(code).emit("room_closed", {
      reason: "The host left, so this game space was closed.",
    });
    for (const p of room.players) {
      const s = io.sockets.sockets.get(p.id);
      if (s) {
        s.data.roomCode = null;
        s.leave(code);
      }
    }
    rooms.delete(code);
    return;
  }

  // Guest left: back to waiting so someone else can join with the same code
  const leaving = room.players.find((p) => p.id === socket.id);
  room.players = room.players.filter((p) => p.id !== socket.id);
  room.status = "waiting";
  resetBoard(room);
  room.scores = { X: 0, O: 0, draw: 0 };
  io.to(code).emit("notice", `${leaving ? leaving.name : "Your opponent"} left the game.`);
  broadcast(room);
}

io.on("connection", (socket) => {
  socket.data.roomCode = null;

  socket.on("create_room", ({ name } = {}, ack = () => {}) => {
    leaveCurrentRoom(socket);
    const code = generateCode();
    const room = {
      code,
      hostId: socket.id,
      players: [{ id: socket.id, name: cleanName(name), symbol: "X" }],
      starter: "X",
      status: "waiting",
      scores: { X: 0, O: 0, draw: 0 },
    };
    resetBoard(room);
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    ack({ ok: true, code });
    broadcast(room);
  });

  socket.on("join_room", ({ code, name } = {}, ack = () => {}) => {
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return ack({ ok: false, error: "No game space found with that code. Check the code and try again." });
    if (room.players.some((p) => p.id === socket.id)) return ack({ ok: true, code: roomCode });
    if (room.players.length >= 2) return ack({ ok: false, error: "This game space already has two players." });

    leaveCurrentRoom(socket);
    room.players.push({ id: socket.id, name: cleanName(name), symbol: "O" });
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    ack({ ok: true, code: roomCode });
    broadcast(room);
  });

  socket.on("start_game", (_payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return ack({ ok: false, error: "You're not in a game space." });
    if (room.hostId !== socket.id) return ack({ ok: false, error: "Only the host can start the game." });
    if (room.players.length < 2) return ack({ ok: false, error: "Wait for a second player to join." });
    if (room.status === "playing") return ack({ ok: true });

    resetBoard(room);
    room.status = "playing";
    ack({ ok: true });
    broadcast(room);
  });

  socket.on("make_move", ({ index } = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== "playing") return ack({ ok: false, error: "The game isn't running." });

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return ack({ ok: false, error: "You're not a player in this game." });
    if (player.symbol !== room.turn) return ack({ ok: false, error: "It's not your turn." });
    if (!Number.isInteger(index) || index < 0 || index > 8) return ack({ ok: false, error: "Invalid square." });
    if (room.board[index]) return ack({ ok: false, error: "That square is taken." });

    room.board[index] = player.symbol;
    const result = checkWinner(room.board);
    if (result) {
      room.status = "finished";
      room.winner = result.winner;
      room.winLine = result.line;
      room.scores[result.winner] += 1;
    } else {
      room.turn = room.turn === "X" ? "O" : "X";
    }
    ack({ ok: true });
    broadcast(room);
  });

  socket.on("play_again", (_payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return ack({ ok: false, error: "You're not in a game space." });
    if (room.hostId !== socket.id) return ack({ ok: false, error: "Only the host can start a new round." });
    if (room.players.length < 2) return ack({ ok: false, error: "Wait for a second player to join." });

    room.starter = room.starter === "X" ? "O" : "X"; // alternate who goes first
    resetBoard(room);
    room.status = "playing";
    ack({ ok: true });
    broadcast(room);
  });

  socket.on("leave_room", (_payload, ack = () => {}) => {
    leaveCurrentRoom(socket);
    ack({ ok: true });
  });

  socket.on("disconnect", () => leaveCurrentRoom(socket));
});

app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));

// In production, serve the built React app from ../client/dist
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).send("Client not built. Run `npm run build` in /client, or use the Vite dev server.");
  });
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
