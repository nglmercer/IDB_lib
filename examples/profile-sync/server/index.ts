
import { serve } from "bun";
import { MemoryServerStore } from "./MemoryServerStore.js";
import { SocketHandler, type WebSocketData } from "./SocketHandler.js";

const store = new MemoryServerStore();
const socketHandler = new SocketHandler(store);

const server = serve<WebSocketData>({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);
    const success = server.upgrade(req, {
      data: {
        profileId: url.searchParams.get("profileId") || undefined
      }
    });
    if (success) return undefined;
    return new Response("Not a WebSocket connection", { status: 400 });
  },
  websocket: {
    message(ws, message) {
      socketHandler.onMessage(server, ws, message.toString());
    },
    open(ws) {
      socketHandler.onOpen(ws);
    },
    close(ws) {
      socketHandler.onClose(ws);
    },
  },
});

console.log(`[Sync Server] Running on http://localhost:${server.port}`);
