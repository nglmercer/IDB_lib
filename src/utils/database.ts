import type { DatabaseConfig, DatabaseItem, ImportOptions, ExportOptions, CreateDatabaseItem } from '../types/index.js';
import { downloadJSON, readJSONFile, convertToCSV } from './helpers.js';
import type { StorageAdapter } from '../adapters/types.js';
import { BrowserAdapter } from '../adapters/browser.js';
import { NodeAdapter } from '../adapters/node.js';

// Detect environment and create default adapter
function getDefaultAdapter(): StorageAdapter {
  if (typeof window === 'undefined') {
    // Node environment
    return new NodeAdapter('./data', { inMemory: true });
  }
  // Browser environment
  return new BrowserAdapter();
}

const defaultAdapter = getDefaultAdapter();

/**
 * Obtiene todos los datos de una base de datos específica
 */
export async function getAllDataFromDatabase(
  databaseConfig: DatabaseConfig,
  adapter: StorageAdapter = defaultAdapter
): Promise<DatabaseItem[]> {
  if (!databaseConfig || !databaseConfig.name || !databaseConfig.version) {
    console.error("Invalid database configuration:", databaseConfig);
    return [];
  }

  try {
    const db = await adapter.openDatabase(databaseConfig.name, databaseConfig.version);
    
    // Ensure store exists
    if (adapter instanceof BrowserAdapter) {
      // Browser: check if store exists
      if (!db.objectStoreNames.contains(databaseConfig.store)) {
        adapter.close(db);
        return [];
      }
    } else if (adapter instanceof NodeAdapter) {
      // Node: ensure store exists
      if (!db.stores.has(databaseConfig.store)) {
        adapter.createObjectStore(db, databaseConfig.store, { keyPath: 'id', autoIncrement: false });
      }
    }

    const result = await adapter.getAll({ db, storeName: databaseConfig.store });
    adapter.close(db);
    return result || [];
  } catch (error) {
    console.error('Error getting data from database:', error);
    return [];
  }
}

/**
 * Importa datos a una base de datos específica
 */
export async function importDataToDatabase(
  databaseConfig: DatabaseConfig,
  data: CreateDatabaseItem[],
  options: ImportOptions = {},
  adapter: StorageAdapter = defaultAdapter
): Promise<boolean> {
  // Validate database configuration first
  if (!databaseConfig || !databaseConfig.name || !databaseConfig.version || !databaseConfig.store) {
    console.error("Invalid database configuration:", databaseConfig);
    return false;
  }

  const { clearBefore = true, validate = true, transform } = options;

  try {
    const db = await adapter.openDatabase(databaseConfig.name, databaseConfig.version);
    
    // Ensure store exists
    if (adapter instanceof NodeAdapter) {
      if (!db.stores.has(databaseConfig.store)) {
        adapter.createObjectStore(db, databaseConfig.store, { keyPath: 'id', autoIncrement: false });
      }
    }

    // Clear if needed
    if (clearBefore) {
      await adapter.clear({ db, storeName: databaseConfig.store });
    }

    // Process data
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

    // Import all data
    for (const item of processedData) {
      try {
        await adapter.put({ db, storeName: databaseConfig.store }, item);
      } catch (error) {
        console.error('Error importing item:', item, error);
      }
    }

    adapter.close(db);
    return true;
  } catch (error) {
    console.error('Error importing data to database:', error);
    return false;
  }
}

/**
 * Exporta datos de una base de datos
 */
export async function exportDataFromDatabase(
  databaseConfig: DatabaseConfig,
  options: ExportOptions = {},
  adapter: StorageAdapter = defaultAdapter
): Promise<void> {
  const { format = 'json', filename, filters } = options;
  
  try {
    let data = await getAllDataFromDatabase(databaseConfig, adapter);
    
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
      
      // Check if we're in browser or Node
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${defaultFilename}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // Node environment - just log or return the data
        console.log('CSV export in Node environment - data:', csvContent.substring(0, 100) + '...');
      }
    } else {
      // Check if we're in browser or Node
      if (typeof window !== 'undefined') {
        downloadJSON(data, `${defaultFilename}.json`);
      } else {
        // Node environment - just log or return the data
        console.log('JSON export in Node environment - data length:', data.length);
      }
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
  options: ImportOptions = {},
  adapter: StorageAdapter = defaultAdapter
): Promise<boolean> {
  try {
    const data = await readJSONFile(file);
    // Ensure data is an array
    const dataArray = Array.isArray(data) ? data : [data];
    return await importDataToDatabase(databaseConfig, dataArray, options, adapter);
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
  filename?: string,
  adapter: StorageAdapter = defaultAdapter
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = filename || `backup_${databaseConfig.name}_${timestamp}.json`;
  
  await exportDataFromDatabase(databaseConfig, {
    format: 'json',
    filename: backupFilename
  }, adapter);
}

/**
 * Restaura una base de datos desde una copia de seguridad
 */
export async function restoreFromBackup(
  file: File,
  databaseConfig: DatabaseConfig,
  adapter: StorageAdapter = defaultAdapter
): Promise<boolean> {
  return await importDataFromFile(file, databaseConfig, {
    clearBefore: true,
    validate: true
  }, adapter);
}