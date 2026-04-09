import { confirm } from '../utils.js';
import { printWarning } from '../output.js';
import { createDeploymentPlan, getWildflyConfig } from './wildfly.js';
import { createRemoteDeploymentPlan } from './remote.js';
import { executeDeploymentPlan, printDeploymentSummary } from './execution.js';
import { createLifecycle, LIFECYCLE_STAGES } from '../lifecycle/index.js';
import { createDeployLifecycleHandlers } from '../lifecycle/console-handlers.js';

async function deployArtifact(artifactPath, detection, options = {}) {
  const plan = createDeploymentPlan(artifactPath, detection);
  const lifecycle = options.lifecycle || createLifecycle(createDeployLifecycleHandlers());

  await lifecycle.emit(LIFECYCLE_STAGES.PRE_DEPLOY, {
    detection,
    plan,
    target: createDeployTarget(detection)
  });

  const confirmed = await confirm('jmw: deploy artifact to WildFly?');
  if (!confirmed) {
    printWarning('deployment cancelled');
    return null;
  }

  const result = executeDeploymentPlan(plan, options.result);
  printDeploymentSummary(result);
  await lifecycle.emit(LIFECYCLE_STAGES.POST_DEPLOY, {
    detection,
    plan,
    result,
    target: createDeployTarget(detection)
  });
  return result;
}

function createDeployTarget(detection) {
  return {
    project: detection.project,
    packaging: detection.module.packaging,
    isGlobalModule: detection.module.isGlobalModule,
    wildflyMode: detection.projectConfig.wildfly_mode || 'standalone'
  };
}

export {
  deployArtifact,
  getWildflyConfig,
  createDeploymentPlan,
  createRemoteDeploymentPlan,
  createDeployTarget
};
