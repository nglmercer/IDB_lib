
export type MessageType = 
  | "GET_ALL" 
  | "ALL_DATA" 
  | "SYNC" 
  | "UPSERT" 
  | "DELETE" 
  | "REMOTE_UPDATE" 
  | "SUBSCRIBE";

export interface SyncMessage {
  type: MessageType;
  profileId: string;
  storeName?: string;
  payload?: any;
}

export interface SyncItem {
  id: any;
  _deleted?: boolean;
  [key: string]: any;
}
