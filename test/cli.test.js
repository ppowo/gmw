import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('source CLI works under Node', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', '--help'], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: jmw/);
  assert.match(result.stdout, /Build a Maven module/);
});

test('build script produces a working Node bundle', () => {
  const buildResult = spawnSync(process.execPath, ['build.js'], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert.equal(buildResult.status, 0, buildResult.stderr);
  assert.ok(fs.existsSync(path.join(rootDir, 'dist', 'jmw')));
  assert.ok(fs.existsSync(path.join(rootDir, 'dist', 'config.cjs')));

  const cliResult = spawnSync(process.execPath, ['dist/jmw', '--help'], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert.equal(cliResult.status, 0, cliResult.stderr);
  assert.match(cliResult.stdout, /Usage: jmw/);
  assert.match(cliResult.stdout, /Deploy artifact to WildFly/);
});
