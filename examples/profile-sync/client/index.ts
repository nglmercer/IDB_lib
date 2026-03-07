
import { IndexedDBManager } from "../../../src/core/IndexedDBManager.js";
import { SyncAdapter } from "./SyncAdapter.js";

async function runExample() {
  console.log("🚀 Starting Profile Sync Example...");

  // 1. Setup local adapter (could be Memory or IndexedDB via BrowserAdapter)
  // For this node-based example, we use Memory as the local base
  
  // 2. Client uses Profile A
  const adapterA = new SyncAdapter("User_A");
  const dbA = new IndexedDBManager({ name: "ProfileA", version: 1, store: "preferences" }, { adapter: adapterA });
  await dbA.openDatabase();

  console.log("\n👤 PROFILE: User_A");

  // Add preference while online
  await dbA.add({ id: "theme", value: "dark" });
  console.log("✅ Added { theme: 'dark' } to User_A preferences");

  // 3. Client uses Profile B
  const adapterB = new SyncAdapter("User_B");
  const dbB = new IndexedDBManager({ name: "ProfileB", version: 1, store: "preferences" }, { adapter: adapterB });
  await dbB.openDatabase();

  console.log("\n👤 PROFILE: User_B");
  await dbB.add({ id: "language", value: "es" });
  console.log("✅ Added { language: 'es' } to User_B preferences");

  // 4. Simulate syncing: A different client for User_A pulls the data
  console.log("\n🔄 Simulating Client 2 for User_A...");
  const adapterA2 = new SyncAdapter("User_A");
  const dbA2 = new IndexedDBManager({ name: "ProfileA_Client2", version: 1, store: "preferences" }, { adapter: adapterA2 });
  await dbA2.openDatabase();

  // Give it a second to connect and receive data
  await new Promise(r => setTimeout(r, 1000));
  
  // Ask for data (this happens automatically on connect in our SyncAdapter logic usually, 
  // but let's force it for the demo)
  adapterA2.syncFromServer("preferences");
  await new Promise(r => setTimeout(r, 1000));

  const preferencesA = await dbA2.getAll();
  console.log("📥 User_A Client 2 Preferences:", preferencesA);

  // 5. Demonstrate Offline behavior
  console.log("\n📴 Going offline for Profile B...");
  (adapterB as any).syncClient.close(); // Force close
  
  await new Promise(r => setTimeout(r, 500)); // wait for closure
  
  console.log("B Online?", adapterB.isOnline());
  
  await dbB.add({ id: "notifications", value: true });
  console.log("💾 Added { notifications: true } while OFFLINE (queued)");
  
  console.log("\n🌐 Resuming online for Profile B...");
  (adapterB as any).syncClient.connect(); // Manually reconnect
  
  await new Promise(r => setTimeout(r, 2000)); // wait for reconnect and sync
  
  console.log("B Online?", adapterB.isOnline());
  
  // Client 2 for User_B should now receive the update
  const adapterB2 = new SyncAdapter("User_B");
  const dbB2 = new IndexedDBManager({ name: "ProfileB_Client2", version: 1, store: "preferences" }, { adapter: adapterB2 });
  await dbB2.openDatabase();
  
  adapterB2.syncFromServer("preferences");
  await new Promise(r => setTimeout(r, 2000));
  
  const preferencesB = await dbB2.getAll();
  console.log("📥 User_B Client 2 Preferences (after B came back online):", preferencesB);

  console.log("\n🏁 Example finished.");
  process.exit(0);
}

runExample().catch(console.error);
