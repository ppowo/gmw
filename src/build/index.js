import { confirm } from '../utils.js';
import { printWarning } from '../output.js';
import { createBuildPlan, executeBuildPlan } from './maven.js';
import { collectArtifacts } from './artifacts.js';
import { evaluateRestartDecision } from './restart.js';
import { createLifecycle, getRestartLifecycleStage, LIFECYCLE_STAGES } from '../lifecycle/index.js';
import { createBuildLifecycleHandlers } from '../lifecycle/console-handlers.js';

async function buildModule(detection, profile, options = {}) {
  const plan = createBuildPlan(detection, profile, options);
  const lifecycle = options.lifecycle || createLifecycle(createBuildLifecycleHandlers());

  await lifecycle.emit(LIFECYCLE_STAGES.PRE_BUILD, {
    detection,
    plan,
    target: createBuildTarget(detection)
  });

  const confirmed = await confirm('jmw: run Maven build?');
  if (!confirmed) {
    printWarning('build cancelled');
    return null;
  }

  await executeBuildPlan(plan, options.runCommand);
  await lifecycle.emit(LIFECYCLE_STAGES.POST_BUILD, {
    detection,
    plan,
    target: createBuildTarget(detection)
  });

  const artifactReport = collectArtifacts(detection.module);
  await lifecycle.emit(
    artifactReport.primaryArtifact ? LIFECYCLE_STAGES.ARTIFACT_FOUND : LIFECYCLE_STAGES.ARTIFACT_MISSING,
    {
      detection,
      plan,
      artifactReport,
      target: createBuildTarget(detection)
    }
  );

  const restartDecision = await evaluateRestartDecision(detection.module, detection.restartRules, options.restartOptions);
  await lifecycle.emit(getRestartLifecycleStage(restartDecision.status), {
    detection,
    plan,
    artifactReport,
    restartDecision,
    target: createBuildTarget(detection)
  });

  return artifactReport.primaryArtifact;
}

function createBuildTarget(detection) {
  return {
    project: detection.project,
    packaging: detection.module.packaging,
    isGlobalModule: detection.module.isGlobalModule,
    isReactorBuild: detection.module.isReactorBuild,
    wildflyMode: detection.projectConfig.wildfly_mode || 'standalone'
  };
}

export {
  buildModule,
  createBuildTarget
};
