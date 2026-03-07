
import type { Server, ServerWebSocket } from "bun";
import { MemoryServerStore } from "./MemoryServerStore.js";
import type { SyncMessage } from "../shared/types.js";

export interface WebSocketData {
    profileId?: string;
}

export class SocketHandler {
    private store: MemoryServerStore;

    constructor(store: MemoryServerStore) {
        this.store = store;
    }

    onOpen(ws: ServerWebSocket<WebSocketData>) {
        console.log(`[Socket] Connection for profile: ${ws.data.profileId}`);
    }

    onMessage(server: Server<WebSocketData>, ws: ServerWebSocket<WebSocketData>, messageStr: string) {
        let msg: SyncMessage;
        try {
            msg = JSON.parse(messageStr);
        } catch (e) {
            return;
        }

        const { type, profileId, storeName, payload } = msg;
        if (!profileId || !storeName) return;

        console.log(`[Socket] Event ${type} | Profile: ${profileId} | Store: ${storeName}`);

        switch (type) {
            case "GET_ALL": {
                const data = this.store.getStoreData(profileId, storeName);
                ws.send(JSON.stringify({ 
                    type: "ALL_DATA", 
                    profileId, 
                    storeName, 
                    payload: data 
                }));
                break;
            }
            case "SYNC": {
                this.store.sync(profileId, storeName, payload);
                server.publish(profileId, JSON.stringify({ 
                    type: "REMOTE_UPDATE", 
                    profileId, 
                    storeName, 
                    payload 
                }));
                break;
            }
            case "UPSERT": {
                this.store.upsert(profileId, storeName, payload);
                server.publish(profileId, JSON.stringify({ 
                    type: "REMOTE_UPDATE", 
                    profileId, 
                    storeName, 
                    payload: [payload] 
                }));
                break;
            }
            case "DELETE": {
                this.store.delete(profileId, storeName, payload.id);
                server.publish(profileId, JSON.stringify({ 
                    type: "REMOTE_UPDATE", 
                    profileId, 
                    storeName, 
                    payload: [{ id: payload.id, _deleted: true }] 
                }));
                break;
            }
            case "SUBSCRIBE": {
                ws.subscribe(profileId);
                break;
            }
        }
    }

    onClose(ws: ServerWebSocket<WebSocketData>) {
        console.log(`[Socket] Client disconnected profile: ${ws.data.profileId}`);
    }
}
