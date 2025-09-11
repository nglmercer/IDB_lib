/**
 * Configuración de la base de datos IndexedDB
 */
export interface DatabaseConfig {
  /** Nombre de la base de datos */
  name: string;
  /** Versión de la base de datos */
  version: number;
  /** Nombre del object store */
  store: string;
}

/**
 * Configuración de índices para el object store
 */
export interface DatabaseIndex {
  /** Nombre del índice */
  name: string;
  /** Ruta de la clave del índice */
  keyPath: string | string[];
  /** Si el índice debe ser único */
  unique: boolean;
}

/**
 * Elemento de datos en la base de datos
 */
export interface DatabaseItem {
  /** ID único del elemento */
  id: string | number;
  /** Propiedades adicionales del elemento */
  [key: string]: any;
}

/**
 * Datos del evento emitido
 */
export interface EmitEventData {
  /** Configuración de la base de datos */
  config: DatabaseConfig;
  /** Datos del elemento o ID */
  data: DatabaseItem | number | null;
  /** Metadatos opcionales */
  metadata?: {
    /** Timestamp de la operación */
    timestamp: number | string;
    /** Tipo de operación */
    operation: string;
    /** Número de registros afectados */
    recordCount?: number;
  };
}

/**
 * Tipos de operaciones disponibles
 */
export type OperationType = 'import' | 'export' | 'add' | 'delete' | 'update';

/**
 * Detalle del estado de una operación
 */
export interface OperationStatusDetail {
  /** Mensaje descriptivo */
  message: string;
  /** Tipo de resultado */
  type: 'success' | 'error';
  /** Operación realizada */
  operation: OperationType;
  /** Número de registros procesados */
  recordCount?: number;
}

/**
 * Eventos disponibles del emitter
 */
export type EmitEvents = "add" | "update" | "save" | "delete" | "clear" | "export" | "import";

/**
 * Lista de eventos disponibles
 */
export const EMIT_EVENTS: EmitEvents[] = [
  "update",
  "save", 
  "delete",
  "clear",
  "export",
  "import"
];

// Tipos para el sistema de eventos
export type EventCallback<T = any> = (data: T) => void;
export type EventMap = Record<string, EventCallback>;

// Opciones del IndexedDBManager
export interface IndexedDBManagerOptions {
  storeName?: string;
  enableEvents?: boolean;
  autoInit?: boolean;
  debug?: boolean;
}

/**
 * Opciones para la configuración del IndexedDBManager (legacy)
 */
export interface IndexedDBManagerOptionsLegacy {
  /** Configuración por defecto de la base de datos */
  defaultDatabase?: DatabaseConfig;
  /** Habilitar logs de debug */
  debug?: boolean;
  /** Timeout para operaciones en milisegundos */
  timeout?: number;
  /** Configuración de reintentos */
  retries?: {
    max: number;
    delay: number;
  };
}

/** Opciones para importar datos */
export interface ImportOptions {
  /** Limpiar la base de datos antes de importar */
  clearBefore?: boolean;
  /** Validar datos antes de importar */
  validate?: boolean;
  /** Función para transformar cada elemento antes de importar */
  transform?: (item: any) => DatabaseItem;
}

/** Opciones para exportar datos */
export interface ExportOptions {
  /** Formato de exportación */
  format?: 'json' | 'csv';
  /** Nombre del archivo */
  filename?: string;
  /** Filtros a aplicar a los datos */
  filters?: Record<string, any>;
}

/** Opciones para consultas */
export interface QueryOptions {
  /** Límite de resultados */
  limit?: number;
  /** Offset para paginación */
  offset?: number;
  /** Ordenamiento */
  orderBy?: string;
  /** Dirección del ordenamiento */
  orderDirection?: 'asc' | 'desc';
}

/** Modos de transacción */
export type TransactionMode = 'readonly' | 'readwrite' | 'versionchange';

/**
 * Resultado de una operación de búsqueda
 */
export interface SearchResult<T = DatabaseItem> {
  /** Elementos encontrados */
  items: T[];
  /** Total de elementos */
  total: number;
  /** Página actual */
  page?: number;
  /** Elementos por página */
  limit?: number;
}

/**
 * Opciones para operaciones de búsqueda
 */
export interface SearchOptions {
  /** Límite de resultados */
  limit?: number;
  /** Offset para paginación */
  offset?: number;
  /** Ordenamiento */
  orderBy?: string;
  /** Dirección del ordenamiento */
  orderDirection?: 'asc' | 'desc';
}