import type { DatabaseConfig, DatabaseItem,DatabaseIndex,DatabaseSchema,StoreSchema } from '../types/index.js';

/**
 * Normaliza un ID para uso consistente en IndexedDB
 * Maneja correctamente el ID 0 y convierte strings numéricos
 */
export function normalizeId(id: string | number): string | number {
  if (typeof id === "string") {
    const trimmedId = id.trim();
    if (trimmedId === "") return id; // String vacío permanece como string
    
    const numValue = Number(trimmedId);
    if (!isNaN(numValue)) {
      // Es un número válido, verificar si es seguro como number
      return numValue > Number.MAX_SAFE_INTEGER ? trimmedId : numValue;
    }
    return trimmedId; // No es un número, mantener como string
  }

  if (typeof id === "number") {
    return id > Number.MAX_SAFE_INTEGER ? String(id) : id;
  }

  return id;
}

/**
 * Valida si un ID es válido para uso en IndexedDB
 */
export function isValidId(id: any): id is string | number {
  if (id === null || id === undefined) {
    return false;
  }
  
  if (typeof id === "string") {
    return id.trim() !== "";
  }
  
  if (typeof id === "number") {
    return Number.isFinite(id);
  }
  
  return false;
}

/**
 * Encuentra IDs faltantes en una secuencia numérica
 */
export function findMissingIds(
  existingIds: (string | number)[] | DatabaseItem[], 
  start?: string | number, 
  end?: string | number
): (string | number)[] {
  // Si se pasa un array de DatabaseItem (formato anterior)
  if (existingIds.length > 0 && typeof existingIds[0] === 'object' && 'id' in existingIds[0]) {
    const items = existingIds as DatabaseItem[];
    const ids = items
      .map((item) => Number(item.id))
      .filter((id) => !isNaN(id))
      .sort((a, b) => a - b);

    const missingIds: number[] = [];
    let expectedId = 0;

    for (const id of ids) {
      while (expectedId < id) {
        missingIds.push(expectedId);
        expectedId++;
      }
      expectedId = id + 1;
    }

    return missingIds;
  }

  // Nuevo formato con start y end
  const ids = existingIds as (string | number)[];
  
  if (start === undefined || end === undefined) {
    return [];
  }

  const missingIds: (string | number)[] = [];
  
  // Manejar IDs numéricos
  if (typeof start === 'number' && typeof end === 'number') {
    const numericIds = ids
      .map(id => Number(id))
      .filter(id => !isNaN(id))
      .sort((a, b) => a - b);
    
    for (let i = start; i <= end; i++) {
      if (!numericIds.includes(i)) {
        missingIds.push(i);
      }
    }
  }
  // Manejar IDs string (secuencia alfabética)
  else if (typeof start === 'string' && typeof end === 'string') {
    const startCode = start.charCodeAt(0);
    const endCode = end.charCodeAt(0);
    
    for (let i = startCode; i <= endCode; i++) {
      const char = String.fromCharCode(i);
      if (!ids.includes(char)) {
        missingIds.push(char);
      }
    }
  }

  return missingIds;
}

/**
 * Genera el siguiente ID disponible en una secuencia
 */
export function generateNextId(allData: DatabaseItem[] | (string | number)[]): string | number {
  // Si es un array de DatabaseItem
  if (allData.length > 0 && typeof allData[0] === 'object' && 'id' in allData[0]) {
    const items = allData as DatabaseItem[];
    const numericIds = items
      .map((item) => Number(item.id))
      .filter((id) => !isNaN(id) && Number.isFinite(id))
      .sort((a, b) => a - b);

    if (numericIds.length === 0) return 1;

    // Buscar el primer hueco disponible o usar max + 1
    for (let i = 1; i <= numericIds.length; i++) {
      if (!numericIds.includes(i)) {
        return i;
      }
    }
    
    return Math.max(...numericIds) + 1;
  }

  // Si es un array de IDs directos
  const ids = allData as (string | number)[];
  
  if (ids.length === 0) return 1;

  // Si todos son números
  const numericIds = ids
    .map(id => Number(id))
    .filter(id => !isNaN(id) && Number.isFinite(id));

  if (numericIds.length === ids.length) {
    const sortedIds = numericIds.sort((a, b) => a - b);
    return Math.max(...sortedIds) + 1;
  }

  // Si son strings, generar UUID
  if (ids.every(id => typeof id === 'string')) {
    return crypto.randomUUID();
  }

  return 1;
}

/**
 * Descarga datos como archivo JSON
 */
export function downloadJSON(data: any[], filename: string): void {
  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Lee un archivo JSON y retorna los datos parseados
 */
export function readJSONFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse((e.target as FileReader).result as string);
        resolve(data);
      } catch (error) {
        reject(new Error('El archivo no es un JSON válido'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file);
  });
}

