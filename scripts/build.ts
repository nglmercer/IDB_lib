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

// Build para ESM
const buildESM = async () => {
  console.log('🔨 Building ESM version...');
  
  const result = await build({
    ...baseConfig,
    outdir: 'dist/esm',
    format: 'esm',
    naming: {
      entry: 'index.js'
    }
  });

  if (!result.success) {
    console.error('❌ ESM build failed:', result.logs);
    process.exit(1);
  }

  console.log('✅ ESM build completed');
};

// Build para CJS
const buildCJS = async () => {
  console.log('🔨 Building CJS version...');
  
  const result = await build({
    ...baseConfig,
    outdir: 'dist/cjs',
    format: 'cjs',
    target: 'node',
    naming: {
      entry: 'index.js'
    }
  });

  if (!result.success) {
    console.error('❌ CJS build failed:', result.logs);
    process.exit(1);
  }

  console.log('✅ CJS build completed');
};

// Build para CDN (IIFE)
const buildCDN = async () => {
  console.log('🔨 Building CDN version...');
  
  // Versión de desarrollo
  const devResult = await build({
    entrypoints: ['src/index.ts'],
    target: 'browser' as const,
    format: 'iife' as const,
    outdir: 'dist/cdn',
    minify: false,
    sourcemap: 'external' as const,
    naming: {
      entry: 'index.js'
    },
    globalName: 'IDBManager'
  });

  if (!devResult.success) {
    console.error('❌ CDN dev build failed:', devResult.logs);
    process.exit(1);
  }

  // Versión minificada
  const minResult = await build({
    entrypoints: ['src/index.ts'],
    target: 'browser' as const,
    format: 'iife' as const,
    outdir: 'dist/cdn',
    minify: true,
    sourcemap: 'external' as const,
    naming: {
      entry: 'index.min.js'
    },
    globalName: 'IDBManager'
  });

  if (!minResult.success) {
    console.error('❌ CDN min build failed:', minResult.logs);
    process.exit(1);
  }

  console.log('✅ CDN build completed');
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
      case 'esm':
        await buildESM();
        break;
      case 'cjs':
        await buildCJS();
        break;
      case 'cdn':
        await buildCDN();
        break;
      case 'types':
        await buildTypes();
        break;
      case 'all':
      default:
        await buildESM();
        await buildCJS();
        await buildCDN();
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

export { buildESM, buildCJS, buildCDN, buildTypes, createBuildInfo, copyAssets };