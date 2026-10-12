import { useState } from "react";
import { emitAsync } from "../socket.js";

export default function Lobby({ room, isHost }) {
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const host = room.players.find((p) => p.symbol === "X");
  const guest = room.players.find((p) => p.symbol === "O");
  const inviteLink = `${window.location.origin}${window.location.pathname}?code=${room.code}`;

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Couldn't copy automatically. Select the code and copy it by hand.");
    }
  }

  async function start() {
    setError("");
    const res = await emitAsync("start_game");
    if (!res.ok) setError(res.error);
  }

  return (
    <section className="sheet lobby">
      {isHost ? (
        <>
          <p className="lede">Send this code to your friend so they can join.</p>
          <div className="code-card">
            <span className="code">{room.code}</span>
            <div className="code-actions">
              <button className="btn small" onClick={() => copy(room.code, "code")}>
                {copied === "code" ? "Copied" : "Copy code"}
              </button>
              <button className="btn small" onClick={() => copy(inviteLink, "link")}>
                {copied === "link" ? "Copied" : "Copy invite link"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="lede">You joined game space <strong>{room.code}</strong>.</p>
      )}

      <ul className="roster">
        <li>
          <span className="mark-x">X</span>
          <span>{host?.name} {isHost && "(you)"}</span>
          <span className="tag">Host</span>
        </li>
        <li className={guest ? "" : "empty"}>
          <span className="mark-o">O</span>
          <span>{guest ? `${guest.name} ${!isHost ? "(you)" : ""}` : "Waiting for a player to join…"}</span>
        </li>
      </ul>

      {isHost ? (
        <button className="btn primary" onClick={start} disabled={room.players.length < 2}>
          {room.players.length < 2 ? "Waiting for your friend" : "Start game"}
        </button>
      ) : (
        <p className="hint">Waiting for {host?.name} to start the game.</p>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <button className="btn link" onClick={() => emitAsync("leave_room").then(() => window.location.reload())}>
        Leave game space
      </button>
    </section>
  );
}