export function validateDatabaseConfig(config: any): config is DatabaseConfig {
  return (
    config &&
    typeof config === 'object' &&
    typeof config.name === 'string' &&
    config.name.trim() !== '' &&
    typeof config.version === 'number' &&
    config.version > 0 &&
    typeof config.store === 'string' &&
    config.store.trim() !== ''
  );
}

// Validate StoreSchema
export function validateStoreSchema(storeConfig: any): storeConfig is StoreSchema {
  if (!storeConfig || typeof storeConfig !== 'object') {
    return false;
  }

  // Required: name
  if (typeof storeConfig.name !== 'string' || storeConfig.name.trim() === '') {
    return false;
  }

  // Optional: keyPath
  if (storeConfig.keyPath !== undefined && typeof storeConfig.keyPath !== 'string') {
    return false;
  }

  // Optional: autoIncrement
  if (storeConfig.autoIncrement !== undefined && typeof storeConfig.autoIncrement !== 'boolean') {
    return false;
  }

  // Optional: indexes
  if (storeConfig.indexes !== undefined) {
    if (!Array.isArray(storeConfig.indexes)) {
      return false;
    }
    
    return storeConfig.indexes.every((index: any) => validateDatabaseIndex(index));
  }

  return true;
}

// Validate DatabaseSchema
export function validateDatabaseSchema(schema: any): schema is DatabaseSchema {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  // Required: name
  if (typeof schema.name !== 'string' || schema.name.trim() === '') {
    return false;
  }

  // Required: version
  if (typeof schema.version !== 'number' || schema.version <= 0) {
    return false;
  }

  // Required: stores (array with at least one store)
  if (!Array.isArray(schema.stores) || schema.stores.length === 0) {
    return false;
  }

  // Validate each store configuration
  return schema.stores.every((store: any) => validateStoreSchema(store));
}

// Validate DatabaseIndex
export function validateDatabaseIndex(index: any): index is DatabaseIndex {
  if (!index || typeof index !== 'object') {
    return false;
  }

  // Required: name
  if (typeof index.name !== 'string' || index.name.trim() === '') {
    return false;
  }

  // Required: keyPath
  if (typeof index.keyPath !== 'string' || index.keyPath.trim() === '') {
    return false;
  }

  // Optional: unique
  if (index.unique !== undefined && typeof index.unique !== 'boolean') {
    return false;
  }

  return true;
}

// Enhanced validator that handles all configuration types used in IndexedDBManager
export function validateAnyDatabaseConfig(config: any): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Check if it's a DatabaseSchema (has 'stores' property)
  if ('stores' in config) {
    return validateDatabaseSchema(config);
  }

  // Check if it's a wrapper object with 'defaultDatabase' property
  if ('defaultDatabase' in config) {
    return validateDatabaseConfig(config.defaultDatabase);
  }

  // Check if it's a direct DatabaseConfig
  return validateDatabaseConfig(config);
}

// Utility to determine configuration type
export function getConfigurationType(config: any): 'schema' | 'config' | 'wrapper' | 'invalid' {
  if (!config || typeof config !== 'object') {
    return 'invalid';
  }

  if ('stores' in config && validateDatabaseSchema(config)) {
    return 'schema';
  }

  if ('defaultDatabase' in config && validateDatabaseConfig(config.defaultDatabase)) {
    return 'wrapper';
  }

  if (validateDatabaseConfig(config)) {
    return 'config';
  }

  return 'invalid';
}
/**
 * timestamp 
 */
export function createTimestamp(date?: Date): string {
  const targetDate = date || new Date();
  return targetDate.toISOString();
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait) as unknown as number;
  };
}

/**
 * Throttle function para limitar la frecuencia de ejecución
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Convierte datos a CSV
 */
export function convertToCSV(data: DatabaseItem[]): string {
  if (data.length === 0) {
    return '';
  }
  
  // Usar el orden de propiedades del primer objeto, luego agregar las demás ordenadas
  const firstItemHeaders = data[0] && typeof data[0] === 'object' ? Object.keys(data[0]) : [];
  const allHeaders = new Set<string>();
  data.forEach(item => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach(key => allHeaders.add(key));
    }
  });
  
  // Mantener el orden del primer objeto, luego agregar las propiedades restantes ordenadas
  const remainingHeaders = Array.from(allHeaders).filter(h => !firstItemHeaders.includes(h)).sort();
  const headers = [...firstItemHeaders, ...remainingHeaders];
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(item => {
    return headers.map(header => {
      const value = item?.[header] ?? '';
      // Escapar comillas y envolver en comillas si contiene comas
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}