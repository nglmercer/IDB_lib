import { describe, it, expect, beforeEach } from 'bun:test';
import { Emitter } from '../../src/core/Emitter.js';

describe('Core > Emitter', () => {
  let emitter: Emitter;

  beforeEach(() => {
    emitter = new Emitter();
  });

  describe('on()', () => {
    it('debería suscribirse a un evento correctamente', () => {
      const callback = (data: any) => {};
      emitter.on('test', callback);
      expect(emitter.listenerCount('test')).toBe(1);
    });

    it('debería permitir múltiples callbacks para el mismo evento', () => {
      const callback1 = (data: any) => {};
      const callback2 = (data: any) => {};
      emitter.on('test', callback1);
      emitter.on('test', callback2);
      expect(emitter.listenerCount('test')).toBe(2);
    });
  });

  describe('once()', () => {
    it('debería ejecutar el callback solo una vez', () => {
      let callCount = 0;
      const callback = () => callCount++;
      
      emitter.once('test', callback);
      emitter.emit('test');
      emitter.emit('test');
      emitter.emit('test');
      
      expect(callCount).toBe(1);
    });

    it('debería pasar datos correctamente al callback', () => {
      let receivedData: any = null;
      
      emitter.once('test', (data) => {
        receivedData = data;
      });
      
      emitter.emit('test', { value: 42 });
      
      expect(receivedData).toEqual({ value: 42 });
    });

    it('debería auto-removerse después de ejecutarse', () => {
      const callback = () => {};
      
      emitter.once('test', callback);
      expect(emitter.listenerCount('test')).toBe(1);
      
      emitter.emit('test');
      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('off()', () => {
    it('debería desuscribirse de un evento específico', () => {
      const callback = () => {};
      emitter.on('test', callback);
      
      emitter.off('test', callback);
      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('debería remover todos los callbacks si no se especifica callback', () => {
      const callback1 = () => {};
      const callback2 = () => {};
      emitter.on('test', callback1);
      emitter.on('test', callback2);
      
      emitter.off('test');
      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('debería no lanzar error si el evento no existe', () => {
      expect(() => emitter.off('nonexistent')).not.toThrow();
    });

    it('debería manejar intentos de remover callback inexistente', () => {
      emitter.on('test', () => {});
      const nonExistentCallback = () => {};
      
      emitter.off('test', nonExistentCallback);
      expect(emitter.listenerCount('test')).toBe(1);
    });
  });

  describe('emit()', () => {
    it('debería emitir un evento a todos los listeners', () => {
      let count1 = 0;
      let count2 = 0;
      
      emitter.on('test', () => count1++);
      emitter.on('test', () => count2++);
      
      emitter.emit('test');
      
      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('debería pasar datos a todos los listeners', () => {
      const receivedData: any[] = [];
      
      emitter.on('test', (data) => receivedData.push(data));
      emitter.on('test', (data) => receivedData.push(data));
      
      emitter.emit('test', { value: 'hello' });
      
      expect(receivedData).toEqual([{ value: 'hello' }, { value: 'hello' }]);
    });

    it('debería manejar errores en listeners sin bloquear otros listeners', () => {
      let errorCallCount = 0;
      let normalCallCount = 0;
      
      emitter.on('test', () => {
        throw new Error('Test error');
      });
      emitter.on('test', () => normalCallCount++);
      
      // Debería lanzar a consola pero no throw
      emitter.emit('test');
      
      expect(normalCallCount).toBe(1);
    });

    it('debería no lanzar error si el evento no tiene listeners', () => {
      expect(() => emitter.emit('nonexistent')).not.toThrow();
    });

    it('debería crear copia del array de listeners para evitar problemas de modificación', () => {
      let callCount = 0;
      
      const callback1 = () => {
        callCount++;
        emitter.off('test', callback2); // Remover otro listener durante emit
      };
      const callback2 = () => {
        callCount++;
      };
      
      emitter.on('test', callback1);
      emitter.on('test', callback2);
      
      emitter.emit('test');
      
      // Ambos callbacks deben ejecutarse
      expect(callCount).toBe(2);
    });
  });

  describe('getEvents()', () => {
    it('debería devolver lista de eventos registrados', () => {
      emitter.on('event1', () => {});
      emitter.on('event2', () => {});
      
      const events = emitter.getEvents();
      
      expect(events).toContain('event1');
      expect(events).toContain('event2');
    });

    it('debería devolver array vacío si no hay eventos', () => {
      const events = emitter.getEvents();
      expect(events).toEqual([]);
    });
  });

  describe('listenerCount()', () => {
    it('debería devolver 0 para eventos sin listeners', () => {
      expect(emitter.listenerCount('nonexistent')).toBe(0);
    });

    it('debería devolver el número correcto de listeners', () => {
      emitter.on('test', () => {});
      emitter.on('test', () => {});
      emitter.on('test', () => {});
      
      expect(emitter.listenerCount('test')).toBe(3);
    });
  });

  describe('removeAllListeners()', () => {
    it('debería remover todos los listeners de todos los eventos', () => {
      emitter.on('event1', () => {});
      emitter.on('event1', () => {});
      emitter.on('event2', () => {});
      
      emitter.removeAllListeners();
      
      expect(emitter.listenerCount('event1')).toBe(0);
      expect(emitter.listenerCount('event2')).toBe(0);
      expect(emitter.getEvents()).toEqual([]);
    });
  });

  describe('hasListeners()', () => {
    it('debería devolver false para eventos sin listeners', () => {
      expect(emitter.hasListeners('nonexistent')).toBe(false);
    });

    it('debería devolver true si hay listeners registrados', () => {
      emitter.on('test', () => {});
      expect(emitter.hasListeners('test')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('debería manejar múltiples suscripciones y emisiones', () => {
      const results: any[] = [];
      
      for (let i = 0; i < 5; i++) {
        emitter.on('test', (data) => results.push(data));
      }
      
      emitter.emit('test', 1);
      emitter.emit('test', 2);
      
      expect(results).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    });

    it('debería mantener el orden de ejecución de los listeners', () => {
      const order: number[] = [];
      
      emitter.on('test', () => order.push(1));
      emitter.on('test', () => order.push(2));
      emitter.on('test', () => order.push(3));
      
      emitter.emit('test');
      
      expect(order).toEqual([1, 2, 3]);
    });
  });
});

describe('Core > Emitter (singleton)', () => {
  it('debería exportar una instancia por defecto', () => {
    const { emitter } = require('../../src/core/Emitter.js');
    expect(emitter).toBeDefined();
    expect(typeof emitter.on).toBe('function');
    expect(typeof emitter.emit).toBe('function');
  });
});
