#!/usr/bin/env bun

import { build } from 'bun';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = packageJson.version;

// Asegurar que existe el directorio cdn
if (!existsSync('cdn')) {
  mkdirSync('cdn', { recursive: true });
}

// Función para calcular hash de archivo
const calculateFileHash = (content: string): string => {
  return createHash('sha256').update(content).digest('hex').substring(0, 8);
};

// Build para CDN - UMD con nombre global
const buildCDNUMD = async () => {
  console.log('🔨 Building CDN UMD version...');
  
  const result = await build({
    entrypoints: ['src/index.ts'],
    target: 'browser',
    format: 'iife' as const,
    outdir: 'cdn/temp',
    minify: true,
    sourcemap: 'external' as const,
    naming: {
      entry: 'indexeddb-manager.umd.js'
    }
  });

  if (!result.success) {
    console.error('❌ CDN UMD build failed:', result.logs);
    process.exit(1);
  }

  console.log('✅ CDN UMD build completed');
  return join('cdn/temp', 'indexeddb-manager.umd.js');
};

// Build para CDN - ESM
const buildCDNESM = async () => {
  console.log('🔨 Building CDN ESM version...');
  
  const result = await build({
    entrypoints: ['src/index.ts'],
    target: 'browser',
    format: 'esm' as const,
    outdir: 'cdn/temp',
    minify: true,
    sourcemap: 'external' as const,
    naming: {
      entry: 'indexeddb-manager.esm.js'
    }
  });

  if (!result.success) {
    console.error('❌ CDN ESM build failed:', result.logs);
    process.exit(1);
  }

  console.log('✅ CDN ESM build completed');
  return join('cdn/temp', 'indexeddb-manager.esm.js');
};

// Crear versiones con hash y sin hash
const createVersionedFiles = (filePath: string, format: 'umd' | 'esm') => {
  const content = readFileSync(filePath, 'utf-8');
  const hash = calculateFileHash(content);
  const extension = format === 'umd' ? 'umd.js' : 'esm.js';
  
  // Archivos con versión
  const versionedName = `indexeddb-manager@${version}.${extension}`;
  const hashedName = `indexeddb-manager@${version}-${hash}.${extension}`;
  
  // Archivos sin versión (latest)
  const latestName = `indexeddb-manager.${extension}`;
  const latestMinName = `indexeddb-manager.min.${extension}`;
  
  // Escribir archivos
  writeFileSync(join('cdn', versionedName), content);
  writeFileSync(join('cdn', hashedName), content);
  writeFileSync(join('cdn', latestName), content);
  writeFileSync(join('cdn', latestMinName), content);
  
  // Copiar sourcemap si existe
  const sourcemapPath = filePath + '.map';
  if (existsSync(sourcemapPath)) {
    const sourcemapContent = readFileSync(sourcemapPath, 'utf-8');
    writeFileSync(join('cdn', versionedName + '.map'), sourcemapContent);
    writeFileSync(join('cdn', hashedName + '.map'), sourcemapContent);
    writeFileSync(join('cdn', latestName + '.map'), sourcemapContent);
    writeFileSync(join('cdn', latestMinName + '.map'), sourcemapContent);
  }
  
  return {
    versioned: versionedName,
    hashed: hashedName,
    latest: latestName,
    latestMin: latestMinName,
    hash,
    size: content.length
  };
};

