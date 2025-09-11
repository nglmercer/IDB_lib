import type { DatabaseConfig, DatabaseItem, ImportOptions, ExportOptions } from '../types/index.js';
import { downloadJSON, readJSONFile, convertToCSV } from './helpers.js';

/**
 * Obtiene todos los datos de una base de datos específica
 */
export async function getAllDataFromDatabase(
  databaseConfig: DatabaseConfig
): Promise<DatabaseItem[]> {
  if (!databaseConfig || !databaseConfig.name || !databaseConfig.version) {
    console.error("Invalid database configuration:", databaseConfig);
    return [];
  }

  return new Promise<DatabaseItem[]>((resolve) => {
    const request = indexedDB.open(databaseConfig.name, databaseConfig.version);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(databaseConfig.store)) {
        db.createObjectStore(databaseConfig.store, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(databaseConfig.store)) {
        db.close();
        resolve([]);
        return;
      }

      const transaction = db.transaction([databaseConfig.store], "readonly");
      const store = transaction.objectStore(databaseConfig.store);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result);
        db.close();
      };

      getAllRequest.onerror = () => {
        resolve([]);
        db.close();
      };
    };

    request.onerror = () => {
      resolve([]);
    };
  });
}

/**
 * Importa datos a una base de datos específica
 */
export async function importDataToDatabase(
  databaseConfig: DatabaseConfig,
  data: DatabaseItem[],
  options: ImportOptions = {}
): Promise<boolean> {
  // Validate database configuration first
  if (!databaseConfig || !databaseConfig.name || !databaseConfig.version || !databaseConfig.store) {
    console.error("Invalid database configuration:", databaseConfig);
    return false;
  }

  const { clearBefore = true, validate = true, transform } = options;

  return new Promise<boolean>((resolve) => {
    const request = indexedDB.open(databaseConfig.name, databaseConfig.version);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(databaseConfig.store)) {
        db.createObjectStore(databaseConfig.store, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([databaseConfig.store], "readwrite");
      const store = transaction.objectStore(databaseConfig.store);

      const processData = () => {
        let processedData = data;
        
        // Validar datos si está habilitado
        if (validate) {
          processedData = data.filter(item => {
            return item && typeof item === 'object' && (item.id !== undefined && item.id !== null);
          });
        }
        
        // Transformar datos si se proporciona función
        if (transform) {
          processedData = processedData.map(transform);
        }
        
        // Agregar todos los datos
        let completed = 0;
        const total = processedData.length;

        if (total === 0) {
          db.close();
          resolve(true);
          return;
        }

        processedData.forEach((item) => {
          const addRequest = store.put(item); // Usar put en lugar de add para permitir sobrescritura
          
          addRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              db.close();
              resolve(true);
            }
          };

          addRequest.onerror = () => {
            console.error('Error importing item:', item, addRequest.error);
            completed++;
            if (completed === total) {
              db.close();
              resolve(false);
            }
          };
        });
      };

      if (clearBefore) {
        // Limpiar la base de datos antes de importar
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
          processData();
        };

        clearRequest.onerror = () => {
          db.close();
          resolve(false);
        };
      } else {
        processData();
      }
    };

    request.onerror = () => {
      resolve(false);
    };
  });
}

/**
 * Exporta datos de una base de datos
 */
export async function exportDataFromDatabase(
  databaseConfig: DatabaseConfig,
  options: ExportOptions = {}
): Promise<void> {
  const { format = 'json', filename, filters } = options;
  
  try {
    let data = await getAllDataFromDatabase(databaseConfig);
    
    // Aplicar filtros si se proporcionan
    if (filters && Object.keys(filters).length > 0) {
      data = data.filter(item => {
        return Object.entries(filters).every(([key, value]) => {
          if (typeof value === 'string') {
            return String(item[key]).toLowerCase().includes(value.toLowerCase());
          }
          return item[key] === value;
        });
      });
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const defaultFilename = filename || `${databaseConfig.name}_${databaseConfig.store}_${timestamp}`;
    
    if (format === 'csv') {
      const csvContent = convertToCSV(data);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${defaultFilename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      downloadJSON(data, `${defaultFilename}.json`);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

/**
 * Importa datos desde un archivo
 */
export async function importDataFromFile(
  file: File,
  databaseConfig: DatabaseConfig,
  options: ImportOptions = {}
): Promise<boolean> {
  try {
    const data = await readJSONFile(file);
    return await importDataToDatabase(databaseConfig, data, options);
  } catch (error) {
    console.error('Error importing data from file:', error);
    return false;
  }
}

/**
 * Crea una copia de seguridad de la base de datos
 */
export async function createBackup(
  databaseConfig: DatabaseConfig,
  filename?: string
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = filename || `backup_${databaseConfig.name}_${timestamp}.json`;
  
  await exportDataFromDatabase(databaseConfig, {
    format: 'json',
    filename: backupFilename
  });
}

/**
 * Restaura una base de datos desde una copia de seguridad
 */
export async function restoreFromBackup(
  file: File,
  databaseConfig: DatabaseConfig
): Promise<boolean> {
  return await importDataFromFile(file, databaseConfig, {
    clearBefore: true,
    validate: true
  });
}