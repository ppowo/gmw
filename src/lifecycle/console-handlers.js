import { LIFECYCLE_STAGES } from './index.js';
import {
  showBuildPlan,
  showBuildSuccess,
  showArtifactReport,
  showRestartGuidance
} from '../build/reporting.js';
import {
  showDeploymentPlan,
  showDeploymentSuccess,
  showDeploymentSummary,
  showDeploymentRestartGuidance,
  showRemoteDeploymentGuide
} from '../deploy/reporting.js';

function createBuildLifecycleHandlers() {
  return [
    {
      stage: LIFECYCLE_STAGES.PRE_BUILD,
      run: ({ plan }) => showBuildPlan(plan)
    },
    {
      stage: LIFECYCLE_STAGES.POST_BUILD,
      run: () => showBuildSuccess()
    },
    {
      stage: [LIFECYCLE_STAGES.ARTIFACT_FOUND, LIFECYCLE_STAGES.ARTIFACT_MISSING],
      run: ({ artifactReport }) => showArtifactReport(artifactReport)
    },
    {
      stage: [
        LIFECYCLE_STAGES.RESTART_REQUIRED,
        LIFECYCLE_STAGES.RESTART_RECOMMENDED,
        LIFECYCLE_STAGES.RESTART_NOT_REQUIRED,
        LIFECYCLE_STAGES.RESTART_UNKNOWN
      ],
      run: ({ restartDecision }) => showRestartGuidance(restartDecision)
    }
  ];
}

function createDeployLifecycleHandlers() {
  return [
    {
      stage: LIFECYCLE_STAGES.PRE_DEPLOY,
      run: ({ plan }) => showDeploymentPlan(plan)
    },
    {
      stage: LIFECYCLE_STAGES.POST_DEPLOY,
      run: ({ plan, result }) => {
        showDeploymentSuccess();
        showDeploymentSummary(result);
        showDeploymentRestartGuidance(plan.wildflyConfig, plan.module);
      }
    }
  ];
}

function createRemoteLifecycleHandlers() {
  return [
    {
      stage: LIFECYCLE_STAGES.REMOTE_COMMAND_GENERATED,
      run: ({ remotePlan, target }) => showRemoteDeploymentGuide(remotePlan, target?.clientName)
    }
  ];
}

export {
  createBuildLifecycleHandlers,
  createDeployLifecycleHandlers,
  createRemoteLifecycleHandlers
};
