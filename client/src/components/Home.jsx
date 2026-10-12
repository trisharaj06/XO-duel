import { useState } from "react";
import { emitAsync } from "../socket.js";

export default function Home({ connected }) {
  const initialCode = new URLSearchParams(window.location.search).get("code") || "";
  const [name, setName] = useState(() => sessionStorage.getItem("ttt-name") || "");
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const rememberName = () => sessionStorage.setItem("ttt-name", name.trim());

  async function createSpace() {
    setError("");
    setBusy(true);
    rememberName();
    const res = await emitAsync("create_room", { name });
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  async function joinSpace(e) {
    e.preventDefault();
    setError("");
    if (code.trim().length < 6) return setError("Enter the 6-character code your friend sent you.");
    setBusy(true);
    rememberName();
    const res = await emitAsync("join_room", { code, name });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else window.history.replaceState(null, "", window.location.pathname);
  }

  const disabled = !connected || busy;

  return (
    <section className="sheet home">
      <p className="lede">
        Start a game space, send the code to a friend, and play from two different devices.
      </p>

      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="e.g. Asha"
          autoComplete="nickname"
        />
      </label>

      <div className="split">
        <div className="option">
          <h2>Start a new game</h2>
          <p>You'll get a code to share. You play X and choose when to start.</p>
          <button className="btn primary" onClick={createSpace} disabled={disabled}>
            Create game space
          </button>
        </div>

        <form className="option" onSubmit={joinSpace}>
          <h2>Join a friend</h2>
          <p>Type the code they sent you. You'll play O.</p>
          <div className="join-row">
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={6}
              placeholder="ABC123"
              aria-label="Game code"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button className="btn" type="submit" disabled={disabled}>
              Join
            </button>
          </div>
        </form>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
