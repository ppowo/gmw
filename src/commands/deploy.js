import fs from 'node:fs';
import path from 'node:path';
import { deployArtifact } from '../deploy/index.js';
import { createLifecycle } from '../lifecycle/index.js';
import { createDeployLifecycleHandlers } from '../lifecycle/console-handlers.js';
import {
  formatDetail,
  printError,
  printInfo,
  printSection
} from '../output.js';
import { loadDetection } from './shared.js';

function registerDeployCommand(program) {
  program
    .command('deploy')
    .description('Deploy artifact to WildFly')
    .argument('<artifact>', 'Path to artifact JAR/WAR file')
    .action(async (artifact) => {
      try {
        const detection = loadDetection();
        const artifactPath = validateArtifactPath(artifact);
        const lifecycle = createLifecycle([
          ...createDeployLifecycleHandlers()
        ]);

        await deployArtifact(artifactPath, detection, { lifecycle });
      } catch (error) {
        printError(error.message);
        process.exit(1);
      }
    });
}

function validateArtifactPath(artifact) {
  const artifactPath = path.resolve(artifact);

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }

  return artifactPath;
}

function printDeployContext(detection, artifact) {
  printSection('deploy', [
    formatDetail('project', detection.project),
    formatDetail('module', detection.module.artifactId)
  ]);
  printInfo(formatDetail('artifact', artifact));
}

export {
  registerDeployCommand,
  validateArtifactPath,
  printDeployContext
};
