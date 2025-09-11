# IndexedDB Manager Library

Una librería moderna y robusta para gestionar IndexedDB en el navegador, construida con TypeScript y Bun.

## 🚀 Características

- ✅ **TypeScript nativo** - Tipado completo y seguridad de tipos
- ✅ **Sistema de eventos** - Emitter integrado para reactividad
- ✅ **Gestión inteligente de IDs** - Manejo automático de IDs numéricos y string
- ✅ **Transacciones seguras** - Manejo robusto de errores y transacciones
- ✅ **Import/Export** - Funcionalidades de respaldo y restauración
- ✅ **CDN Ready** - Disponible como UMD/IIFE para uso directo
- ✅ **Zero dependencies** - Sin dependencias externas

## 📦 Instalación

### NPM/Yarn/Bun
```bash
npm install @your-org/idb-manager
# o
yarn add @your-org/idb-manager
# o
bun add @your-org/idb-manager
```

### CDN
```html
<script src="https://cdn.jsdelivr.net/npm/@your-org/idb-manager@latest/dist/idb-manager.min.js"></script>
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
│   │   ├── IndexedDBManager.ts
│   │   └── Emitter.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── helpers.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   └── integration/
├── dist/
│   ├── esm/
│   ├── cjs/
│   └── cdn/
├── examples/
│   └── browser/
├── docs/
└── scripts/
```

## 📋 API Preview

```typescript
import { IndexedDBManager } from '@your-org/idb-manager';

// Configuración de la base de datos
const dbConfig = {
  name: 'MyApp',
  version: 1,
  store: 'users'
};

// Crear instancia
const dbManager = new IndexedDBManager(dbConfig);

// Guardar datos
const user = await dbManager.saveData({
  name: 'Juan Pérez',
  email: 'juan@example.com'
});

// Obtener datos
const userData = await dbManager.getDataById(user.id);

// Actualizar datos
const updated = await dbManager.updateDataById(user.id, {
  email: 'nuevo@example.com'
});

// Escuchar eventos
dbManager.emitterInstance.on('save', (data) => {
  console.log('Datos guardados:', data);
});
```

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