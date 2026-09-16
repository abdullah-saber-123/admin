import { wsUrl } from "./api.js";

let ws = null;
let reconnectTimer = null;
let currentUsername = null;
const listeners = new Set();

export function connectSignalingSocket(username) {
  currentUsername = username;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const token = localStorage.getItem("collect_token");
  if (!token) return;

  const socket = new WebSocket(wsUrl(`/api/staff-chat/ws/call?token=${encodeURIComponent(token)}`));
  ws = socket;

  socket.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    listeners.forEach((fn) => fn(data));
  };
  socket.onclose = () => {
    if (ws === socket) ws = null;
    if (currentUsername) reconnectTimer = setTimeout(() => connectSignalingSocket(currentUsername), 3000);
  };
  socket.onerror = () => { try { socket.close(); } catch { /* already closing */ } };
}

export function disconnectSignalingSocket() {
  currentUsername = null;
  clearTimeout(reconnectTimer);
  if (ws) { try { ws.close(); } catch { /* already closed */ } ws = null; }
}

export function sendSignal(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

/** Returns an unsubscribe function. */
export function subscribeSignal(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
