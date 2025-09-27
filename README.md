# IndexedDB Manager Library

Una librería moderna y robusta para gestionar IndexedDB en el navegador, construida con TypeScript y Bun.

## 🚀 Características

- ✅ **TypeScript nativo** - Tipado completo y seguridad de tipos
- ✅ **Sistema de eventos** - Emitter integrado para reactividad en tiempo real
- ✅ **Gestión inteligente de IDs** - Manejo automático de IDs numéricos y string
- ✅ **Transacciones seguras** - Manejo robusto de errores y transacciones
- ✅ **API dual** - Métodos alternativos para mayor flexibilidad
- ✅ **Operaciones en lote** - Agregar, actualizar y eliminar múltiples elementos
- ✅ **Búsqueda avanzada** - Filtros, ordenamiento y paginación
- ✅ **Gestión de índices** - Configuración automática de índices personalizados
- ✅ **Estadísticas** - Información detallada sobre el estado de la base de datos
- ✅ **Zero dependencies** - Sin dependencias externas

## 📦 Instalación

### NPM/Yarn/Bun
```bash
npm install idb-manager
# o
yarn add idb-manager
# o
bun add idb-manager
```

### CDN
- not implemented yet
```html
<script src=" https://cdn.jsdelivr.net/npm/idb-manager@1.0.5/dist/cdn/index.min.js "></script>
```

## 🛠️ Plan de Desarrollo

### Fase 1: Configuración del Proyecto ⏳
- [x] Estructura de carpetas
- [ ] Configuración de Bun (package.json, tsconfig.json)
- [ ] Refactorización del código principal
- [ ] Eliminación de dependencias inexistentes

### Fase 2: Testing 🧪
- [ ] Configuración de Bun test
- [ ] Tests unitarios para IndexedDBManager
- [ ] Tests de integración
- [ ] Coverage reports

### Fase 3: Build System 🔨
- [ ] Build para browser (ES modules)
- [ ] Build para CDN (UMD/IIFE)
- [ ] Minificación y optimización
- [ ] Generación de tipos (.d.ts)

### Fase 4: Distribución 📦
- [ ] Configuración de NPM publishing
- [ ] CDN setup
- [ ] Versionado automático
- [ ] CI/CD pipeline

## 🏗️ Estructura del Proyecto

```
idb-lib/
├── src/
│   ├── core/
│   │   ├── IndexedDBManager.ts    # Clase principal del gestor
│   │   └── Emitter.ts             # Sistema de eventos
│   ├── types/
│   │   └── index.ts               # Definiciones de tipos TypeScript
│   ├── utils/
│   │   ├── helpers.ts             # Funciones auxiliares
│   │   └── database.ts            # Utilidades de base de datos
│   └── index.ts                   # Punto de entrada principal
├── tests/
│   ├── unit/
│   │   ├── IndexedDBManager.test.ts
│   │   └── helpers.test.ts
│   ├── integration/
│   │   └── database-operations.test.ts
│   └── setup.ts                   # Configuración de tests
├── examples/
│   └── browser/
│       └── index.html             # Ejemplo de uso en navegador
├── scripts/
│   ├── build.ts                   # Script de construcción
│   ├── cdn.ts                     # Script para CDN
│   └── dev.ts                     # Script de desarrollo
├── package.json                   # Configuración del proyecto
├── tsconfig.json                  # Configuración de TypeScript
├── bun.lock                       # Lock file de Bun
└── README.md                      # Documentación
```

## 📋 API Completa

### Configuración e Inicialización

```typescript
import { IndexedDBManager, DatabaseConfig } from 'idb-manager';

// Configuración de la base de datos
const dbConfig: DatabaseConfig = {
  name: 'MyApp',
  version: 1,
  store: 'users'
};

// Crear instancia con opciones
const dbManager = new IndexedDBManager(dbConfig, {
  autoInit: true,  // Abrir automáticamente la base de datos
  debug: true      // Habilitar logs de debug
});

// O crear instancia con configuración anidada
const dbManager2 = new IndexedDBManager({
  defaultDatabase: dbConfig
});
```

