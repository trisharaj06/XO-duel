import { io } from "socket.io-client";

// Prod: the Express server serves the built client, so same origin.
const URL = import.meta.env.VITE_SERVER_URL

export const socket = io(URL);

// Promise wrapper around emit-with-acknowledgement
export function emitAsync(event, payload = {}) {
  return new Promise((resolve) => {
    socket.timeout(5000).emit(event, payload, (err, res) => {
      if (err) resolve({ ok: false, error: "The server didn't respond. Check your connection and try again." });
      else resolve(res);
    });
  });
}
