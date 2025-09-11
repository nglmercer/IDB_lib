import { describe, it, expect, beforeEach } from 'bun:test';
import '../setup.js'; // Importar setup para configurar mocks
import { IndexedDBManager } from '../../src/core/IndexedDBManager.js';
import {
  getAllDataFromDatabase,
  importDataToDatabase,
  exportDataFromDatabase,
  importDataFromFile,
  createBackup,
  restoreFromBackup
} from '../../src/utils/database.js';
import type { DatabaseConfig } from '../../src/types/index.js';
import { waitForAsync, createTestData, createMockFile } from '../setup.js';

describe('Database Operations Integration', () => {
  let manager: IndexedDBManager;
  let testConfig: DatabaseConfig;

  beforeEach(async () => {
    testConfig = {
      name: 'IntegrationTestDB',
      version: 1,
      store: 'integrationStore',
    };
    
    manager = new IndexedDBManager({
      defaultDatabase: testConfig,
    },{debug:true});
    
    // Clear database before each test
    await manager.setDatabase(testConfig);
    await waitForAsync();
    await manager.clearDatabase();
    await waitForAsync();
  });

  describe('Flujo completo de datos', () => {
    it('debería realizar operaciones CRUD completas', async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();

      // Crear datos iniciales
      const initialData = createTestData(5);
      const addResult = await manager.addMany(initialData);
      expect(addResult).toBe(true);

      // Verificar que se agregaron correctamente
      const allItems = await manager.getAll();
      expect(allItems).toHaveLength(5);

      // Actualizar algunos elementos
      const updatedItems = allItems.slice(0, 2).map(item => ({
        ...item,
        name: `Updated ${item.name}`
      }));
      
      const updateResult = await manager.updateMany(updatedItems);
      expect(updateResult).toBe(true);

      // Verificar actualizaciones
      const updatedData = await manager.getAll();
      const updatedCount = updatedData.filter(item => 
        item.name.startsWith('Updated')
      ).length;
      expect(updatedCount).toBe(2);

      // Eliminar algunos elementos
      const idsToDelete = [1, 3];
      const deleteResult = await manager.deleteMany(idsToDelete);
      expect(deleteResult).toBe(true);

      // Verificar eliminaciones
      const finalCount = await manager.count();
      expect(finalCount).toBe(3);

      // Buscar elementos
      const searchResults = await manager.search('Test');
      expect(searchResults.length).toBeGreaterThan(0);

      // Filtrar elementos
      const filterResults = await manager.filter({
        id: 2
      });
      expect(filterResults).toHaveLength(1);
      expect(filterResults[0].id).toBe(2);
    });

    it('debería manejar transacciones complejas', async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();

      // Agregar datos iniciales
      const testData = createTestData(10);
      await manager.addMany(testData);
      await waitForAsync();

      // Realizar múltiples operaciones
      const promises = [
        manager.update({ id: 1, name: 'Updated Item 1', value: 999 }),
        manager.delete(2),
        manager.add({ id: 11, name: 'New Item', value: 100 }),
        manager.get(3)
      ];

      const results = await Promise.all(promises);
      
      expect(results[0]).toBeTruthy(); // update returns DatabaseItem
      expect(results[1]).toBe(true); // delete returns boolean
      expect(results[2]).toBeTruthy(); // add returns DatabaseItem
      expect(results[3]).toBeDefined(); // get

      // Verificar estado final
      const finalData = await manager.getAll();
      expect(finalData).toHaveLength(10); // 10 originales - 1 eliminado + 1 nuevo
      
      const updatedItem = finalData.find(item => item.id === 1);
      expect(updatedItem?.name).toBe('Updated Item 1');
      expect(updatedItem?.value).toBe(999);

      const newItem = finalData.find(item => item.id === 11);
      expect(newItem).toBeDefined();
      expect(newItem?.name).toBe('New Item');

      const deletedItem = finalData.find(item => item.id === 2);
      expect(deletedItem).toBeUndefined();
    });
  });

  describe('Importación y exportación', () => {
    beforeEach(async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();
    });

    it('debería exportar e importar datos correctamente', async () => {
      // Agregar datos de prueba
      const testData = createTestData(5);
      await manager.addMany(testData);
      await waitForAsync();

      // Obtener todos los datos
      const exportedData = await getAllDataFromDatabase(testConfig);
      expect(exportedData).toHaveLength(5);
      expect(exportedData).toEqual(expect.arrayContaining(testData));

      // Limpiar la base de datos
      await manager.clear();
      await waitForAsync();

      // Verificar que está vacía
      let count = await manager.count();
      expect(count).toBe(0);

      // Importar los datos de vuelta
      const importResult = await importDataToDatabase(testConfig, exportedData);
      expect(importResult).toBe(true);
      await waitForAsync();

      // Verificar que se importaron correctamente
      count = await manager.count();
      expect(count).toBe(5);

      const importedData = await manager.getAll();
      expect(importedData).toEqual(expect.arrayContaining(testData));
    });

    it('debería importar desde archivo', async () => {
      const testData = createTestData(3);
      const fileContent = JSON.stringify(testData);
      const mockFile = createMockFile(fileContent, 'test-data.json');

      const importResult = await importDataFromFile(mockFile, testConfig);
      expect(importResult).toBe(true);
      await waitForAsync();

      const importedData = await manager.getAll();
      expect(importedData).toHaveLength(3);
      expect(importedData).toEqual(expect.arrayContaining(testData));
    });

    it('debería manejar importación con validación', async () => {
      const mixedData = [
        { id: 1, name: 'Valid Item', value: 100 },
        { name: 'Invalid Item' }, // Sin ID
        null, // Elemento nulo
        { id: 2, name: 'Another Valid Item', value: 200 }
      ];

      const importResult = await importDataToDatabase(testConfig, mixedData, {
        validate: true,
        clearBefore: true
      });
      expect(importResult).toBe(true);
      await waitForAsync();

      const importedData = await manager.getAll();
      expect(importedData).toHaveLength(2); // Solo los elementos válidos
      expect(importedData.every(item => item.id !== undefined)).toBe(true);
    });

    it('debería transformar datos durante la importación', async () => {
      const rawData = [
        { id: 1, title: 'Item 1', cost: 10 },
        { id: 2, title: 'Item 2', cost: 20 }
      ];

      const importResult = await importDataToDatabase(testConfig, rawData, {
        transform: (item: any) => ({
          id: item.id,
          name: item.title, // Cambiar 'title' por 'name'
          value: item.cost * 2, // Duplicar el costo
          transformed: true
        })
      });
      expect(importResult).toBe(true);
      await waitForAsync();

      const importedData = await manager.getAll();
      expect(importedData).toHaveLength(2);
      expect(importedData[0].name).toBe('Item 1');
      expect(importedData[0].value).toBe(20);
      expect(importedData[0].transformed).toBe(true);
    });
  });

  describe('Backup y restauración', () => {
    beforeEach(async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();
    });

    it('debería crear y restaurar backup', async () => {
      // Agregar datos de prueba
      const testData = createTestData(5);
      await manager.addMany(testData);
      await waitForAsync();

      // Simular creación de backup (en el entorno real descargaría un archivo)
      const backupData = await getAllDataFromDatabase(testConfig);
      expect(backupData).toHaveLength(5);

      // Modificar los datos originales
      await manager.clear();
      await manager.add({ id: 999, name: 'New Item', value: 999 });
      await waitForAsync();

      let currentCount = await manager.count();
      expect(currentCount).toBe(1);

      // Restaurar desde backup
      const backupFile = createMockFile(JSON.stringify(backupData), 'backup.json');
      const restoreResult = await restoreFromBackup(backupFile, testConfig);
      expect(restoreResult).toBe(true);
      await waitForAsync();

      // Verificar restauración
      currentCount = await manager.count();
      expect(currentCount).toBe(5);

      const restoredData = await manager.getAll();
      expect(restoredData).toEqual(expect.arrayContaining(testData));

      // Verificar que el elemento nuevo fue reemplazado
      const newItem = restoredData.find(item => item.id === 999);
      expect(newItem).toBeUndefined();
    });
  });

  describe('Manejo de errores en integración', () => {
    it('debería manejar errores de configuración inválida', async () => {
      const invalidConfig = {
        name: '',
        version: 0,
        store: ''
      } as DatabaseConfig;

      const data = await getAllDataFromDatabase(invalidConfig);
      expect(data).toEqual([]);

      const importResult = await importDataToDatabase(invalidConfig, []);
      expect(importResult).toBe(false);
    });

    it('debería manejar archivos de importación inválidos', async () => {
      const invalidFile = createMockFile('invalid json content', 'invalid.json');
      
      const importResult = await importDataFromFile(invalidFile, testConfig);
      expect(importResult).toBe(false);
    });

    it('debería manejar operaciones concurrentes', async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();

      // Ejecutar múltiples operaciones concurrentes
      const promises = Array.from({ length: 10 }, (_, i) => 
        manager.add({ id: i + 1, name: `Item ${i + 1}`, value: i * 10 })
      );

      const results = await Promise.all(promises);
      
      // Todas las operaciones deberían completarse (add devuelve DatabaseItem, no boolean)
      expect(results.every(result => result && typeof result === 'object')).toBe(true);

      // Verificar que todos los elementos se agregaron
      const count = await manager.count();
      expect(count).toBe(10);
    });
  });

  describe('Eventos en operaciones complejas', () => {
    beforeEach(async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();
    });

    it('debería emitir eventos durante operaciones por lotes', async () => {
      const events: string[] = [];
      
      manager.on('add', () => events.push('add'));
      manager.on('update', () => events.push('update'));
      manager.on('delete', () => events.push('delete'));

      // Operaciones por lotes
      const testData = createTestData(3);
      await manager.addMany(testData);
      await waitForAsync();

      await manager.updateMany(testData.map(item => ({
        ...item,
        name: `Updated ${item.name}`
      })));
      await waitForAsync();

      await manager.deleteMany([1, 2]);
      await waitForAsync();

      // Verificar que se emitieron los eventos
      expect(events.filter(e => e === 'add').length).toBe(3);
      expect(events.filter(e => e === 'update').length).toBe(3);
      expect(events.filter(e => e === 'delete').length).toBe(2);
    });
  });
});