### Operaciones CRUD Básicas

```typescript
// Guardar datos (crear o actualizar)
const user = await dbManager.saveData({
  name: 'Juan Pérez',
  email: 'juan@example.com'
});

// Métodos alternativos para guardar
const user2 = await dbManager.add({
  name: 'María García',
  email: 'maria@example.com'
});

// Obtener por ID
const userData = await dbManager.getDataById(user.id);
const userData2 = await dbManager.get(user.id); // Método alternativo

// Actualizar por ID
const updated = await dbManager.updateDataById(user.id, {
  email: 'nuevo@example.com'
});

// Actualizar elemento completo
const updatedUser = await dbManager.update({
  id: user.id,
  name: 'Juan Pérez Actualizado',
  email: 'juan.nuevo@example.com'
});

// Eliminar por ID
const deletedId = await dbManager.deleteData(user.id);
const success = await dbManager.delete(user.id); // Método alternativo
```

### Operaciones en Lote

```typescript
// Agregar múltiples elementos
const users = [
  { name: 'Usuario 1', email: 'user1@example.com' },
  { name: 'Usuario 2', email: 'user2@example.com' },
  { name: 'Usuario 3', email: 'user3@example.com' }
];
const success = await dbManager.addMany(users);

// Actualizar múltiples elementos
const usersToUpdate = [
  { id: 1, name: 'Usuario 1 Actualizado', email: 'user1@example.com' },
  { id: 2, name: 'Usuario 2 Actualizado', email: 'user2@example.com' }
];
const updateSuccess = await dbManager.updateMany(usersToUpdate);

// Eliminar múltiples elementos
const idsToDelete = [1, 2, 3];
const deleteSuccess = await dbManager.deleteMany(idsToDelete);

// Obtener múltiples elementos por IDs
const multipleUsers = await dbManager.getMany([1, 2, 3]);
```

### Consultas y Búsquedas

```typescript
// Obtener todos los datos
const allUsers = await dbManager.getAllData();
const allUsers2 = await dbManager.getAll(); // Método alternativo

// Contar elementos
const totalUsers = await dbManager.count();

// Búsqueda por texto
const searchResults = await dbManager.search('Juan', {
  fields: ['name', 'email'] // Campos donde buscar
});

// Filtrar por criterios
const filteredUsers = await dbManager.filter({
  active: true,
  role: 'admin'
});

// Búsqueda avanzada con opciones
const searchResult = await dbManager.searchData(
  { name: 'Juan' }, // Query
  {
    limit: 10,
    offset: 0,
    orderBy: 'name',
    orderDirection: 'asc'
  }
);
console.log(searchResult.items, searchResult.total, searchResult.page);
```

### Gestión de Base de Datos

```typescript
// Cambiar configuración de base de datos
const newConfig = {
  name: 'NewDatabase',
  version: 1,
  store: 'products'
};
await dbManager.setDatabase(newConfig);

// Obtener configuración actual
const currentConfig = dbManager.getCurrentDatabase();

// Configurar índices
dbManager.setDefaultIndexes([
  { name: 'email', keyPath: 'email', unique: true },
  { name: 'name', keyPath: 'name', unique: false }
]);

// Limpiar toda la base de datos
await dbManager.clearDatabase();
await dbManager.clear(); // Método alternativo

// Obtener estadísticas
const stats = await dbManager.getStats();
console.log(stats.totalRecords, stats.databaseName, stats.version);

// Cerrar conexión
dbManager.close();
```

### Sistema de Eventos

