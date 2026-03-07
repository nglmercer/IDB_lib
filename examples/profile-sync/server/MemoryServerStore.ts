
import type { SyncItem } from "../shared/types.js";

export class MemoryServerStore {
  // profileId -> { storeName -> Map<id, item> }
  private profiles: Map<string, Map<string, Map<any, SyncItem>>> = new Map();

  getStoreData(profileId: string, storeName: string): SyncItem[] {
    const store = this.getOrCreateStore(profileId, storeName);
    return Array.from(store.values());
  }

  upsert(profileId: string, storeName: string, item: SyncItem) {
    const store = this.getOrCreateStore(profileId, storeName);
    store.set(item.id, item);
  }

  delete(profileId: string, storeName: string, id: any) {
    const store = this.getOrCreateStore(profileId, storeName);
    store.delete(id);
  }

  sync(profileId: string, storeName: string, payload: SyncItem[]) {
    const store = this.getOrCreateStore(profileId, storeName);
    for (const item of payload) {
      if (item._deleted) {
        store.delete(item.id);
      } else {
        store.set(item.id, item);
      }
    }
  }

  private getOrCreateStore(profileId: string, storeName: string) {
    if (!this.profiles.has(profileId)) {
      this.profiles.set(profileId, new Map());
    }
    const profileStores = this.profiles.get(profileId)!;
    if (!profileStores.has(storeName)) {
      profileStores.set(storeName, new Map());
    }
    return profileStores.get(storeName)!;
  }
}
