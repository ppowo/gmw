import fs from 'fs';
import { $ } from 'bun';

// Build single-file executable with Bun
async function build() {
  try {
    console.log('Building jmw with Bun...');

    // Create dist directory
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist');
    }

    // Compile to single executable using Bun's native compile
    await $`bun build src/cli.js --compile --outfile dist/jmw`;

    console.log('✓ Build complete: dist/jmw');

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
