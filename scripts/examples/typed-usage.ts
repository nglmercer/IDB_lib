/**
 * Ejemplo de uso de IndexedDBManager con tipos específicos
 * Este archivo demuestra cómo obtener datos tipados fuertemente
 */

import { IndexedDBManager } from '../../src/core/IndexedDBManager.js';
import type {
  DatabaseConfig,
  TypedDatabaseItem,
  CreateTypedItem,
  UpdateTypedItem,
  TypedSearchResult,
  DatabaseSchema
} from '../../src/types/index.js';

// ==========================================
// 1. DEFINIR ESQUEMAS ESPECÍFICOS
// ==========================================

/**
 * Esquema para usuarios
 */
interface UserData extends Record<string, import('../../src/types/index.js').DatabaseItemValue> {
  name: string;
  email: string;
  age: number;
  active: boolean;
  role: 'admin' | 'user' | 'moderator';
  tags: string[];
}

/**
 * Esquema para productos
 */
interface ProductData extends Record<string, import('../../src/types/index.js').DatabaseItemValue> {
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  images: string[];
  metadata: {
    brand: string;
    weight: number;
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
  };
}

/**
 * Esquema para posts de blog
 */
interface BlogPostData extends Record<string, import('../../src/types/index.js').DatabaseItemValue> {
  title: string;
  content: string;
  author: string;
  published: boolean;
  tags: string[];
  seoMetadata: {
    slug: string;
    metaDescription: string;
    keywords: string[];
  };
  stats: {
    views: number;
    likes: number;
    comments: number;
  };
}

// ==========================================
// 2. CONFIGURACIÓN DE BASES DE DATOS
// ==========================================

const userDbConfig: DatabaseConfig = {
  name: 'UserDatabase',
  version: 1,
  store: 'users'
};

const productDbConfig: DatabaseConfig = {
  name: 'ProductDatabase',
  version: 1,
  store: 'products'
};

const blogDbConfig: DatabaseConfig = {
  name: 'BlogDatabase',
  version: 1,
  store: 'posts'
};

// ==========================================
// 3. FUNCIONES HELPER PARA DATOS TIPADOS
// ==========================================

/**
 * Helper para crear managers tipados
 */
function createTypedManager<T extends Record<string, any>>(
  config: DatabaseConfig,
  schema?: DatabaseSchema<T>
): IndexedDBManager {
  const manager = new IndexedDBManager(config);

  // Configurar índices basados en el esquema
  if (schema?.indexedFields) {
    const indexes = schema.indexedFields.map(field => ({
      name: `idx_${String(field)}`,
      keyPath: String(field),
      unique: schema.uniqueFields?.includes(field) || false
    }));

    manager.setDefaultIndexes(indexes);
  }

  return manager;
}

/**
 * Type guard para validar tipos en runtime
 */
function isTypedItem<T extends Record<string, any>>(
  item: any,
  schema: DatabaseSchema<T>
): item is TypedDatabaseItem<T> {
  if (!item || typeof item !== 'object') return false;

  // Verificar campos requeridos
  for (const field of schema.requiredFields) {
    if (!(field in item)) return false;
  }

  return true;
}

/**
 * Helper para obtener datos tipados con validación
 */
async function getTypedAllData<T extends Record<string, any>>(
  manager: IndexedDBManager,
  schema: DatabaseSchema<T>
): Promise<TypedDatabaseItem<T>[]> {
  const allData = await manager.getAll();

  return allData.filter((item): item is TypedDatabaseItem<T> =>
    isTypedItem(item, schema)
  );
}

// ==========================================
// 4. EJEMPLOS DE USO PRÁCTICOS
// ==========================================

/**
 * Ejemplo 1: Trabajar con usuarios tipados
 */
export async function userExample() {
  const userSchema: DatabaseSchema<UserData> = {
    requiredFields: ['name', 'email', 'age', 'active', 'role'],
    optionalFields: ['tags', 'profile'],
    uniqueFields: ['email'],
    indexedFields: ['email', 'role', 'active'],
    validators: {
      email: (value: import('../../src/types/index.js').DatabaseItemValue) => {
        if (typeof value !== 'string') return 'Email debe ser string';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) || 'Email inválido';
      },
      age: (value: import('../../src/types/index.js').DatabaseItemValue) => {
        if (typeof value !== 'number') return 'Edad debe ser número';
        return (value >= 0 && value <= 150) || 'Edad debe estar entre 0 y 150';
      }
    }
  };

  const userManager = createTypedManager<UserData>(userDbConfig, userSchema);

  // Crear usuario tipado
  const newUser: CreateTypedItem<UserData> = {
    name: "María García",
    email: "maria@example.com",
    age: 28,
    active: true,
    role: 'admin',
    tags: ['premium', 'verified'],
    profile: {
      avatar: 'avatar.jpg',
      bio: 'Desarrolladora full-stack',
      preferences: {
        theme: 'dark',
        notifications: true
      }
    }
  };

  // Guardar usuario
  const savedUser = await userManager.add(newUser);
  console.log('Usuario guardado:', savedUser);

  // Obtener todos los usuarios tipados
  const allUsers = await getTypedAllData(userManager, userSchema);
  console.log('Todos los usuarios:', allUsers);

  // Ahora tienes type safety completa!
  allUsers.forEach(user => {
    // TypeScript sabe que estas propiedades existen
    console.log(`Usuario: ${user.name} (${user.email}) - Edad: ${user.age}`);

  });

  return allUsers;
}

/**
 * Ejemplo 2: Trabajar con productos tipados
 */
