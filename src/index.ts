// Exportar tipos principales
export type {
  DatabaseConfig,
  DatabaseItem,
  IndexedDBManagerOptions,
  EventCallback,
  EventMap,
  ImportOptions,
  ExportOptions,
  QueryOptions,
  TransactionMode,
  DatabaseSchema,
  StoreSchema,
  TypeValidationSchema
} from './types/index.js';

// Exportar clase principal
export { IndexedDBManager,StoreProxy } from './core/IndexedDBManager.js';
// Exportar utilidades
export {
  normalizeId,
  isValidId,
  findMissingIds,
  generateNextId,
  downloadJSON,
  readJSONFile,
  validateDatabaseConfig,
  createTimestamp,
  debounce,
  throttle,
  convertToCSV
} from './utils/helpers.js';

// Exportar funciones de base de datos
export {
  getAllDataFromDatabase,
  importDataToDatabase,
  exportDataFromDatabase,
  importDataFromFile,
  createBackup,
  restoreFromBackup
} from './utils/database.js';

// Exportar emisor de eventos
export { Emitter } from './core/Emitter.js';

// Crear instancia por defecto para uso directo
import { IndexedDBManager } from './core/IndexedDBManager.js';
import type { DatabaseConfig, IndexedDBManagerOptions } from './types/index.js';

// Configuración por defecto
const defaultConfig: DatabaseConfig = {
  name: 'DefaultDB',
  version: 1,
  store: 'default'
};

/**
 * Instancia por defecto del IndexedDBManager
 * Útil para casos de uso simples donde solo se necesita una instancia
 */
export const defaultManager = new IndexedDBManager(defaultConfig);

/**
 * Función de conveniencia para crear una nueva instancia del manager
 * @param config - Configuración de la base de datos
 * @param options - Opciones adicionales
 * @returns Nueva instancia de IndexedDBManager
 */
export function createManager(config: DatabaseConfig, options?: IndexedDBManagerOptions): IndexedDBManager {
  return new IndexedDBManager(config, options);
}
// Exportación por defecto
export default IndexedDBManager;