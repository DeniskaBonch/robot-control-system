let socket: WebSocket;

export const connectSocket = (url: string, onMessage: (data: any) => void) => {
  socket = new WebSocket(url);

  socket.onopen = () => console.log("WS connected");
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  socket.onclose = () => console.log("WS disconnected");
};

export const sendCommand = (command: any) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(command));
  }
};
