# Tic Tac Toe Online (Node + Express + Socket.IO + React)

Two players on different devices. One creates a game space and gets a 6-character code,
the other joins with that code, and the creator (host) starts the game.

## Run locally

Terminal 1 – server (port 3001):

    cd server
    npm install
    npm run dev

Terminal 2 – client (port 5173):

    cd client
    npm install
    npm run dev

Open http://localhost:5173 in two browser windows (or one normal + one incognito).
Window A: Create game space → copy code. Window B: paste code → Join. Window A: Start game.

To test from a phone on the same Wi-Fi, run the client with `npx vite --host`,
start the server with `CLIENT_ORIGIN=http://<your-LAN-IP>:5173`, and create
`client/.env` with `VITE_SERVER_URL=http://<your-LAN-IP>:3001`.

## Production (single server)

    cd client && npm run build
    cd ../server && npm start

Express serves `client/dist` and the WebSocket on the same port, so only one service
needs deploying (Render, Railway, Fly.io, a VPS, etc.). Set `PORT` if the host requires it.

## How it works

- **Server is authoritative.** All game state lives in an in-memory `Map` keyed by room code.
  The server validates every move (correct turn, empty square, game running) and decides wins/draws,
  so a player can't cheat by editing the client.
- **Socket.IO rooms** map 1:1 to game spaces; every change is broadcast as `room_state`.
- Codes use an alphabet without 0/O/1/I so they're easy to read aloud.

| Event (client → server) | Who | What |
|---|---|---|
| `create_room {name}` | anyone | Creates space, returns `{code}`. Creator is host and plays X |
| `join_room {code, name}` | anyone | Joins as O (max 2 players) |
| `start_game` | host | Starts once 2 players are in |
| `make_move {index}` | player on turn | Index 0–8 |
| `play_again` | host | New round; who goes first alternates |
| `leave_room` | anyone | Host leaving closes the space; guest leaving reopens it |

Server → client: `room_state`, `room_closed`, `notice`.

## Ideas for next steps

- Reconnect support (store a player token in localStorage, give a grace period on disconnect)
- Persist rooms in Redis so you can run multiple server instances
- Expire idle rooms, add spectators, in-game chat