// Crear archivo de manifiesto CDN
const createCDNManifest = (umdInfo: any, esmInfo: any) => {
  const manifest = {
    name: packageJson.name,
    version,
    description: packageJson.description,
    homepage: packageJson.homepage,
    repository: packageJson.repository,
    license: packageJson.license,
    buildDate: new Date().toISOString(),
    bunVersion: Bun.version,
    
    // Información de archivos
    files: {
      umd: {
        latest: umdInfo.latest,
        latestMin: umdInfo.latestMin,
        versioned: umdInfo.versioned,
        hashed: umdInfo.hashed,
        hash: umdInfo.hash,
        size: umdInfo.size,
        gzipSize: Math.round(umdInfo.size * 0.3), // Estimación
        integrity: `sha256-${createHash('sha256').update(readFileSync(join('cdn', umdInfo.latest))).digest('base64')}`
      },
      esm: {
        latest: esmInfo.latest,
        latestMin: esmInfo.latestMin,
        versioned: esmInfo.versioned,
        hashed: esmInfo.hashed,
        hash: esmInfo.hash,
        size: esmInfo.size,
        gzipSize: Math.round(esmInfo.size * 0.3), // Estimación
        integrity: `sha256-${createHash('sha256').update(readFileSync(join('cdn', esmInfo.latest))).digest('base64')}`
      }
    },
    
    // URLs de ejemplo para CDN
    cdn: {
      jsdelivr: {
        umd: `https://cdn.jsdelivr.net/npm/${packageJson.name}@${version}/cdn/${umdInfo.latest}`,
        esm: `https://cdn.jsdelivr.net/npm/${packageJson.name}@${version}/cdn/${esmInfo.latest}`
      },
      unpkg: {
        umd: `https://unpkg.com/${packageJson.name}@${version}/cdn/${umdInfo.latest}`,
        esm: `https://unpkg.com/${packageJson.name}@${version}/cdn/${esmInfo.latest}`
      }
    },
    
    // Ejemplos de uso
    usage: {
      umd: {
        html: `<script src="https://cdn.jsdelivr.net/npm/${packageJson.name}@${version}/cdn/${umdInfo.latest}"></script>\n<script>\n  const manager = new IndexedDBManager.IndexedDBManager();\n  // Tu código aquí\n</script>`,
        integrity: `<script src="https://cdn.jsdelivr.net/npm/${packageJson.name}@${version}/cdn/${umdInfo.latest}" integrity="${createHash('sha256').update(readFileSync(join('cdn', umdInfo.latest))).digest('base64')}" crossorigin="anonymous"></script>`
      },
      esm: {
        html: `<script type="module">\n  import { IndexedDBManager } from 'https://cdn.jsdelivr.net/npm/${packageJson.name}@${version}/cdn/${esmInfo.latest}';\n  const manager = new IndexedDBManager();\n  // Tu código aquí\n</script>`,
        import: `import { IndexedDBManager } from 'https://cdn.jsdelivr.net/npm/${packageJson.name}@${version}/cdn/${esmInfo.latest}';`
      }
    }
  };
  
  writeFileSync(
    join('cdn', 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('📄 CDN manifest created');
  return manifest;
};

// Crear archivo README para CDN
const createCDNReadme = (manifest: any) => {
  const readme = `# ${packageJson.name} - CDN Distribution

Version: ${version}  
Build Date: ${new Date().toISOString()}

## Quick Start

### UMD (Universal Module Definition)

Perfect for direct inclusion in HTML:

\`\`\`html
${manifest.usage.umd.html}
\`\`\`

### ESM (ES Modules)

For modern browsers with module support:

\`\`\`html
${manifest.usage.esm.html}
\`\`\`

## Available Files

### UMD Format
- \`${manifest.files.umd.latest}\` - Latest version (${(manifest.files.umd.size / 1024).toFixed(1)}KB)
- \`${manifest.files.umd.versioned}\` - Version-specific
- \`${manifest.files.umd.hashed}\` - With content hash

### ESM Format
- \`${manifest.files.esm.latest}\` - Latest version (${(manifest.files.esm.size / 1024).toFixed(1)}KB)
- \`${manifest.files.esm.versioned}\` - Version-specific
- \`${manifest.files.esm.hashed}\` - With content hash

## CDN Providers

### jsDelivr
- UMD: ${manifest.cdn.jsdelivr.umd}
- ESM: ${manifest.cdn.jsdelivr.esm}

### unpkg
- UMD: ${manifest.cdn.unpkg.umd}
- ESM: ${manifest.cdn.unpkg.esm}

## Integrity Hashes

For security, use SRI (Subresource Integrity):

\`\`\`html
${manifest.usage.umd.integrity}
\`\`\`

## File Sizes

| Format | Size | Gzipped (est.) |
|--------|------|----------------|
| UMD    | ${(manifest.files.umd.size / 1024).toFixed(1)}KB | ${(manifest.files.umd.gzipSize / 1024).toFixed(1)}KB |
| ESM    | ${(manifest.files.esm.size / 1024).toFixed(1)}KB | ${(manifest.files.esm.gzipSize / 1024).toFixed(1)}KB |

## Usage Examples

### Basic Usage (UMD)

\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <title>IndexedDB Manager Example</title>
</head>
<body>
    <script src="${manifest.cdn.jsdelivr.umd}"></script>
    <script>
        const manager = new IndexedDBManager.IndexedDBManager({
            defaultDatabase: {
                name: 'MyApp',
                version: 1,
                store: 'data'
            }
        });
        
        // Add data
        manager.add({ id: 1, name: 'Example Item' })
            .then(() => console.log('Item added!'));
    </script>
</body>
</html>
\`\`\`

### Modern Usage (ESM)

\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <title>IndexedDB Manager Example</title>
</head>
<body>
    <script type="module">
        import { IndexedDBManager } from '${manifest.cdn.jsdelivr.esm}';
        
        const manager = new IndexedDBManager({
            defaultDatabase: {
                name: 'MyApp',
                version: 1,
                store: 'data'
            }
        });
        
        // Add data
        await manager.add({ id: 1, name: 'Example Item' });
        console.log('Item added!');
    </script>
</body>
</html>
\`\`\`

## License

${packageJson.license}
`;
  
  writeFileSync(join('cdn', 'README.md'), readme);
  console.log('📄 CDN README created');
};

// Limpiar archivos temporales
const cleanup = () => {
  try {
    const tempDir = join('cdn', 'temp');
    if (existsSync(tempDir)) {
      const { rmSync } = require('fs');
      rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('⚠️ Could not clean temp files:', error);
  }
};

// Función principal
const main = async () => {
  console.log('🚀 Building CDN distribution...');
  console.log(`📦 Version: ${version}`);
  
  try {
    // Builds
    const umdPath = await buildCDNUMD();
    const esmPath = await buildCDNESM();
    
    // Crear versiones
    const umdInfo = createVersionedFiles(umdPath, 'umd');
    const esmInfo = createVersionedFiles(esmPath, 'esm');
    
    // Crear manifiesto y documentación
    const manifest = createCDNManifest(umdInfo, esmInfo);
    createCDNReadme(manifest);
    
    // Limpiar
    cleanup();
    
    console.log('\n🎉 CDN distribution completed!');
    console.log('📁 Files created in cdn/ directory:');
    console.log(`   📄 ${umdInfo.latest} (${(umdInfo.size / 1024).toFixed(1)}KB)`);
    console.log(`   📄 ${esmInfo.latest} (${(esmInfo.size / 1024).toFixed(1)}KB)`);
    console.log(`   📄 manifest.json`);
    console.log(`   📄 README.md`);
    console.log('\n🌐 Ready for CDN deployment!');
    
  } catch (error) {
    console.error('💥 CDN build failed:', error);
    cleanup();
    process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (import.meta.main) {
  main();
}

export { buildCDNUMD, buildCDNESM, createVersionedFiles, createCDNManifest };