import fs from 'fs';
import { $ } from 'bun';

async function build() {
  try {
    console.log('Building jmw with Bun...');

    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist');
    }

    await $`bun build src/cli.js --outfile dist/jmw --banner '#!/usr/bin/env bun' --target bun --minify`;
    await $`chmod +x dist/jmw`;

    console.log('✓ Build complete: dist/jmw');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();