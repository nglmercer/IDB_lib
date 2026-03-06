import { describe, it, expect } from 'bun:test';
import { convertToCSV } from '../../src/utils/helpers.js';

describe('Helpers > CSV', () => {
  describe('convertToCSV', () => {
    it('debería convertir array de objetos a CSV', () => {
      const data = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 },
        { id: 3, name: 'Bob', age: 35 }
      ];

      const csv = convertToCSV(data);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('id,name,age');
      expect(lines[1]).toBe('1,John,30');
      expect(lines[2]).toBe('2,Jane,25');
      expect(lines[3]).toBe('3,Bob,35');
    });

    it('debería manejar valores con comas', () => {
      const data = [
        { id: 1, description: 'Item with, comma' }
      ];

      const csv = convertToCSV(data);
      expect(csv).toContain('"Item with, comma"');
    });

    it('debería manejar valores con comillas', () => {
      const data = [
        { id: 1, description: 'Item with "quotes"' }
      ];

      const csv = convertToCSV(data);
      expect(csv).toContain('"Item with ""quotes"""');
    });

    it('debería manejar arrays vacíos', () => {
      const csv = convertToCSV([]);
      expect(csv).toBe('');
    });

    it('debería manejar objetos con propiedades diferentes', () => {
      const data = [
        { id: 1, name: 'John' },
        { id: 2, age: 25 },
        { id: 3, name: 'Bob', age: 35, city: 'NYC' }
      ];

      const csv = convertToCSV(data);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('id,name,age,city');
      expect(lines[1]).toBe('1,John,,');
      expect(lines[2]).toBe('2,,25,');
      expect(lines[3]).toBe('3,Bob,35,NYC');
    });

    it('debería manejar valores null y undefined', () => {
      const data = [
        { id: 1, name: null, age: undefined, active: true }
      ];

      const csv = convertToCSV(data);
      expect(csv).toContain('1,,,true');
    });
  });
});
