#!/usr/bin/env bun

import { build } from 'bun';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = packageJson.version;

// Asegurar que existe el directorio dist
if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
}

// Configuración base para todos los builds
const baseConfig = {
  entrypoints: ['src/index.ts'],
  target: 'browser' as const,
  format: 'esm' as const,
  splitting: false,
  sourcemap: 'external' as const,
  minify: false,
  external: []
};

// Build para desarrollo (ESM sin minificar)
const buildDev = async () => {
  console.log('🔨 Building development version...');
  
  const result = await build({
    ...baseConfig,
    outdir: 'dist',
    naming: {
      entry: 'index.js',
      chunk: '[name]-[hash].js'
    }
  });

  if (!result.success) {
    console.error('❌ Development build failed:', result.logs);
    process.exit(1);
  }

  console.log('✅ Development build completed');
};

// Build para producción (ESM minificado)
const buildProd = async () => {
  console.log('🔨 Building production version...');
  
  const result = await build({
    ...baseConfig,
    outdir: 'dist',
    minify: true,
    naming: {
      entry: 'index.min.js',
      chunk: '[name]-[hash].min.js'
    }
  });

  if (!result.success) {
    console.error('❌ Production build failed:', result.logs);
    process.exit(1);
  }

  console.log('✅ Production build completed');
};

// Build para UMD (compatible con CDN)
const buildUMD = async () => {
  console.log('🔨 Building UMD version...');
  
  const result = await build({
    entrypoints: ['src/index.ts'],
    target: 'browser' as const,
    format: 'iife' as const,
    outdir: 'dist',
    minify: true,
    sourcemap: 'external' as const,
    naming: {
      entry: 'index.umd.js'
    }
  });

  if (!result.success) {
    console.error('❌ UMD build failed:', result.logs);
    process.exit(1);
  }

  console.log('✅ UMD build completed');
};

// Build para tipos TypeScript
const buildTypes = async () => {
  console.log('🔨 Building TypeScript declarations...');
  
  try {
    // Ejecutar tsc para generar archivos .d.ts
    const proc = Bun.spawn([
      'bun', 'tsc', 
      '--declaration', 
      '--emitDeclarationOnly', 
      '--outDir', 'dist/types',
      '--declarationMap'
    ], {
      stdio: ['inherit', 'inherit', 'inherit']
    });
    
    const exitCode = await proc.exited;
    
    if (exitCode !== 0) {
      console.error('❌ TypeScript declarations build failed');
      process.exit(1);
    }
    
    console.log('✅ TypeScript declarations completed');
  } catch (error) {
    console.error('❌ Error building TypeScript declarations:', error);
    process.exit(1);
  }
};

// Crear archivo de información de build
const createBuildInfo = () => {
  const buildInfo = {
    version,
    buildDate: new Date().toISOString(),
    bunVersion: Bun.version,
    target: 'browser',
    formats: ['esm', 'umd'],
    files: {
      esm: 'index.js',
      esmMin: 'index.min.js',
      umd: 'index.umd.js',
      types: 'types/index.d.ts'
    }
  };

  writeFileSync(
    join('dist', 'build-info.json'), 
    JSON.stringify(buildInfo, null, 2)
  );
  
  console.log('📄 Build info created');
};

// Copiar archivos adicionales
const copyAssets = () => {
  console.log('📁 Copying assets...');
  
  // Copiar package.json (versión simplificada para distribución)
  const distPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    main: 'index.js',
    module: 'index.js',
    types: 'types/index.d.ts',
    browser: 'index.umd.js',
    exports: {
      '.': {
        import: './index.js',
        require: './index.umd.js',
        types: './types/index.d.ts'
      }
    },
    keywords: packageJson.keywords,
    author: packageJson.author,
    license: packageJson.license,
    repository: packageJson.repository,
    bugs: packageJson.bugs,
    homepage: packageJson.homepage
  };
  
  writeFileSync(
    join('dist', 'package.json'),
    JSON.stringify(distPackageJson, null, 2)
  );
  
  // Copiar README
  if (existsSync('README.md')) {
    const readme = readFileSync('README.md', 'utf-8');
    writeFileSync(join('dist', 'README.md'), readme);
  }
  
  console.log('✅ Assets copied');
};

// Función principal de build
const main = async () => {
  const args = process.argv.slice(2);
  const buildType = args[0] || 'all';
  
  console.log(`🚀 Starting build process (${buildType})...`);
  console.log(`📦 Version: ${version}`);
  
  try {
    switch (buildType) {
      case 'dev':
        await buildDev();
        break;
      case 'prod':
        await buildProd();
        break;
      case 'umd':
        await buildUMD();
        break;
      case 'types':
        await buildTypes();
        break;
      case 'all':
      default:
        await buildDev();
        await buildProd();
        await buildUMD();
        await buildTypes();
        createBuildInfo();
        copyAssets();
        break;
    }
    
    console.log('🎉 Build process completed successfully!');
  } catch (error) {
    console.error('💥 Build process failed:', error);
    process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (process.argv[1]?.endsWith('build.ts') || process.argv[1]?.endsWith('build.js')) {
  main();
}

export { buildDev, buildProd, buildUMD, buildTypes, createBuildInfo, copyAssets };