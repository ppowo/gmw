import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMavenCommand, getProfiles } from '../src/builder.js';

test('getProfiles uses configured profile mappings', () => {
  const profiles = getProfiles('TEST', {
    maven_profiles: {
      TEST: ['TEST', '!PROD']
    }
  });

  assert.deepEqual(profiles, ['TEST', '!PROD']);
});

test('buildMavenCommand builds WAR packaging commands correctly', () => {
  const command = buildMavenCommand(
    {
      packaging: 'war',
      isReactorBuild: false,
      relativePath: 'web-module'
    },
    'TEST',
    false,
    {
      maven_profiles: {
        TEST: ['TEST', '!PROD']
      }
    }
  );

  assert.deepEqual(command, ['clean', 'package', '-P', 'TEST,!PROD']);
});

test('buildMavenCommand builds reactor JAR commands correctly', () => {
  const command = buildMavenCommand(
    {
      packaging: 'jar',
      isReactorBuild: true,
      relativePath: 'services/core'
    },
    'none',
    true,
    {
      maven_profiles: {
        '': ['!TEST', '!PROD']
      }
    }
  );

  assert.deepEqual(command, [
    'clean',
    'install',
    '-pl',
    'services/core',
    '-am',
    '-P',
    '!TEST,!PROD',
    '-DskipTests=true'
  ]);
});
