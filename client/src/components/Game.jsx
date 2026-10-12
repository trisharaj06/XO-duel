import { useState } from "react";
import { emitAsync } from "../socket.js";

// Slightly wobbly hand-drawn board lines (viewBox 300x300)
const GRID = [
  "M100 8 Q104 150 99 292",
  "M200 10 Q196 150 201 290",
  "M8 100 Q150 96 292 101",
  "M10 200 Q150 204 290 199",
];

function XMark() {
  return (
    <svg viewBox="0 0 100 100" className="mark x" aria-hidden="true">
      <path pathLength="1" d="M24 24 Q50 50 78 78" />
      <path pathLength="1" className="second" d="M77 22 Q49 51 23 79" />
    </svg>
  );
}

function OMark() {
  return (
    <svg viewBox="0 0 100 100" className="mark o" aria-hidden="true">
      <path pathLength="1" d="M52 19 C76 18 84 40 81 56 C77 76 54 85 36 78 C18 71 15 44 28 29 C36 20 46 18 58 22" />
    </svg>
  );
}

function center(i) {
  return { x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 };
}

function WinStroke({ line }) {
  if (!line || line.length !== 3) return null;
  const a = center(line[0]);
  const b = center(line[2]);
  // extend past the end cells a bit
  const dx = (b.x - a.x) * 0.18;
  const dy = (b.y - a.y) * 0.18;
  return (
    <line
      className="win-stroke"
      pathLength="1"
      x1={a.x - dx} y1={a.y - dy}
      x2={b.x + dx} y2={b.y + dy}
    />
  );
}

export default function Game({ room, me, isHost }) {
  const [error, setError] = useState("");
  const opponent = room.players.find((p) => p.id !== me?.id);
  const myTurn = room.status === "playing" && me?.symbol === room.turn;
  const byName = (sym) => room.players.find((p) => p.symbol === sym)?.name || sym;

  let status;
  if (room.status === "finished") {
    if (room.winner === "draw") status = "It's a draw.";
    else if (room.winner === me?.symbol) status = "You won!";
    else status = `${byName(room.winner)} won this round.`;
  } else {
    status = myTurn ? "Your turn" : `${opponent?.name || "Opponent"}'s turn`;
  }

  async function play(i) {
    if (!myTurn || room.board[i]) return;
    setError("");
    const res = await emitAsync("make_move", { index: i });
    if (!res.ok) setError(res.error);
  }

  async function again() {
    setError("");
    const res = await emitAsync("play_again");
    if (!res.ok) setError(res.error);
  }

  return (
    <section className="sheet game">
      <div className="scoreline">
        <div className={`player ${room.turn === "X" && room.status === "playing" ? "active" : ""}`}>
          <span className="mark-x">X</span> {byName("X")}
          <b>{room.scores.X}</b>
        </div>
        <div className="draws">Draws {room.scores.draw}</div>
        <div className={`player ${room.turn === "O" && room.status === "playing" ? "active" : ""}`}>
          <b>{room.scores.O}</b>
          {byName("O")} <span className="mark-o">O</span>
        </div>
      </div>

      <p className={`status ${myTurn ? "mine" : ""}`} aria-live="polite">{status}</p>

      <div className="board-wrap">
        <div className="board" role="grid" aria-label="Tic tac toe board">
          {room.board.map((cell, i) => (
            <button
              key={i}
              className="cell"
              onClick={() => play(i)}
              disabled={!myTurn || !!cell}
              aria-label={`Square ${i + 1}${cell ? `, ${cell}` : ", empty"}`}
            >
              {cell === "X" && <XMark />}
              {cell === "O" && <OMark />}
            </button>
          ))}
        </div>
        <svg className="grid-lines" viewBox="0 0 300 300" aria-hidden="true">
          {GRID.map((d) => <path key={d} d={d} />)}
          <WinStroke line={room.winLine} />
        </svg>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {room.status === "finished" &&
        (isHost ? (
          <button className="btn primary" onClick={again}>Play again</button>
        ) : (
          <p className="hint">Waiting for {byName("X")} to start the next round.</p>
        ))}

      <button className="btn link" onClick={() => emitAsync("leave_room").then(() => window.location.reload())}>
        Leave game
      </button>
    </section>
  );
}
