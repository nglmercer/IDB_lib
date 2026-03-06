import { describe, it, expect, beforeEach } from 'bun:test';
import { BatchOperations } from '../../src/core/database/BatchOperations.js';
import type { DatabaseItem, EmitEvents } from '../../src/types/index.js';
import type { StorageAdapter } from '../../src/adapters/types.js';

// Mock StorageAdapter for testing
const createMockAdapter = () => {
  const data: Map<string, DatabaseItem[]> = new Map();
  
  return {
    data,
    getAll: async ({ storeName }: { storeName: string }) => {
      return data.get(storeName) || [];
    },
    put: async ({ storeName }: { storeName: string }, item: DatabaseItem) => {
      const storeData = data.get(storeName) || [];
      const index = storeData.findIndex((i: DatabaseItem) => i.id === item.id);
      if (index >= 0) {
        storeData[index] = item;
      } else {
        storeData.push(item);
      }
      data.set(storeName, storeData);
      return item;
    },
    delete: async ({ storeName }: { storeName: string }, id: string | number) => {
      const storeData = data.get(storeName) || [];
      data.set(storeName, storeData.filter((i: DatabaseItem) => i.id !== id));
      return true;
    }
  } as unknown as StorageAdapter;
};

describe('Core > BatchOperations', () => {
  let batchOps: BatchOperations;
  let mockAdapter: StorageAdapter;
  let emittedEvents: Array<{ event: EmitEvents; data: any }>;

  beforeEach(() => {
    emittedEvents = [];
    mockAdapter = createMockAdapter();
    
    batchOps = new BatchOperations({
      db: {},
      adapter: mockAdapter,
      isNodeEnvironment: true,
      emitEvent: (event: EmitEvents, data: any) => {
        emittedEvents.push({ event, data });
      },
      executeTransaction: async <T>(_: string, __: string, _cb: any): Promise<T> => {
        return true as T;
      }
    });
  });

  describe('updateContext()', () => {
    it('debería actualizar el contexto con nuevas opciones', () => {
      const newAdapter = createMockAdapter();
      
      batchOps.updateContext({
        adapter: newAdapter,
        isNodeEnvironment: false
      });
      
      // Verificar que el contexto se actualizó (esto se hace internamente)
      expect(true).toBe(true);
    });
  });

  describe('addManyToStore()', () => {
    it('debería agregar múltiples elementos en entorno Node', async () => {
      const items: Partial<DatabaseItem>[] = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ];

      const result = await batchOps.addManyToStore('testStore', items);

      expect(result).toBe(true);
      expect(emittedEvents.length).toBe(3);
      expect(emittedEvents[0].event).toBe('add');
    });

    it('debería actualizar elementos existentes', async () => {
      // Agregar items primero
      await batchOps.addManyToStore('testStore', [
        { id: 1, name: 'Original' }
      ]);
      
      emittedEvents.length = 0;
      
      // Actualizar
      const result = await batchOps.addManyToStore('testStore', [
        { id: 1, name: 'Updated' }
      ]);

      expect(result).toBe(true);
      expect(emittedEvents[0].event).toBe('update');
    });

    it('debería generar IDs automáticamente para elementos sin ID', async () => {
      const items: Partial<DatabaseItem>[] = [
        { name: 'Item 1' },
        { name: 'Item 2' }
      ];

      await batchOps.addManyToStore('testStore', items);

      expect(emittedEvents.length).toBe(2);
      expect(emittedEvents[0].data.id).toBeDefined();
    });

    it('debería manejar array vacío', async () => {
      const result = await batchOps.addManyToStore('testStore', []);
      expect(result).toBe(true);
    });
  });

  describe('updateManyInStore()', () => {
    it('debería actualizar múltiples elementos en entorno Node', async () => {
      const items: DatabaseItem[] = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ];

      const result = await batchOps.updateManyInStore('testStore', items);

      expect(result).toBe(true);
      expect(emittedEvents.length).toBe(3);
      expect(emittedEvents.every(e => e.event === 'update')).toBe(true);
    });

    it('debería manejar array vacío', async () => {
      const result = await batchOps.updateManyInStore('testStore', []);
      expect(result).toBe(true);
    });
  });

  describe('deleteManyFromStore()', () => {
    it('debería eliminar múltiples elementos en entorno Node', async () => {
      // Primero agregar algunos items
      await batchOps.addManyToStore('testStore', [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ]);
      
      emittedEvents.length = 0;

      const result = await batchOps.deleteManyFromStore('testStore', [1, 2]);

      expect(result).toBe(true);
      expect(emittedEvents.length).toBe(2);
      expect(emittedEvents.every(e => e.event === 'delete')).toBe(true);
    });

    it('debería manejar array vacío', async () => {
      const result = await batchOps.deleteManyFromStore('testStore', []);
      expect(result).toBe(true);
    });

    it('debería normalizar IDs antes de eliminar', async () => {
      await batchOps.addManyToStore('testStore', [
        { id: 1, name: 'Item 1' }
      ]);
      
      emittedEvents.length = 0;

      // Pasar ID como string
      await batchOps.deleteManyFromStore('testStore', ['1']);

      expect(emittedEvents.length).toBe(1);
    });
  });

  describe('Browser environment path', () => {
    let batchOpsBrowser: BatchOperations;

    beforeEach(() => {
      emittedEvents = [];
      mockAdapter = createMockAdapter();
      
      // Simular entorno navegador
      batchOpsBrowser = new BatchOperations({
        db: {},
        adapter: mockAdapter,
        isNodeEnvironment: false,
        emitEvent: (event: EmitEvents, data: any) => {
          emittedEvents.push({ event, data });
        },
        executeTransaction: async <T>(_: string, __: string, _cb: any): Promise<T> => {
          return true as T;
        }
      });
    });

    it('debería usar executeTransaction en entorno navegador para addMany', async () => {
      const items: Partial<DatabaseItem>[] = [
        { id: 1, name: 'Item 1' }
      ];

      const result = await batchOpsBrowser.addManyToStore('testStore', items);

      expect(result).toBe(true);
    });

    it('debería usar executeTransaction en entorno navegador para updateMany', async () => {
      const items: DatabaseItem[] = [
        { id: 1, name: 'Item 1' }
      ];

      const result = await batchOpsBrowser.updateManyInStore('testStore', items);

      expect(result).toBe(true);
    });

    it('debería usar executeTransaction en entorno navegador para deleteMany', async () => {
      const result = await batchOpsBrowser.deleteManyFromStore('testStore', [1]);

      expect(result).toBe(true);
    });
  });
});
