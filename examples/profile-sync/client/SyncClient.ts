
import type { SyncMessage, SyncItem } from "../shared/types.js";

export interface SyncClientOptions {
  profileId: string;
  url: string;
}

export class SyncClient {
  private ws: WebSocket | null = null;
  private profileId: string;
  private url: string;
  private online: boolean = false;
  private syncQueue: Map<string, SyncItem[]> = new Map();
  private onUpdateLocal?: (storeName: string, items: SyncItem[]) => Promise<void>;
  private pendingSyncs: Set<string> = new Set();

  constructor(options: SyncClientOptions) {
    this.profileId = options.profileId;
    this.url = options.url;
    this.connect();
  }

  setUpdateLocalCallback(callback: (storeName: string, items: SyncItem[]) => Promise<void>) {
    this.onUpdateLocal = callback;
  }

  connect() {
    this.ws = new WebSocket(`${this.url}?profileId=${this.profileId}`);

    this.ws.onopen = () => {
      console.log(`[Client] Profile ${this.profileId} online`);
      this.online = true;
      this.sendMessage({ type: "SUBSCRIBE", profileId: this.profileId });
      this.syncQueuedChanges();
      
      for (const storeName of this.pendingSyncs) {
          this.syncFromServer(storeName);
      }
      this.pendingSyncs.clear();
    };

    this.ws.onmessage = async (event) => {
      const data: SyncMessage = JSON.parse(event.data);
      if (data.type === "ALL_DATA" || data.type === "REMOTE_UPDATE") {
        if (this.onUpdateLocal && data.storeName && data.payload) {
          await this.onUpdateLocal(data.storeName, data.payload);
        }
      }
    };

    this.ws.onclose = () => {
      if (this.ws) {
        console.log(`[Client] Profile ${this.profileId} offline`);
        this.online = false;
        setTimeout(() => { if (!this.online) this.connect(); }, 5000);
      }
    };
  }

  sendMessage(msg: SyncMessage) {
    if (this.online && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  syncFromServer(storeName: string) {
    const success = this.sendMessage({ type: "GET_ALL", profileId: this.profileId, storeName });
    if (!success) this.pendingSyncs.add(storeName);
  }

  pushChange(storeName: string, item: SyncItem) {
    const success = this.sendMessage({ 
      type: item._deleted ? "DELETE" : "UPSERT", 
      profileId: this.profileId, 
      storeName, 
      payload: item 
    });
    
    if (!success) {
      if (!this.syncQueue.has(storeName)) this.syncQueue.set(storeName, []);
      this.syncQueue.get(storeName)!.push(item);
    }
  }

  pushBatch(storeName: string, items: SyncItem[]) {
    const success = this.sendMessage({ 
      type: "SYNC", 
      profileId: this.profileId, 
      storeName, 
      payload: items 
    });
    
    if (!success) {
      if (!this.syncQueue.has(storeName)) this.syncQueue.set(storeName, []);
      this.syncQueue.get(storeName)!.push(...items);
    }
  }

  private syncQueuedChanges() {
    for (const [storeName, changes] of this.syncQueue.entries()) {
      this.pushBatch(storeName, changes);
    }
    this.syncQueue.clear();
  }

  isOnline() { return this.online; }

  close() {
    if (this.ws) {
      this.online = false;
      const ws = this.ws;
      this.ws = null;
      ws.close();
    }
  }
}
