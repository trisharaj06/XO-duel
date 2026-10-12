import { useEffect, useState } from "react";
import { socket } from "./socket.js";
import Home from "./components/Home.jsx";
import Lobby from "./components/Lobby.jsx";
import Game from "./components/Game.jsx";

export default function App() {
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setRoom((r) => {
        if (r) setNotice("Connection lost. Your game space was closed.");
        return null;
      });
    };
    const onRoomState = (state) => setRoom(state);
    const onRoomClosed = ({ reason }) => {
      setRoom(null);
      setNotice(reason);
    };
    const onNotice = (msg) => setNotice(msg);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_state", onRoomState);
    socket.on("room_closed", onRoomClosed);
    socket.on("notice", onNotice);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_state", onRoomState);
      socket.off("room_closed", onRoomClosed);
      socket.off("notice", onNotice);
    };
  }, []);

  // Auto-hide notices
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const me = room?.players.find((p) => p.id === socket.id) || null;
  const isHost = room?.hostId === socket.id;

  let screen;
  if (!room) screen = <Home connected={connected} />;
  else if (room.status === "waiting") screen = <Lobby room={room} isHost={isHost} />;
  else screen = <Game room={room} me={me} isHost={isHost} />;

  return (
    <main className="page">
      <header className="masthead">
        <h1>Tic Tac Toe</h1>
        <span className={`conn ${connected ? "on" : "off"}`}>
          {connected ? "Online" : "Connecting…"}
        </span>
      </header>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {screen}
    </main>
  );
}
