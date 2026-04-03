import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../src/config.js';

test('loadConfig reads CommonJS config files and expands home paths', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmw-config-'));
  const configPath = path.join(tempDir, 'config.cjs');

  fs.writeFileSync(configPath, `module.exports = {
    projects: {
      demo: {
        base_path: '~/Work/demo',
        clients: {}
      }
    },
    restart_rules: {
      patterns: []
    }
  };
`);

  const config = loadConfig(configPath);

  assert.equal(config.projects.demo.base_path, path.join(os.homedir(), 'Work', 'demo'));
  assert.deepEqual(config.restart_rules.patterns, []);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('loadConfig falls back to embedded defaults when no file exists', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmw-fallback-'));
  const originalCwd = process.cwd();

  process.chdir(tempDir);

  try {
    const config = loadConfig(path.join(tempDir, 'missing-config.cjs'));

    assert.ok(config.projects.sinfomar);
    assert.ok(config.projects.mto);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
