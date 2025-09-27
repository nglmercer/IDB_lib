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
 * Tipos base para IDs de elementos
 */
export type DatabaseItemId = string | number;

/**
 * Tipos de datos soportados en propiedades de elementos
 */
export type DatabaseItemValue =
  | string
  | number
  | boolean
  | null
  | DatabaseItemId
  | DatabaseItemValue[]
  | { [key: string]: DatabaseItemValue }
  | unknown;

/**
 * Elemento de datos en la base de datos con mejor type safety
 */
export interface DatabaseItem {
  /** ID único del elemento */
  readonly id: DatabaseItemId;
  /** Timestamp de creación (opcional, se puede agregar automáticamente) */
  readonly createdAt?: number | string;
  /** Timestamp de última actualización (opcional, se puede manejar automáticamente) */
  readonly updatedAt?: number | string;
  /** Propiedades adicionales del elemento con type safety */
  [key: string]: DatabaseItemValue | DatabaseItemId | number | undefined | unknown;
}

/**
 * Elemento para crear nuevos registros (sin ID requerido)
 */
export type CreateDatabaseItem<T extends Record<string, DatabaseItemValue> = Record<string, DatabaseItemValue>> = Omit<DatabaseItem, 'id'> & {
  id?: DatabaseItemId;
} & T;

/**
 * Elemento para actualizar registros (todas las propiedades opcionales excepto ID)
 */
export type UpdateDatabaseItem<T extends Record<string, DatabaseItemValue> = Record<string, DatabaseItemValue>> = Partial<Omit<DatabaseItem, 'id'>> & {
  id: DatabaseItemId;
} & Partial<T>;

/**
 * Configuración de esquema para validación de tipos
 */
export interface DatabaseSchema<T extends Record<string, DatabaseItemValue> = Record<string, DatabaseItemValue>> {
  /** Campos requeridos en el elemento */
  requiredFields: (keyof T)[];
  /** Campos opcionales en el elemento */
  optionalFields: (keyof T)[];
  /** Validadores personalizados para campos específicos */
  validators?: {
    [K in keyof T]?: (value: T[K]) => boolean | string;
  };
  /** Campos que deben ser únicos */
  uniqueFields?: (keyof T)[];
  /** Campos indexados para búsquedas */
  indexedFields?: (keyof T)[];
}

/**
 * Elemento de base de datos tipado específicamente
 */
export type TypedDatabaseItem<T extends Record<string, DatabaseItemValue> = Record<string, DatabaseItemValue>> = DatabaseItem & T;

/**
 * Crear elemento tipado (sin ID requerido)
 */
export type CreateTypedItem<T extends Record<string, DatabaseItemValue> = Record<string, DatabaseItemValue>> = CreateDatabaseItem<T>;

/**
 * Actualizar elemento tipado (ID requerido)
 */
export type UpdateTypedItem<T extends Record<string, DatabaseItemValue> = Record<string, DatabaseItemValue>> = UpdateDatabaseItem<T>;

/**
 * Resultado de búsqueda tipado
 */
export interface TypedSearchResult<T extends Record<string, DatabaseItemValue> = Record<string, DatabaseItemValue>> extends SearchResult<TypedDatabaseItem<T>> {}

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
export type EventCallback<T = EmitEventData> = (data: T) => void;
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

/**
 * Tipos de valores para filtrado
 */
export type FilterValue = string | number | boolean;

/**
 * Criterios de filtrado
 */
export interface FilterCriteria {
  [key: string]: FilterValue;
}

/**
 * Opciones para búsqueda de texto
 */
export interface SearchTextOptions {
  /** Campos específicos para buscar */
  fields?: string[];
}

/**
 * Estadísticas de la base de datos
 */
export interface DatabaseStats {
  /** Número total de registros */
  totalRecords: number;
  /** Nombre del store */
  storeName: string;
  /** Nombre de la base de datos */
  databaseName: string;
  /** Versión de la base de datos */
  version: number;
}
