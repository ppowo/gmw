import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  formatDetail,
  formatBytes,
  joinDetails,
  printCommand,
  printInfo,
  printSection,
  printSuccess
} from '../output.js';

function createDeploymentResult() {
  return {
    actions: [],
    startTime: new Date(),
    endTime: null
  };
}

function trackFileCopy(result, source, dest) {
  const stats = fs.statSync(dest);
  result.actions.push({
    type: 'file_copied',
    source,
    dest,
    size: stats.size,
    timestamp: new Date()
  });
}

function trackDirCreated(result, dirPath) {
  result.actions.push({
    type: 'directory_created',
    path: dirPath,
    timestamp: new Date()
  });
}

function trackMarkerCreated(result, markerPath) {
  result.actions.push({
    type: 'marker_created',
    path: markerPath,
    timestamp: new Date()
  });
}

function trackCliDeploy(result, cliPath, command) {
  result.actions.push({
    type: 'cli_deploy',
    cliPath,
    command,
    timestamp: new Date()
  });
}

function executeDeploymentPlan(plan, result = createDeploymentResult()) {
  if (plan.module.isGlobalModule) {
    deployGlobalModule(plan.artifactPath, plan.wildflyConfig, plan.module, result);
  } else {
    deployNormal(plan.artifactPath, plan.wildflyConfig, plan.module, result);
  }

  return result;
}

function deployGlobalModule(artifactPath, wildflyConfig, moduleInfo, result) {
  const modulePath = path.join(wildflyConfig.root, moduleInfo.deploymentPath);

  printSection('apply deployment', [
    formatDetail('mode', 'global-module'),
    formatDetail('target', modulePath)
  ]);

  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath, { recursive: true });
    trackDirCreated(result, modulePath);
  }

  const destPath = path.join(modulePath, path.basename(artifactPath));
  fs.copyFileSync(artifactPath, destPath);
  trackFileCopy(result, artifactPath, destPath);
}

function deployNormal(artifactPath, wildflyConfig, moduleInfo, result) {
  if (wildflyConfig.mode === 'standalone') {
    deployStandalone(artifactPath, wildflyConfig, moduleInfo, result);
  } else {
    deployDomain(artifactPath, wildflyConfig, result);
  }
}

function deployStandalone(artifactPath, wildflyConfig, _moduleInfo, result) {
  const deploymentsDir = path.join(wildflyConfig.root, 'standalone', 'deployments');
  const destPath = path.join(deploymentsDir, path.basename(artifactPath));
  const markerPath = path.join(deploymentsDir, `${path.basename(artifactPath)}.dodeploy`);

  printSection('apply deployment', [
    formatDetail('mode', 'standalone'),
    formatDetail('target', destPath)
  ]);

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
    trackDirCreated(result, deploymentsDir);
  }

  fs.copyFileSync(artifactPath, destPath);
  trackFileCopy(result, artifactPath, destPath);

  fs.writeFileSync(markerPath, '');
  trackMarkerCreated(result, markerPath);
}

function deployDomain(artifactPath, wildflyConfig, result) {
  const artifactName = path.basename(artifactPath);
  const cliPath = path.join(wildflyConfig.root, 'bin', 'jboss-cli.sh');

  if (!wildflyConfig.serverGroup) {
    throw new Error('Missing server_group in configuration for domain mode');
  }

  printSection('apply deployment', [
    formatDetail('mode', 'domain'),
    formatDetail('group', wildflyConfig.serverGroup)
  ]);
  printInfo(joinDetails([
    formatDetail('artifact', artifactName),
    formatDetail('cli', cliPath)
  ]));

  if (!fs.existsSync(cliPath)) {
    throw new Error(`jboss-cli.sh not found: ${cliPath}`);
  }

  const deployCommand = `deploy ${artifactPath} --name=${artifactName} --runtime-name=${artifactName} --server-groups=${wildflyConfig.serverGroup}`;
  const undeployCommand = `undeploy ${artifactName} --server-groups=${wildflyConfig.serverGroup}`;

  printInfo('jboss-cli deploy command');
  printCommand(deployCommand);

  try {
    try {
      execFileSync(cliPath, ['--connect', `--commands=${undeployCommand}`], {
        stdio: 'inherit'
      });
    } catch {
      // Ignore undeploy failures.
    }

    execFileSync(cliPath, ['--connect', `--commands=${deployCommand}`], {
      stdio: 'inherit'
    });

    trackCliDeploy(result, cliPath, `${undeployCommand} ; ${deployCommand}`);
  } catch (error) {
    throw new Error(`Domain deployment failed via jboss-cli.sh: ${error.message}`);
  }
}

function printDeploymentSummary(result) {
  result.endTime = new Date();
  const duration = result.endTime - result.startTime;

  printSuccess('deployment complete');
  printInfo(`duration: ${duration}ms`);

  for (const action of result.actions) {
    switch (action.type) {
      case 'file_copied':
        printInfo(`copied ${formatBytes(action.size)}`);
        printInfo(`  from: ${action.source}`);
        printInfo(`  to:   ${action.dest}`);
        break;
      case 'directory_created':
        printInfo(`created directory: ${action.path}`);
        break;
      case 'marker_created':
        printInfo(`created marker: ${action.path}`);
        break;
      case 'cli_deploy':
        printInfo(`executed via: ${action.cliPath}`);
        break;
    }
  }
}
export {
  createDeploymentResult,
  executeDeploymentPlan,
  deployGlobalModule,
  deployNormal,
  deployStandalone,
  deployDomain,
  printDeploymentSummary
};
