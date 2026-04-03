import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';

const distDir = path.resolve('dist');
const outputFile = path.join(distDir, 'jmw');
const distPackageJson = path.join(distDir, 'package.json');
const distConfig = path.join(distDir, 'config.cjs');

async function main() {
  try {
    console.log('Building jmw with Node + esbuild...');

    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });

    await build({
      entryPoints: ['src/cli.js'],
      outfile: outputFile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: ['node20'],
      banner: {
        js: '#!/usr/bin/env node'
      },
      minify: true,
      legalComments: 'none'
    });

    fs.copyFileSync('config.cjs', distConfig);
    fs.writeFileSync(distPackageJson, JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
    fs.chmodSync(outputFile, 0o755);

    console.log('✓ Build complete: dist/jmw');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main();