```typescript
// Escuchar eventos específicos
dbManager.on('add', (eventData) => {
  console.log('Elemento agregado:', eventData.data);
  console.log('Timestamp:', eventData.metadata.timestamp);
});

dbManager.on('update', (eventData) => {
  console.log('Elemento actualizado:', eventData.data);
});

dbManager.on('delete', (eventData) => {
  console.log('Elemento eliminado, ID:', eventData.data);
});

dbManager.on('clear', (eventData) => {
  console.log('Base de datos limpiada');
});

// Dejar de escuchar eventos
const callback = (data) => console.log(data);
dbManager.on('add', callback);
dbManager.off('add', callback);

// Acceso directo al emitter
dbManager.emitterInstance.on('save', (data) => {
  console.log('Datos guardados:', data);
});
```

### Manejo de Errores

```typescript
try {
  const user = await dbManager.saveData({
    name: 'Test User',
    email: 'test@example.com'
  });
  console.log('Usuario guardado:', user);
} catch (error) {
  console.error('Error al guardar usuario:', error);
}

// Escuchar errores globales
dbManager.emitterInstance.on('error', (error) => {
  console.error('Error en la base de datos:', error);
});
```

## 📚 Referencia Rápida de Métodos

### Métodos de Datos
| Método | Descripción | Retorna |
|--------|-------------|----------|
| `saveData(data)` | Guarda o actualiza un elemento | `Promise<DatabaseItem>` |
| `add(data)` | Alias para saveData | `Promise<DatabaseItem>` |
| `getDataById(id)` | Obtiene un elemento por ID | `Promise<DatabaseItem \| null>` |
| `get(id)` | Alias para getDataById | `Promise<DatabaseItem \| null>` |
| `updateDataById(id, data)` | Actualiza un elemento por ID | `Promise<DatabaseItem \| null>` |
| `update(item)` | Actualiza un elemento completo | `Promise<DatabaseItem>` |
| `deleteData(id)` | Elimina un elemento por ID | `Promise<string \| number>` |
| `delete(id)` | Alias para deleteData | `Promise<boolean>` |

### Métodos de Lote
| Método | Descripción | Retorna |
|--------|-------------|----------|
| `addMany(items)` | Agrega múltiples elementos | `Promise<boolean>` |
| `updateMany(items)` | Actualiza múltiples elementos | `Promise<boolean>` |
| `deleteMany(ids)` | Elimina múltiples elementos | `Promise<boolean>` |
| `getMany(ids)` | Obtiene múltiples elementos | `Promise<DatabaseItem[]>` |

### Métodos de Consulta
| Método | Descripción | Retorna |
|--------|-------------|----------|
| `getAllData()` | Obtiene todos los elementos | `Promise<DatabaseItem[]>` |
| `getAll()` | Alias para getAllData | `Promise<DatabaseItem[]>` |
| `count()` | Cuenta total de elementos | `Promise<number>` |
| `search(query, options)` | Búsqueda por texto | `Promise<DatabaseItem[]>` |
| `filter(criteria)` | Filtra por criterios | `Promise<DatabaseItem[]>` |
| `searchData(query, options)` | Búsqueda avanzada con paginación | `Promise<SearchResult>` |

### Métodos de Gestión
| Método | Descripción | Retorna |
|--------|-------------|----------|
| `setDatabase(config)` | Cambia configuración de BD | `Promise<void>` |
| `getCurrentDatabase()` | Obtiene configuración actual | `DatabaseConfig` |
| `setDefaultIndexes(indexes)` | Configura índices | `void` |
| `clearDatabase()` | Limpia toda la BD | `Promise<void>` |
| `clear()` | Alias para clearDatabase | `Promise<void>` |
| `getStats()` | Obtiene estadísticas | `Promise<Stats>` |
| `close()` | Cierra conexión | `void` |

### Métodos de Eventos
| Método | Descripción | Retorna |
|--------|-------------|----------|
| `on(event, callback)` | Escucha eventos | `void` |
| `off(event, callback)` | Deja de escuchar eventos | `void` |

## 🔧 Desarrollo

```bash
# Instalar dependencias
bun install

# Ejecutar tests
bun test

# Build para desarrollo
bun run build:dev

# Build para producción
bun run build

# Servir ejemplo local
bun run serve
```

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para más detalles.