export async function productExample() {
  const productSchema: DatabaseSchema<ProductData> = {
    requiredFields: ['name', 'price', 'category', 'inStock', 'images', 'metadata'],
    optionalFields: ['description'],
    uniqueFields: [],
    indexedFields: ['category', 'inStock', 'price'],
    validators: {
      price: (value: import('../../src/types/index.js').DatabaseItemValue) => {
        if (typeof value !== 'number') return 'Precio debe ser número';
        return value >= 0 || 'Precio debe ser positivo';
      },
      category: (value: import('../../src/types/index.js').DatabaseItemValue) => {
        if (typeof value !== 'string') return 'Categoría debe ser string';
        return value.length > 0 || 'Categoría requerida';
      }
    }
  };

  const productManager = createTypedManager<ProductData>(productDbConfig, productSchema);

  // Crear producto tipado
  const newProduct: CreateTypedItem<ProductData> = {
    name: "Laptop Gaming Pro",
    price: 1299.99,
    category: "Electrónicos",
    inStock: true,
    description: "Laptop de alto rendimiento para gaming",
    images: ["laptop1.jpg", "laptop2.jpg"],
    metadata: {
      brand: "TechCorp",
      weight: 2.5,
      dimensions: {
        width: 35.6,
        height: 2.3,
        depth: 24.1
      }
    }
  };

  await productManager.add(newProduct);

  // Obtener productos tipados
  const allProducts = await getTypedAllData(productManager, productSchema);

  // Type safety en operaciones
  const availableProducts = allProducts.filter(product => product.inStock);
  const totalValue = availableProducts.reduce((sum, product) => sum + product.price, 0);

  console.log(`Productos disponibles: ${availableProducts.length}`);
  console.log(`Valor total: $${totalValue}`);

  return allProducts;
}

/**
 * Ejemplo 3: Búsqueda tipada avanzada
 */
export async function searchExample() {
  const userManager = createTypedManager<UserData>(userDbConfig);

  // Búsqueda con filtros tipados
  const activeAdmins = await userManager.filter({
    active: true,
    role: 'admin'
  });

  // Los resultados mantienen type safety
  const adminEmails: string[] = activeAdmins
    .filter((user): user is TypedDatabaseItem<UserData> =>
      'email' in user && typeof user.email === 'string'
    )
    .map(user => user.email);

  console.log('Emails de admins activos:', adminEmails);

  // Búsqueda de texto en campos específicos
  const usersWithGmail = await userManager.search('gmail', {
    fields: ['email']
  });

  return { activeAdmins, adminEmails, usersWithGmail };
}

// ==========================================
// 5. EJEMPLO DE USO AVANZADO CON CLASES
// ==========================================

/**
 * Clase wrapper para operaciones tipadas
 */
export class TypedDatabaseManager<T extends Record<string, any>> {
  constructor(
    private manager: IndexedDBManager,
    private schema: DatabaseSchema<T>
  ) {}

  async getAllTyped(): Promise<TypedDatabaseItem<T>[]> {
    return getTypedAllData(this.manager, this.schema);
  }

  async addTyped(item: CreateTypedItem<T>): Promise<TypedDatabaseItem<T>> {
    return this.manager.add(item) as Promise<TypedDatabaseItem<T>>;
  }

  async updateTyped(item: UpdateTypedItem<T>): Promise<TypedDatabaseItem<T>> {
    return this.manager.update(item as any) as Promise<TypedDatabaseItem<T>>;
  }

  async findByField<K extends keyof T>(
    field: K,
    value: T[K]
  ): Promise<TypedDatabaseItem<T>[]> {
    const allData = await this.getAllTyped();
    return allData.filter(item => item[field] === value);
  }
}

// ==========================================
// 6. EJEMPLO DE USO PRÁCTICO
// ==========================================

/**
 * Función principal de demostración
 */
export async function demonstrateTypedUsage() {
  console.log('🚀 Demostrando uso de datos tipados...');

  try {
    // Inicializar bases de datos
    await Promise.all([
      new IndexedDBManager(userDbConfig).openDatabase(),
      new IndexedDBManager(productDbConfig).openDatabase(),
      new IndexedDBManager(blogDbConfig).openDatabase()
    ]);

    // Ejecutar ejemplos
    const users = await userExample();
    const products = await productExample();
    const searchResults = await searchExample();

    console.log('✅ Ejemplos completados exitosamente');
    console.log(`Usuarios totales: ${users.length}`);
    console.log(`Productos totales: ${products.length}`);

    return {
      users,
      products,
      searchResults,
      summary: {
        totalUsers: users.length,
        totalProducts: products.length,
        activeAdmins: searchResults.activeAdmins.length
      }
    };

  } catch (error) {
    console.error('❌ Error en demostración:', error);
    throw error;
  }
}

// ==========================================
// 7. EXPORTAR TIPOS PARA USO EXTERNO
// ==========================================

export type User = TypedDatabaseItem<UserData>;
export type Product = TypedDatabaseItem<ProductData>;
export type BlogPost = TypedDatabaseItem<BlogPostData>;

export type CreateUser = CreateTypedItem<UserData>;
export type CreateProduct = CreateTypedItem<ProductData>;
export type CreateBlogPost = CreateTypedItem<BlogPostData>;

export type UpdateUser = UpdateTypedItem<UserData>;
export type UpdateProduct = UpdateTypedItem<ProductData>;
export type UpdateBlogPost = UpdateTypedItem<BlogPostData>;

export type UserSearchResult = TypedSearchResult<UserData>;
export type ProductSearchResult = TypedSearchResult<ProductData>;
export type BlogPostSearchResult = TypedSearchResult<BlogPostData>;
