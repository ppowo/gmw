import path from 'node:path';
import prettyBytes from 'pretty-bytes';
import ms from 'ms';
import {
  formatDetail,
  joinDetails,
  printCommand,
  printInfo,
  printSection,
  printSuccess,
  printWarning
} from '../output.js';

function showDeploymentPlan(plan) {
  printSection('deploy', [
    formatDetail('project', plan.project),
    formatDetail('module', plan.module.artifactId),
    formatDetail('type', plan.module.isGlobalModule ? 'global-module' : 'application')
  ]);
  printInfo(formatDetail('artifact', plan.artifactPath));
  printInfo(joinDetails([
    formatDetail('mode', plan.wildflyConfig.mode),
    formatDetail('root', plan.wildflyConfig.root),
    plan.wildflyConfig.mode === 'domain'
      ? formatDetail('group', plan.wildflyConfig.serverGroup)
      : ''
  ]));
}

function showDeploymentSuccess() {
  printSuccess('WildFly deployment finished');
}

function showDeploymentSummary(result) {
  result.endTime = new Date();
  const duration = ms(result.endTime - result.startTime);

  printSection('summary', [
    formatDetail('actions', result.actions.length),
    formatDetail('duration', duration)
  ]);

  for (const action of result.actions) {
    switch (action.type) {
      case 'directory_created':
        printInfo(`mkdir ${action.path}`);
        break;
      case 'file_copied':
        printInfo(`copy ${path.basename(action.source)} → ${action.dest} (${prettyBytes(action.size)})`);
        break;
      case 'marker_created':
        printInfo(`touch ${action.path}`);
        break;
      case 'cli_deploy':
        printInfo(`jboss-cli ${action.cliPath}`);
        printCommand(action.command);
        break;
    }
  }
}

function showDeploymentRestartGuidance(wildflyConfig, moduleInfo) {
  const status = moduleInfo.isGlobalModule ? 'required' : 'verify deployment';
  const reason = moduleInfo.isGlobalModule
    ? 'global modules need a WildFly restart'
    : 'normal deployments usually hot deploy';
  const restartCommand = wildflyConfig.mode === 'standalone'
    ? `${wildflyConfig.root}/bin/shutdown.sh --restart`
    : `${wildflyConfig.root}/bin/domain.sh --restart`;

  printSection('restart', [status, reason]);
  printInfo('restart command');
  printCommand(restartCommand);
}

function showRemoteDeploymentGuide(remotePlan, clientName) {
  if (remotePlan.warning) {
    printWarning(clientName
      ? `remote commands for ${clientName}: ${remotePlan.warning}`
      : `remote commands: ${remotePlan.warning}`);
    return;
  }

  printSection('remote', clientName ? [formatDetail('client', clientName)] : []);

  remotePlan.steps.forEach((step, index) => {
    printInfo(`${index + 1}. ${step.title}`);
    printCommand(step.command);
  });
}

export {
  showDeploymentPlan,
  showDeploymentSuccess,
  showDeploymentSummary,
  showDeploymentRestartGuidance,
  showRemoteDeploymentGuide
};
