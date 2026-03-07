    
      import { IndexedDBManager } from "../../dist/esm/index.js";
      import { BrowserAdapter } from "../../dist/esm/browser.js";
      let dbManager: IndexedDBManager | null = null;

declare global {
  interface Window {
    initializeDB: () => void;
    clearDatabase: () => void;
    addItem: () => void;
    getItem: () => void;
    updateItem: () => void;
    deleteItem: () => void;
    addData: () => void;
    getAllItems: () => void;
    searchItems: () => void;
    exportData: () => void;
    downloadBackup: () => void;
    importData: () => void;
    getStats: () => void;
    clearEvents: () => void;
  }
}

      // Función para mostrar mensajes de estado
      function showStatus(message: string, type: string = "success") {
        const statusEl = document.getElementById("status");
        if (!statusEl) {
          return;
        }
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        statusEl.style.display = "block";
        setTimeout(() => {
          statusEl.style.display = "none";
        }, 3000);
      }

      // Función para agregar output a una sección
      function addOutput(elementId: string, content: string) {
        const outputEl = document.getElementById(elementId);
        const timestamp = new Date().toLocaleTimeString();
        if (!outputEl) {
          return;
        }
        outputEl.innerHTML += `[${timestamp}] ${content}\n`;
        outputEl.scrollTop = outputEl.scrollHeight;
      }
      function ErrorMSG(error: any) {
        if (error instanceof Error) {
          return ErrorMSG(error);
        } else if (typeof error === "string") {
          return error;
        } else {
          return String(error);
        }
      }
      // Inicializar base de datos
      async function initializeDB() {
        try {
          const dbName = (document.getElementById("dbName") as HTMLInputElement).value;
          const storeName = (document.getElementById("storeName") as HTMLInputElement).value;

          const config = {
            name: dbName,
            version: 1,
            store: storeName,
          };
          const adapter = new BrowserAdapter();
          dbManager = new IndexedDBManager(config, { adapter });

          // Configurar eventos
          dbManager.on("ready", () => {
            addOutput("eventsOutput", "✅ Base de datos lista");
          });

          dbManager.on("error", (error: any) => {
            addOutput("eventsOutput", `❌ Error: ${ErrorMSG(error)}`);
          });

          dbManager.on("add", (data: any) => {
            addOutput("eventsOutput", `➕ Agregado: ${JSON.stringify(data)}`);
          });

          dbManager.on("update", (data: any) => {
            addOutput(
              "eventsOutput",
              `✏️ Actualizado: ${JSON.stringify(data)}`,
            );
          });

          dbManager.on("delete", (id: any) => {
            addOutput("eventsOutput", `🗑️ Eliminado: ${id}`);
          });

          await dbManager.openDatabase();
          addOutput(
            "dbOutput",
            `Base de datos '${dbName}' inicializada correctamente`,
          );
          showStatus("Base de datos inicializada correctamente");
        } catch (error) {
          addOutput("dbOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.initializeDB = initializeDB;
      // Limpiar base de datos
      async function clearDatabase() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          await dbManager.clear();
          addOutput("dbOutput", "Base de datos limpiada");
          showStatus("Base de datos limpiada correctamente");
        } catch (error) {
          addOutput("dbOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.clearDatabase = clearDatabase;
      // Agregar item
      async function addItem() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const id = (document.getElementById("itemId") as HTMLInputElement).value;
          const dataStr = (document.getElementById("itemData") as HTMLInputElement).value;

          if (!id || !dataStr) {
            showStatus("Por favor completa ID y datos", "error");
            return;
          }

          const data = JSON.parse(dataStr);
          data.id = id;

          await dbManager.add(data);
          addOutput("crudOutput", `Agregado: ${JSON.stringify(data)}`);
          showStatus("Item agregado correctamente");
        } catch (error) {
          addOutput("crudOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.addItem = addItem;
      // Obtener item
      async function getItem() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const id = (document.getElementById("itemId") as HTMLInputElement).value;

          if (!id) {
            showStatus("Por favor ingresa un ID", "error");
            return;
          }

          const item = await dbManager.get(id);
          addOutput("crudOutput", `Obtenido: ${JSON.stringify(item, null, 2)}`);

          if (item) {
            (document.getElementById("itemData") as HTMLInputElement).value = JSON.stringify(
              item,
              null,
              2,
            );
          }
        } catch (error) {
          addOutput("crudOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.getItem = getItem;
      // Actualizar item
      async function updateItem() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const id = (document.getElementById("itemId") as HTMLInputElement).value;
          const dataStr = (document.getElementById("itemData") as HTMLInputElement).value;

          if (!id || !dataStr) {
            showStatus("Por favor completa ID y datos", "error");
            return;
          }

          const data = JSON.parse(dataStr);
          data.id = id;

          await dbManager.update(data);
          addOutput("crudOutput", `Actualizado: ${JSON.stringify(data)}`);
          showStatus("Item actualizado correctamente");
        } catch (error) {
          addOutput("crudOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.updateItem = updateItem;
      // Eliminar item
      async function deleteItem() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const id = (document.getElementById("itemId") as HTMLInputElement).value;

          if (!id) {
            showStatus("Por favor ingresa un ID", "error");
            return;
          }

          await dbManager.delete(id);
          addOutput("crudOutput", `Eliminado: ${id}`);
          showStatus("Item eliminado correctamente");
        } catch (error) {
          addOutput("crudOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.deleteItem = deleteItem;
      // Agregar datos de prueba en lote
      async function addData() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const testData = [
            {
              id: "user1",
              name: "Juan Pérez",
              email: "juan@email.com",
              age: 30,
            },
            {
              id: "user2",
              name: "María García",
              email: "maria@email.com",
              age: 25,
            },
            {
              id: "user3",
              name: "Carlos López",
              email: "carlos@email.com",
              age: 35,
            },
            {
              id: "user4",
              name: "Ana Martínez",
              email: "ana@email.com",
              age: 28,
            },
            {
              id: "user5",
              name: "Luis Rodríguez",
              email: "luis@email.com",
              age: 32,
            },
          ];

          await dbManager.add(testData);
          addOutput(
            "batchOutput",
            `Agregados ${testData.length} items en lote`,
          );
          showStatus("Datos de prueba agregados correctamente");
        } catch (error) {
          addOutput("batchOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.addData = addData;
      // Obtener todos los items
      async function getAllItems() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const items = await dbManager.getAll();
          addOutput("batchOutput", `Total de items: ${items.length}`);
          addOutput("batchOutput", JSON.stringify(items, null, 2));
        } catch (error) {
          addOutput("batchOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.getAllItems = getAllItems;
      // Buscar items
      async function searchItems() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const searchTerm = (document.getElementById("searchTerm") as HTMLInputElement).value;

          if (!searchTerm) {
            showStatus("Por favor ingresa un término de búsqueda", "error");
            return;
          }

          const results = await dbManager.search("name", searchTerm);
          addOutput(
            "batchOutput",
            `Resultados de búsqueda para '${searchTerm}': ${results.length} items`,
          );
          addOutput("batchOutput", JSON.stringify(results, null, 2));
        } catch (error) {
          addOutput("batchOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.searchItems = searchItems;
      // Exportar datos
      async function exportData() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const exportedData = await dbManager.getAllData();
          addOutput(
            "importExportOutput",
            `Datos exportados: ${JSON.stringify(exportedData, null, 2)}`,
          );
          showStatus("Datos exportados correctamente");
        } catch (error) {
          addOutput("importExportOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.exportData = exportData;
      // Descargar backup
      async function downloadBackup() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          await dbManager.getAll();
          addOutput("importExportOutput", "Backup descargado");
          showStatus("Backup descargado correctamente");
        } catch (error) {
          addOutput("importExportOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.downloadBackup = downloadBackup;
      // Importar datos
      async function importData() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const fileInput = document.getElementById("importFile") as HTMLInputElement;
          const file = fileInput.files ? fileInput.files[0] : null;

          if (!file) {
            return;
          }

          await dbManager.setDatabase(file);
          addOutput(
            "importExportOutput",
            `Datos importados desde: ${file.name}`,
          );
          showStatus("Datos importados correctamente");
        } catch (error) {
          addOutput("importExportOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.importData = importData;
      // Obtener estadísticas
      async function getStats() {
        if (!dbManager) {
          showStatus("Primero inicializa la base de datos", "error");
          return;
        }

        try {
          const stats = await dbManager.getStats();
          addOutput(
            "eventsOutput",
            `Estadísticas: ${JSON.stringify(stats, null, 2)}`,
          );
        } catch (error) {
          addOutput("eventsOutput", `Error: ${ErrorMSG(error)}`);
          showStatus(`Error: ${ErrorMSG(error)}`, "error");
        }
      }
      window.getStats = getStats;
      // Limpiar eventos
      function clearEvents() {
        (document.getElementById("eventsOutput") as HTMLElement).innerHTML = "";
      }
      window.clearEvents = clearEvents;

      // Inicializar automáticamente al cargar la página
      window.addEventListener("load", () => {
        addOutput(
          "eventsOutput",
          '🚀 Demo cargado. Haz clic en "Inicializar DB" para comenzar.',
        );
      });
