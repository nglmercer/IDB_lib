#!/usr/bin/env bun

import { watch } from 'fs';
import { join } from 'path';
import { buildDev } from './build.js';

let isBuilding = false;
let buildTimeout: Timer | null = null;

const debounce = (fn: Function, delay: number) => {
  return (...args: any[]) => {
    if (buildTimeout) {
      clearTimeout(buildTimeout);
    }
    buildTimeout = setTimeout(() => fn(...args), delay);
  };
};

const rebuild = debounce(async () => {
  if (isBuilding) {
    console.log('⏳ Build already in progress, skipping...');
    return;
  }
  
  isBuilding = true;
  console.log('\n🔄 File changed, rebuilding...');
  
  try {
    await buildDev();
    console.log('✅ Rebuild completed\n');
  } catch (error) {
    console.error('❌ Rebuild failed:', error);
  } finally {
    isBuilding = false;
  }
}, 300);

const startWatcher = () => {
  console.log('👀 Starting development watcher...');
  console.log('📁 Watching src/ directory for changes');
  console.log('🛑 Press Ctrl+C to stop\n');
  
  // Realizar build inicial
  rebuild();
  
  // Configurar watcher
  const watcher = watch(
    join(process.cwd(), 'src'),
    { recursive: true },
    (eventType, filename) => {
      if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
        console.log(`📝 ${eventType}: ${filename}`);
        rebuild();
      }
    }
  );
  
  // Manejar cierre graceful
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watcher...');
    watcher.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping watcher...');
    watcher.close();
    process.exit(0);
  });
};

// Función para servir archivos estáticos (opcional)
const startDevServer = async () => {
  console.log('🌐 Starting development server...');
  
  const server = Bun.serve({
    port: 3000,
    fetch(req) {
      const url = new URL(req.url);
      
      // Servir archivos desde dist/
      if (url.pathname.startsWith('/dist/')) {
        const filePath = join(process.cwd(), url.pathname.slice(1));
        return new Response(Bun.file(filePath));
      }
      
      // Servir archivos desde examples/
      if (url.pathname.startsWith('/examples/')) {
        const filePath = join(process.cwd(), url.pathname.slice(1));
        return new Response(Bun.file(filePath));
      }
      
      // Página de inicio simple
      if (url.pathname === '/') {
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>IndexedDB Manager - Development</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .container { max-width: 800px; margin: 0 auto; }
              .link { display: block; margin: 10px 0; padding: 10px; background: #f5f5f5; text-decoration: none; color: #333; border-radius: 4px; }
              .link:hover { background: #e5e5e5; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>IndexedDB Manager - Development Server</h1>
              <p>Development server is running on port 3000</p>
              
              <h2>Available Resources:</h2>
              <a href="/dist/index.js" class="link">📦 Development Build (ESM)</a>
              <a href="/dist/index.min.js" class="link">📦 Production Build (ESM Minified)</a>
              <a href="/dist/index.umd.js" class="link">📦 UMD Build (CDN Ready)</a>
              <a href="/examples/browser/" class="link">🌐 Browser Example</a>
              <a href="/dist/build-info.json" class="link">ℹ️ Build Information</a>
              
              <h2>Development Commands:</h2>
              <ul>
                <li><code>bun run build</code> - Build all formats</li>
                <li><code>bun run build:dev</code> - Build development version</li>
                <li><code>bun run build:prod</code> - Build production version</li>
                <li><code>bun run test</code> - Run tests</li>
                <li><code>bun run dev</code> - Start development watcher</li>
              </ul>
            </div>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      return new Response('Not Found', { status: 404 });
    },
  });
  
  console.log(`🚀 Development server running at http://localhost:${server.port}`);
  console.log('📁 Serving files from dist/ and examples/');
  
  return server;
};

const main = async () => {
  const args = process.argv.slice(2);
  const mode = args[0] || 'watch';
  
  switch (mode) {
    case 'watch':
      startWatcher();
      break;
    case 'serve':
      await startDevServer();
      startWatcher();
      break;
    case 'server':
      await startDevServer();
      break;
    default:
      console.log('Usage: bun run dev [watch|serve|server]');
      console.log('  watch  - Watch files and rebuild on changes');
      console.log('  serve  - Start dev server + file watcher');
      console.log('  server - Start dev server only');
      process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (import.meta.main) {
  main();
}

export { startWatcher, startDevServer };