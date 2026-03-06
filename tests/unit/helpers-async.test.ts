import { describe, it, expect } from 'bun:test';
import { debounce, throttle, createTimestamp } from '../../src/utils/helpers.js';
import { waitForAsync } from '../setup.js';

describe('Helpers > Async', () => {
  describe('createTimestamp', () => {
    it('debería crear timestamp en formato ISO', () => {
      const timestamp = createTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('debería crear timestamp para fecha específica', () => {
      const date = new Date('2023-01-01T12:00:00.000Z');
      const timestamp = createTimestamp(date);
      expect(timestamp).toBe('2023-01-01T12:00:00.000Z');
    });
  });

  describe('debounce', () => {
    it('debería retrasar la ejecución de la función', async () => {
      let callCount = 0;
      const fn = () => callCount++;
      const debouncedFn = debounce(fn, 50);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(callCount).toBe(0);

      await waitForAsync(60);
      expect(callCount).toBe(1);
    });

    it('debería pasar argumentos correctamente', async () => {
      let lastArgs: any[] = [];
      const fn = (...args: any[]) => {
        lastArgs = args;
      };
      const debouncedFn = debounce(fn, 50);

      debouncedFn('a', 'b', 'c');
      await waitForAsync(60);

      expect(lastArgs).toEqual(['a', 'b', 'c']);
    });

    it('debería cancelar ejecuciones previas', async () => {
      let callCount = 0;
      const fn = () => callCount++;
      const debouncedFn = debounce(fn, 50);

      debouncedFn();
      await waitForAsync(25);
      debouncedFn();
      await waitForAsync(25);
      debouncedFn();
      await waitForAsync(60);

      expect(callCount).toBe(1);
    });
  });

  describe('throttle', () => {
    it('debería limitar la frecuencia de ejecución', async () => {
      let callCount = 0;
      const fn = () => callCount++;
      const throttledFn = throttle(fn, 50);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(callCount).toBe(1);

      await waitForAsync(60);
      throttledFn();
      expect(callCount).toBe(2);
    });

    it('debería ejecutar inmediatamente la primera llamada', () => {
      let callCount = 0;
      const fn = () => callCount++;
      const throttledFn = throttle(fn, 50);

      throttledFn();
      expect(callCount).toBe(1);
    });

    it('debería pasar argumentos de la primera llamada', async () => {
      let lastArgs: any[] = [];
      const fn = (...args: any[]) => {
        lastArgs = args;
      };
      const throttledFn = throttle(fn, 50);

      throttledFn('first');
      throttledFn('second');
      throttledFn('third');

      expect(lastArgs).toEqual(['first']);
    });
  });
});
