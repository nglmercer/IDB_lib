/**
 * Tipo de función de callback para eventos
 */
type EventCallback<T = unknown> = (data: T) => void;

/**
 * Mapa de eventos y sus callbacks
 */
type EventMap = Record<string, EventCallback[]>;

/**
 * Emitter de eventos simple y eficiente
 * Implementación propia sin dependencias externas
 */
export class Emitter {
  private events: EventMap = {};

  /**
   * Suscribirse a un evento
   * @param event Nombre del evento
   * @param callback Función callback a ejecutar
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback as EventCallback);
  }

  /**
   * Suscribirse a un evento una sola vez
   * @param event Nombre del evento
   * @param callback Función callback a ejecutar
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): void {
    const onceCallback = (data: T) => {
      callback(data);
      this.off(event, onceCallback as EventCallback);
    };
    this.on(event, onceCallback);
  }

  /**
   * Desuscribirse de un evento
   * @param event Nombre del evento
   * @param callback Función callback a remover (opcional)
   */
  off(event: string, callback?: EventCallback): void {
    if (!this.events[event]) return;

    if (callback) {
      const index = this.events[event].indexOf(callback);
      if (index > -1) {
        this.events[event].splice(index, 1);
      }
    } else {
      // Si no se especifica callback, remover todos
      delete this.events[event];
    }
  }

  /**
   * Emitir un evento
   * @param event Nombre del evento
   * @param data Datos a enviar
   */
  emit<T = any>(event: string, data?: T): void {
    if (!this.events[event]) return;

    // Crear una copia del array para evitar problemas si se modifican los listeners durante la emisión
    const callbacks = [...this.events[event]];
    
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
  }

  /**
   * Obtener todos los eventos registrados
   */
  getEvents(): string[] {
    return Object.keys(this.events);
  }

  /**
   * Obtener el número de listeners para un evento
   * @param event Nombre del evento
   */
  listenerCount(event: string): number {
    return this.events[event]?.length || 0;
  }

  /**
   * Remover todos los listeners de todos los eventos
   */
  removeAllListeners(): void {
    this.events = {};
  }

  /**
   * Verificar si hay listeners para un evento
   * @param event Nombre del evento
   */
  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0;
  }
}

/**
 * Instancia global del emitter
 */
export const emitter = new Emitter();

/**
 * Exportación por defecto
 */
export default Emitter;
