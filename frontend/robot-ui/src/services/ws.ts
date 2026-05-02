const WS_URL = "ws://localhost:8000/ws";
const RECONNECT_DELAY = 3000;

let socket: WebSocket | null = null;
let onMessageCb: ((data: any) => void) | null = null;
let onStatusCb:
  | ((status: "connected" | "disconnected" | "reconnecting") => void)
  | null = null;
let shouldReconnect = true;

function connect() {
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    onStatusCb?.("connected");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessageCb?.(data);
    } catch (e) {
      console.error("WS parse error", e);
    }
  };

  socket.onclose = () => {
    onStatusCb?.("disconnected");
    if (shouldReconnect) {
      onStatusCb?.("reconnecting");
      setTimeout(connect, RECONNECT_DELAY);
    }
  };

  socket.onerror = (err) => console.error("WS error", err);
}

export type WsStatus = "connected" | "disconnected" | "reconnecting";

export const connectWS = (
  onMessage: (data: any) => void,
  onStatus?: (status: WsStatus) => void,
) => {
  onMessageCb = onMessage;
  onStatusCb = onStatus ?? null;
  shouldReconnect = true;
  connect();
};

export const sendCommand = (cmd: any) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(cmd));
  }
};

export const disconnectWS = () => {
  shouldReconnect = false;
  socket?.close();
};
