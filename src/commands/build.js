import path from 'node:path';
import {
  buildModule,
  createBuildTarget
} from '../build/index.js';
import {
  getWildflyConfig,
  createRemoteDeploymentPlan
} from '../deploy/index.js';
import { createLifecycle, LIFECYCLE_STAGES } from '../lifecycle/index.js';
import {
  createBuildLifecycleHandlers,
  createRemoteLifecycleHandlers
} from '../lifecycle/console-handlers.js';
import {
  formatDetail,
  joinDetails,
  printError,
  printInfo
} from '../output.js';
import { loadDetection, resolveClientSelection } from './shared.js';

function registerBuildCommand(program) {
  program
    .command('build')
    .description('Build a Maven module')
    .argument('[profile]', 'Maven profile (e.g., TEST, PROD)')
    .option('-c, --client <name>', 'Target client (shows remote commands after build)')
    .option('--skip-tests', 'Skip tests during build')
    .action(async (profile, options) => {
      try {
        const detection = loadDetection();
        assertValidBuildLocation(detection);

        const clientSelection = resolveClientSelection(detection.projectConfig, options.client);

        assertClientRequired(detection.projectConfig, clientSelection);
        printBuildContext(clientSelection);

        const lifecycle = createLifecycle([
          ...createBuildLifecycleHandlers(),
          ...createRemoteLifecycleHandlers()
        ]);

        const artifactPath = await buildModule(detection, profile, {
          skipTests: options.skipTests,
          lifecycle
        });

        if (clientSelection.clientConfig && artifactPath) {
          const remotePlan = createRemoteDeploymentPlan(
            artifactPath,
            getWildflyConfig(detection.projectConfig),
            clientSelection.clientConfig,
            detection.module,
            detection.project
          );

          await lifecycle.emit(LIFECYCLE_STAGES.REMOTE_COMMAND_GENERATED, {
            detection,
            remotePlan,
            target: {
              ...createBuildTarget(detection),
              clientName: clientSelection.clientName
            }
          });
        }
      } catch (error) {
        printError(error.message);
        process.exit(1);
      }
    });
}

function assertValidBuildLocation(detection, cwd = process.cwd()) {
  if (!detection.module.isReactorBuild || detection.module.relativePath !== '' || detection.module.packaging !== 'pom') {
    return;
  }

  const currentPath = path.resolve(cwd);
  const modulePath = path.resolve(detection.module.path);

  if (currentPath === modulePath) {
    throw new Error(`Reactor root '${detection.module.artifactId}' is not a valid build target. Run jmw from a module directory.`);
  }

  const attemptedPath = path.relative(modulePath, currentPath) || currentPath;
  throw new Error(`No module pom.xml found for '${attemptedPath}'. Run jmw from a module directory instead of falling back to reactor root '${detection.module.artifactId}'.`);
}

function assertClientRequired(projectConfig, clientSelection) {
  if (clientSelection.clientConfig) {
    return;
  }

  const availableClients = projectConfig.clients ? Object.keys(projectConfig.clients) : [];
  
  if (availableClients.length > 0) {
    throw new Error(`Client required. Available clients: ${availableClients.join(', ')}`);
  }
}

function printBuildContext(clientSelection) {
  if (!clientSelection.clientConfig) {
    return;
  }

  const sourceLabels = {
    requested: 'requested'
  };

  printInfo(joinDetails([
    formatDetail('client', clientSelection.clientName),
    sourceLabels[clientSelection.source] || ''
  ]));
}

export {
  registerBuildCommand,
  printBuildContext
};
