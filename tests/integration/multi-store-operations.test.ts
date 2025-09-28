import { describe, it, expect, beforeEach } from 'bun:test';
import '../setup.js';
import { IndexedDBManager, DatabaseSchema } from '../../src/core/IndexedDBManager.js';
import type { DatabaseConfig, DatabaseItem } from '../../src/types/index.js';
import { waitForAsync, createTestData } from '../setup.js';

describe('Multi-Store Operations Integration', () => {
  let manager: IndexedDBManager;
  let appSchema: DatabaseSchema;
  let dbName: string;

  beforeEach(async () => {
    dbName = `MultiStoreTestApp_${Date.now()}_${Math.random()}`;
    appSchema = {
      name: dbName,
      version: 1,
      stores: [
        {
          name: 'users',
          keyPath: 'id',
          autoIncrement: false,
          indexes: [
            { name: 'email', keyPath: 'email', unique: true },
            { name: 'status', keyPath: 'status', unique: false },
            { name: 'createdAt', keyPath: 'createdAt', unique: false }
          ]
        },
        {
          name: 'posts',
          keyPath: 'id',
          autoIncrement: false,
          indexes: [
            { name: 'userId', keyPath: 'userId', unique: false },
            { name: 'category', keyPath: 'category', unique: false },
            { name: 'publishedAt', keyPath: 'publishedAt', unique: false }
          ]
        },
        {
          name: 'comments',
          keyPath: 'id',
          autoIncrement: false,
          indexes: [
            { name: 'postId', keyPath: 'postId', unique: false },
            { name: 'userId', keyPath: 'userId', unique: false },
            { name: 'createdAt', keyPath: 'createdAt', unique: false }
          ]
        },
        {
          name: 'categories',
          keyPath: 'id',
          autoIncrement: false,
          indexes: [
            { name: 'name', keyPath: 'name', unique: true }
          ]
        }
      ]
    };

    manager = await IndexedDBManager.initializeWithSchema(appSchema);
  });

  describe('Inicialización con esquema', () => {
    it('debería inicializar correctamente con esquema multi-store', async () => {
      expect(manager).toBeDefined();

      // Verificar que se crearon todos los stores
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');
      const commentsStore = manager.store('comments');
      const categoriesStore = manager.store('categories');

      expect(usersStore).toBeDefined();
      expect(postsStore).toBeDefined();
      expect(commentsStore).toBeDefined();
      expect(categoriesStore).toBeDefined();
    });

    it('debería mantener la configuración del esquema', () => {
      const currentConfig = manager.getCurrentDatabase();
      expect(currentConfig.name).toBe(dbName);
      expect(currentConfig.version).toBe(1);
      expect(currentConfig.store).toBe('users'); // Primer store por defecto
    });
  });

  describe('Operaciones CRUD en stores específicos', () => {
    it('debería realizar operaciones CRUD en store de usuarios', async () => {
      const usersStore = manager.store('users');

      // Crear usuario
      const newUser = await usersStore.add({
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active',
        createdAt: new Date().toISOString()
      });

      expect(newUser.id).toBeDefined();
      expect(newUser.name).toBe('John Doe');
      expect(newUser.email).toBe('john@example.com');

      // Leer usuario
      const foundUser = await usersStore.get(newUser.id);
      expect(foundUser).toEqual(newUser);

      // Actualizar usuario
      const updatedUser = await usersStore.update({
        ...newUser,
        status: 'inactive'
      });
      expect(updatedUser).toBeDefined();
      expect(updatedUser!.status).toBe('inactive');

      // Eliminar usuario
      const deleteResult = await usersStore.delete(newUser.id);
      expect(deleteResult).toBe(true);

      // Verificar eliminación
      const deletedUser = await usersStore.get(newUser.id);
      expect(deletedUser).toBeNull();
    });

    it('debería manejar operaciones por lotes en stores específicos', async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');

      // Agregar múltiples usuarios
      const users = [
        { name: 'User 1', email: 'user1@test.com', status: 'active' },
        { name: 'User 2', email: 'user2@test.com', status: 'active' },
        { name: 'User 3', email: 'user3@test.com', status: 'inactive' }
      ];

      const addResult = await usersStore.addMany(users);
      expect(addResult).toBe(true);

      // Verificar que se agregaron
      const allUsers = await usersStore.getAll();
      expect(allUsers).toHaveLength(3);

      // Agregar posts para los usuarios
      const posts = [
        { title: 'Post 1', content: 'Content 1', userId: allUsers[0].id as number, category: 'tech' },
        { title: 'Post 2', content: 'Content 2', userId: allUsers[1].id as number, category: 'news' },
        { title: 'Post 3', content: 'Content 3', userId: allUsers[0].id as number, category: 'tech' }
      ];

      const postsAddResult = await postsStore.addMany(posts);
      expect(postsAddResult).toBe(true);

      const allPosts = await postsStore.getAll();
      expect(allPosts).toHaveLength(3);

      // Actualizar múltiples usuarios
      const updatedUsers = allUsers.map(user => ({
        ...user,
        status: 'premium'
      }));

      const updateResult = await usersStore.updateMany(updatedUsers);
      expect(updateResult).toBe(true);

      // Verificar actualizaciones
      const refreshedUsers = await usersStore.getAll();
      refreshedUsers.forEach(user => {
        expect(user.status).toBe('premium');
      });

      // Eliminar múltiples posts
      const deleteResult = await postsStore.deleteMany([allPosts[0].id, allPosts[2].id]);
      expect(deleteResult).toBe(true);

      const remainingPosts = await postsStore.getAll();
      expect(remainingPosts).toHaveLength(1);
    });
  });

  describe('Búsquedas y filtros avanzados', () => {
    beforeEach(async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');
      const commentsStore = manager.store('comments');
      const categoriesStore = manager.store('categories');

      // Preparar datos de prueba
      const users = await Promise.all([
        usersStore.add({ name: 'Alice', email: 'alice@test.com', status: 'active', createdAt: '2023-01-01' }),
        usersStore.add({ name: 'Bob', email: 'bob@test.com', status: 'active', createdAt: '2023-01-15' }),
        usersStore.add({ name: 'Charlie', email: 'charlie@test.com', status: 'inactive', createdAt: '2023-02-01' })
      ]);

      const posts = await Promise.all([
        postsStore.add({ title: 'JavaScript Guide', content: 'Learn JS', userId: users[0].id, category: 'tech', publishedAt: '2023-03-01' }),
        postsStore.add({ title: 'Database Design', content: 'DB best practices', userId: users[1].id, category: 'tech', publishedAt: '2023-03-15' }),
        postsStore.add({ title: 'News Update', content: 'Latest news', userId: users[2].id, category: 'news', publishedAt: '2023-03-20' })
      ]);

      await Promise.all([
        commentsStore.add({ content: 'Great article!', postId: posts[0].id, userId: users[1].id, createdAt: '2023-03-02' }),
        commentsStore.add({ content: 'Thanks for sharing', postId: posts[0].id, userId: users[2].id, createdAt: '2023-03-03' }),
        commentsStore.add({ content: 'Very helpful', postId: posts[1].id, userId: users[0].id, createdAt: '2023-03-16' })
      ]);

      await categoriesStore.add({ name: 'Technology', description: 'Tech articles' });
      await categoriesStore.add({ name: 'News', description: 'News updates' });
    });

    it('debería buscar usuarios por diferentes criterios', async () => {
      const usersStore = manager.store('users');

      // Buscar por status
      const activeUsers = await usersStore.search({ status: 'active' });
      expect(activeUsers.items).toHaveLength(2);
      expect(activeUsers.total).toBe(2);

      // Buscar por email (parcial)
      const emailSearch = await usersStore.search({ email: 'test.com' });
      expect(emailSearch.items).toHaveLength(3);

      // Buscar con ordenamiento
      const orderedSearch = await usersStore.search({}, {
        orderBy: 'createdAt',
        orderDirection: 'asc'
      });
      expect(orderedSearch.items[0].name).toBe('Alice');
      expect(orderedSearch.items[1].name).toBe('Bob');
      expect(orderedSearch.items[2].name).toBe('Charlie');
    });

    it('debería buscar posts con paginación', async () => {
      const postsStore = manager.store('posts');

      // Buscar con límite
      const limitedSearch = await postsStore.search({}, {
        limit: 2,
        orderBy: 'publishedAt',
        orderDirection: 'asc'
      });
      expect(limitedSearch.items).toHaveLength(2);
      expect(limitedSearch.total).toBe(3);
      expect(limitedSearch.limit).toBe(2);

      // Buscar con offset
      const offsetSearch = await postsStore.search({}, {
        offset: 1,
        limit: 2,
        orderBy: 'publishedAt',
        orderDirection: 'asc'
      });
      expect(offsetSearch.items).toHaveLength(2);
      expect(offsetSearch.page).toBe(2);
    });

    it('debería filtrar datos por criterios específicos', async () => {
      const postsStore = manager.store('posts');
      const commentsStore = manager.store('comments');

      // Filtrar posts por categoría
      const techPosts = await postsStore.filter({ category: 'tech' });
      expect(techPosts).toHaveLength(2);

      // Filtrar comentarios por post
      const postComments = await commentsStore.filter({ postId: techPosts[0].id });
      expect(postComments).toHaveLength(2);

      // Filtrar por múltiples criterios
      const activeUserComments = await commentsStore.filter({
        userId: techPosts[0].userId as number // Alice's comments
      });
      expect(activeUserComments).toHaveLength(1);
    });

    it('debería realizar búsquedas complejas con relaciones', async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');
      const commentsStore = manager.store('comments');

      // Obtener todos los posts de un usuario específico
      const alice = await usersStore.filter({ name: 'Alice' });
      const alicePosts = await postsStore.filter({ userId: alice[0].id });
      expect(alicePosts).toHaveLength(1);
      expect(alicePosts[0].title).toBe('JavaScript Guide');

      // Obtener comentarios de un post específico
      const jsGuideComments = await commentsStore.filter({ postId: alicePosts[0].id });
      expect(jsGuideComments).toHaveLength(2);

      // Buscar posts por categoría con ordenamiento
      const techPosts = await postsStore.search({ category: 'tech' }, {
        orderBy: 'publishedAt',
        orderDirection: 'desc'
      });
      expect(techPosts.items[0].title).toBe('Database Design');
      expect(techPosts.items[1].title).toBe('JavaScript Guide');
    });
  });

  describe('Operaciones de estadísticas y utilidades', () => {
    beforeEach(async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');

      // Agregar datos de prueba
      const users = [
        { name: 'User 1', email: 'user1@test.com', status: 'active' },
        { name: 'User 2', email: 'user2@test.com', status: 'active' },
        { name: 'User 3', email: 'user3@test.com', status: 'inactive' }
      ];

      await usersStore.addMany(users);

      const posts = [
        { title: 'Post 1', content: 'Content 1', userId: 1 as number, category: 'tech' },
        { title: 'Post 2', content: 'Content 2', userId: 1 as number, category: 'news' },
        { title: 'Post 3', content: 'Content 3', userId: 2 as number, category: 'tech' }
      ];

      await postsStore.addMany(posts);
    });

    it('debería obtener estadísticas de stores específicos', async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');

      const usersStats = await usersStore.getStats();
      expect(usersStats.totalRecords).toBe(3);
      expect(usersStats.storeName).toBe('users');
      expect(usersStats.databaseName).toBe(dbName);

      const postsStats = await postsStore.getStats();
      expect(postsStats.totalRecords).toBe(3);
      expect(postsStats.storeName).toBe('posts');
    });

    it('debería contar registros en stores específicos', async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');

      const usersCount = await usersStore.count();
      expect(usersCount).toBe(3);

      const postsCount = await postsStore.count();
      expect(postsCount).toBe(3);
    });

    it('debería limpiar stores específicos', async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');

      // Verificar que hay datos
      expect(await usersStore.count()).toBe(3);
      expect(await postsStore.count()).toBe(3);

      // Limpiar solo usuarios
      await usersStore.clear();
      expect(await usersStore.count()).toBe(0);
      expect(await postsStore.count()).toBe(3); // Posts deberían mantenerse

      // Limpiar posts también
      await postsStore.clear();
      expect(await postsStore.count()).toBe(0);
    });
  });

  describe('Manejo de errores en multi-store', () => {
    it('debería manejar errores de IDs duplicados en índices únicos', async () => {
      const usersStore = manager.store('users');

      // Agregar primer usuario
      await usersStore.add({
        name: 'User 1',
        email: 'duplicate@test.com',
        status: 'active'
      });

      // Intentar agregar usuario con email duplicado
      try {
        await usersStore.add({
          name: 'User 2',
          email: 'duplicate@test.com', // Email duplicado
          status: 'active'
        });
        throw new Error('Debería haber lanzado un error por email duplicado');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('debería manejar operaciones en stores inexistentes', async () => {
      try {
        const nonExistentStore = manager.store('nonexistent');
        await nonExistentStore.getAll();
        throw new Error('Debería haber lanzado un error por store inexistente');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('debería manejar actualizaciones de elementos inexistentes', async () => {
      const usersStore = manager.store('users');

      const updateResult = await usersStore.update({
        id: 999,
        name: 'Non-existent User',
        email: 'nonexistent@test.com',
        status: 'active'
      });

      expect(updateResult).toBeNull();
    });
  });

  describe('Operaciones concurrentes en multi-store', () => {
    it('debería manejar operaciones concurrentes en diferentes stores', async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');
      const commentsStore = manager.store('comments');

      // Ejecutar operaciones concurrentes en diferentes stores
      const promises = [
        usersStore.add({ name: 'Concurrent User 1', email: 'con1@test.com', status: 'active' }),
        postsStore.add({ title: 'Concurrent Post 1', content: 'Content 1', userId: 1 as number, category: 'tech' }),
        commentsStore.add({ content: 'Concurrent Comment 1', postId: 1 as number, userId: 1 as number }),
        usersStore.add({ name: 'Concurrent User 2', email: 'con2@test.com', status: 'active' }),
        postsStore.add({ title: 'Concurrent Post 2', content: 'Content 2', userId: 2 as number, category: 'news' })
      ];

      const results = await Promise.all(promises);

      // Verificar que todas las operaciones se completaron
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
      });

      // Verificar estado final
      expect(await usersStore.count()).toBe(2);
      expect(await postsStore.count()).toBe(2);
      expect(await commentsStore.count()).toBe(1);
    });

    it('debería manejar operaciones concurrentes en el mismo store', async () => {
      const usersStore = manager.store('users');

      // Ejecutar múltiples operaciones concurrentes en el mismo store
      const promises = Array.from({ length: 10 }, (_, i) =>
        usersStore.add({
          name: `Concurrent User ${i + 1}`,
          email: `concurrent${i + 1}@test.com`,
          status: 'active'
        })
      );

      const results = await Promise.all(promises);

      // Verificar que todas las operaciones se completaron
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
      });

      // Verificar que todos los elementos se agregaron
      const finalCount = await usersStore.count();
      expect(finalCount).toBe(10);
    });
  });

  describe('Escenarios de uso realistas', () => {
    it('debería simular un blog completo con relaciones', async () => {
      const usersStore = manager.store('users');
      const postsStore = manager.store('posts');
      const commentsStore = manager.store('comments');
      const categoriesStore = manager.store('categories');

      // 1. Crear categorías
      const categories = await Promise.all([
        categoriesStore.add({ name: 'Technology', description: 'Tech articles' }),
        categoriesStore.add({ name: 'Lifestyle', description: 'Lifestyle content' })
      ]);

      // 2. Crear autores
      const authors = await Promise.all([
        usersStore.add({
          name: 'Tech Author',
          email: 'tech@example.com',
          status: 'active',
          createdAt: new Date().toISOString()
        }),
        usersStore.add({
          name: 'Lifestyle Author',
          email: 'lifestyle@example.com',
          status: 'active',
          createdAt: new Date().toISOString()
        })
      ]);

      // 3. Crear posts
      const posts = await Promise.all([
        postsStore.add({
          title: 'Introduction to IndexedDB',
          content: 'Learn about IndexedDB...',
          userId: authors[0].id,
          category: categories[0].name,
          publishedAt: new Date().toISOString()
        }),
        postsStore.add({
          title: 'Healthy Living Tips',
          content: 'Tips for a healthy lifestyle...',
          userId: authors[1].id,
          category: categories[1].name,
          publishedAt: new Date().toISOString()
        })
      ]);

      // 4. Agregar comentarios
      await Promise.all([
        commentsStore.add({
          content: 'Great explanation!',
          postId: posts[0].id,
          userId: authors[1].id,
          createdAt: new Date().toISOString()
        }),
        commentsStore.add({
          content: 'Very helpful, thanks!',
          postId: posts[1].id,
          userId: authors[0].id,
          createdAt: new Date().toISOString()
        })
      ]);

      // 5. Verificar relaciones y datos
      const allPosts = await postsStore.getAll();
      expect(allPosts).toHaveLength(2);

      const techPosts = await postsStore.filter({ category: 'Technology' });
      expect(techPosts).toHaveLength(1);
      expect(techPosts[0].title).toBe('Introduction to IndexedDB');

      const postComments = await commentsStore.filter({ postId: posts[0].id });
      expect(postComments).toHaveLength(1);
      expect(postComments[0].content).toBe('Great explanation!');

      // 6. Estadísticas del blog
      const usersStats = await usersStore.getStats();
      const postsStats = await postsStore.getStats();
      const commentsStats = await commentsStore.getStats();

      expect(usersStats.totalRecords).toBe(2);
      expect(postsStats.totalRecords).toBe(2);
      expect(commentsStats.totalRecords).toBe(2);
    });

    it('debería manejar un escenario de e-commerce', async () => {
      // Crear stores para e-commerce
      const customersStore = manager.store('users');
      const productsStore = manager.store('posts'); // Reutilizar para productos
      const ordersStore = manager.store('comments'); // Reutilizar para órdenes

      // 1. Crear productos
      const products = await Promise.all([
        productsStore.add({
          name: 'Laptop',
          price: 999.99,
          category: 'Electronics',
          stock: 10
        }),
        productsStore.add({
          name: 'Book',
          price: 19.99,
          category: 'Books',
          stock: 100
        })
      ]);

      // 2. Crear cliente
      const customer = await customersStore.add({
        name: 'John Customer',
        email: 'john@customer.com',
        status: 'active'
      });

      // 3. Crear orden
      const order = await ordersStore.add({
        customerId: customer.id,
        productId: products[0].id,
        quantity: 1,
        total: 999.99,
        status: 'pending'
      });

      // 4. Verificar relaciones
      const customerOrders = await ordersStore.filter({ customerId: customer.id });
      expect(customerOrders).toHaveLength(1);
      expect(customerOrders[0].total).toBe(999.99);

      const laptopOrders = await ordersStore.filter({ productId: products[0].id });
      expect(laptopOrders).toHaveLength(1);

      // 5. Actualizar stock del producto
      await productsStore.update({
        ...products[0],
        stock: (products[0].stock as number) - 1
      });

      const updatedProduct = await productsStore.get(products[0].id);
      expect(updatedProduct!.stock).toBe(9);
    });
  });

  describe('Compatibilidad hacia atrás', () => {
    it('debería mantener compatibilidad con operaciones tradicionales', async () => {
      // Usar el manager de forma tradicional (single-store)
      const user = await manager.add({
        name: 'Traditional User',
        email: 'traditional@test.com',
        status: 'active'
      });

      expect(user).toBeDefined();
      expect(user.name).toBe('Traditional User');

      // Verificar que se agregó al store por defecto
      const allUsers = await manager.getAll();
      expect(allUsers).toHaveLength(1);
      expect(allUsers[0]).toEqual(user);

      // Buscar de forma tradicional
      const searchResults = await manager.search('Traditional');
      expect(searchResults).toHaveLength(1);

      // Filtrar de forma tradicional
      const filterResults = await manager.filter({ status: 'active' });
      expect(filterResults).toHaveLength(1);
    });
  });
});
