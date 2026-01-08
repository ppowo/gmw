import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { confirm } from './utils.js';

/**
 * Format file size in human-readable format
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create a new deployment result tracker
 */
function createDeploymentResult() {
  return {
    actions: [],
    startTime: new Date(),
    endTime: null
  };
}

/**
 * Track a file copy action
 */
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

/**
 * Track a directory creation
 */
function trackDirCreated(result, dirPath) {
  result.actions.push({
    type: 'directory_created',
    path: dirPath,
    timestamp: new Date()
  });
}

/**
 * Track a marker file creation
 */
function trackMarkerCreated(result, markerPath) {
  result.actions.push({
    type: 'marker_created',
    path: markerPath,
    timestamp: new Date()
  });
}

/**
 * Display deployment summary
 */
function showDeploymentSummary(result) {
  result.endTime = new Date();
  const duration = ((result.endTime - result.startTime) / 1000).toFixed(2);

  console.log('');
  console.log(chalk.blue('=== What Was Done ==='));
  console.log(`Started: ${result.startTime.toLocaleTimeString()}`);
  console.log('');
  console.log('Actions:');

  for (const action of result.actions) {
    switch (action.type) {
      case 'directory_created':
        console.log(`  Created directory: ${action.path}`);
        break;
      case 'file_copied':
        console.log(`  Copied file: ${path.basename(action.source)} → ${action.dest} (${formatSize(action.size)})`);
        break;
      case 'marker_created':
        console.log(`  Created marker: ${action.path}`);
        break;
    }
  }

  console.log('');
  console.log(`Duration: ${duration}s`);
}

/**
 * Deploy artifact to WildFly
 */
async function deployArtifact(artifactPath, detection) {
  const { project, projectConfig, module: moduleInfo } = detection;

  console.log(chalk.blue('=== Deployment Plan ==='));
  console.log(`Project: ${project}`);
  console.log(`Artifact: ${artifactPath}`);
  console.log(`Module: ${moduleInfo.artifactId}`);
  console.log(`Type: ${moduleInfo.isGlobalModule ? 'Global Module' : 'Normal Deployment'}`);

  // Get WildFly configuration (local deployment)
  const wildflyConfig = getWildflyConfig(projectConfig, null);

  console.log(chalk.yellow('WildFly Root:'), wildflyConfig.root);
  console.log(chalk.yellow('Mode:'), wildflyConfig.mode);
  if (wildflyConfig.mode === 'domain') {
    console.log(chalk.yellow('Server Group:'), wildflyConfig.serverGroup);
  }

  // Confirm deployment
  const confirmed = await confirm('Proceed with deployment?');
  if (!confirmed) {
    console.log(chalk.red('Deployment cancelled'));
    return;
  }

  // Execute deployment
  const result = createDeploymentResult();

  try {
    if (moduleInfo.isGlobalModule) {
      await deployGlobalModule(artifactPath, wildflyConfig, moduleInfo, result);
    } else {
      await deployNormal(artifactPath, wildflyConfig, moduleInfo, result);
    }

    console.log(chalk.green('Deployment completed'));

    // Show what was done
    showDeploymentSummary(result);

    // Show restart guidance
    showRestartGuidance(wildflyConfig, moduleInfo);

    // Show remote deployment guide if configured (use default client)
    const defaultClientName = projectConfig.default_client;
    if (defaultClientName && projectConfig.clients && projectConfig.clients[defaultClientName]) {
      const defaultClient = projectConfig.clients[defaultClientName];
      console.log('');
      console.log(chalk.blue(`=== Remote Deployment Instructions (Default Client: ${defaultClientName}) ===`));
      showRemoteDeploymentGuide(artifactPath, wildflyConfig, defaultClient, moduleInfo);
    }

  } catch (error) {
    console.error(chalk.red('Deployment failed:'), error.message);
    throw error;
  }
}

/**
 * Deploy global module to WildFly modules directory
 */
function deployGlobalModule(artifactPath, wildflyConfig, moduleInfo, result) {
  // deploymentPath already contains the full path from wildfly_root (e.g., "modules/ejbmto/main")
  const modulePath = path.join(wildflyConfig.root, moduleInfo.deploymentPath);

  console.log(chalk.blue('=== Global Module Deployment ==='));
  console.log(`Source: ${artifactPath}`);
  console.log(`Target: ${modulePath}`);

  // Create directory if needed
  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath, { recursive: true });
    trackDirCreated(result, modulePath);
  }

  // Copy artifact
  const destPath = path.join(modulePath, path.basename(artifactPath));
  fs.copyFileSync(artifactPath, destPath);
  trackFileCopy(result, artifactPath, destPath);

  console.log(chalk.green('Module deployed to: ' + destPath));
}

/**
 * Deploy to normal WildFly deployments
 */
function deployNormal(artifactPath, wildflyConfig, moduleInfo, result) {
  console.log(chalk.blue('=== Normal Deployment ==='));

  if (wildflyConfig.mode === 'standalone') {
    deployStandalone(artifactPath, wildflyConfig, moduleInfo, result);
  } else {
    deployDomain(artifactPath, wildflyConfig, moduleInfo, result);
  }
}

/**
 * Deploy to standalone mode
 */
function deployStandalone(artifactPath, wildflyConfig, moduleInfo, result) {
  const deploymentsDir = path.join(wildflyConfig.root, 'standalone', 'deployments');
  const destPath = path.join(deploymentsDir, path.basename(artifactPath));
  const markerPath = path.join(deploymentsDir, path.basename(artifactPath) + '.dodeploy');

  console.log(`Target: ${destPath}`);

  // Create directory if needed
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
    trackDirCreated(result, deploymentsDir);
  }

  // Copy artifact
  fs.copyFileSync(artifactPath, destPath);
  trackFileCopy(result, artifactPath, destPath);

  // Create marker file
  fs.writeFileSync(markerPath, '');
  trackMarkerCreated(result, markerPath);

  console.log(chalk.green('Deployed to: ' + destPath));
  console.log(chalk.green('Marker created: ' + markerPath));
}

/**
 * Deploy to domain mode
 */
function deployDomain(artifactPath, wildflyConfig, moduleInfo, result) {
  const artifactName = path.basename(artifactPath);
  const deploymentsDir = path.join(wildflyConfig.root, 'domain', 'deployments');

  console.log(`Server Group: ${wildflyConfig.serverGroup}`);
  console.log(`Artifact: ${artifactName}`);
  console.log(chalk.yellow('Use jboss-cli.sh to deploy:'));
  console.log(`  deploy ${artifactPath} --server-groups=${wildflyConfig.serverGroup}`);

  // Create directory if needed
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
    trackDirCreated(result, deploymentsDir);
  }

  // Copy to deployments dir (for reference)
  const destPath = path.join(deploymentsDir, artifactName);
  fs.copyFileSync(artifactPath, destPath);
  trackFileCopy(result, artifactPath, destPath);

  console.log(chalk.green('Copied to: ' + destPath));
}

/**
 * Get WildFly configuration (local deployment)
 */
function getWildflyConfig(projectConfig, clientConfig) {
  const config = {
    root: projectConfig.wildfly_root,
    mode: projectConfig.wildfly_mode || 'standalone',
    serverGroup: projectConfig.server_group
  };

  return config;
}

/**
 * Show restart guidance
 */
function showRestartGuidance(wildflyConfig, moduleInfo) {
  console.log(chalk.blue('=== Restart Guidance ==='));

  if (moduleInfo.isGlobalModule) {
    console.log(chalk.red('Restart required: YES'));
    console.log('Global modules require WildFly restart.');
  } else {
    console.log(chalk.yellow('Restart required: Check deployment'));
    console.log('Normal deployments may not require restart.');
  }

  console.log('');
  console.log(chalk.yellow('Restart command:'));

  if (wildflyConfig.mode === 'standalone') {
    console.log(`  ${wildflyConfig.root}/bin/shutdown.sh --restart`);
  } else {
    console.log(`  ${wildflyConfig.root}/bin/domain.sh --restart`);
  }
}

/**
 * Show remote deployment guide
 */
function showRemoteDeploymentGuide(artifactPath, wildflyConfig, clientConfig, moduleInfo) {
  const artifactName = path.basename(artifactPath);
  const logPath = clientConfig.wildfly_path + '/' + wildflyConfig.mode + '/log/server.log';

  // Use sudo only if not root
  const sudo = clientConfig.user === 'root' ? '' : 'sudo ';

  if (moduleInfo && moduleInfo.isGlobalModule) {
    // Global module deployment - copy to modules directory and restart
    const modulesPath = clientConfig.wildfly_path + '/' + moduleInfo.deploymentPath;

    console.log(chalk.yellow('1. Copy artifact to WildFly modules:'));
    console.log(`   scp ${artifactPath} ${clientConfig.user}@${clientConfig.host}:${modulesPath}/`);
    console.log('');
    console.log(chalk.yellow('2. Restart WildFly (required for global modules):'));
    console.log(`   ssh ${clientConfig.user}@${clientConfig.host} "${clientConfig.restart_cmd}"`);
    console.log('');
    console.log(chalk.yellow('3. Watch server logs:'));
    console.log(`   ssh ${clientConfig.user}@${clientConfig.host} "${sudo}tail -n 20 -f ${logPath}"`);
  } else {
    // Normal hot deployment
    const deploymentsPath = clientConfig.wildfly_path + '/' + wildflyConfig.mode + '/deployments';

    console.log(chalk.yellow('1. Copy artifact to WildFly:'));
    console.log(`   scp ${artifactPath} ${clientConfig.user}@${clientConfig.host}:${deploymentsPath}/`);
    console.log('');
    console.log(chalk.yellow('2. Trigger hot deployment:'));
    console.log(`   ssh ${clientConfig.user}@${clientConfig.host} "${sudo}touch ${deploymentsPath}/${artifactName}.dodeploy"`);
    console.log('');
    console.log(chalk.yellow('3. Watch deployment logs:'));
    console.log(`   ssh ${clientConfig.user}@${clientConfig.host} "${sudo}tail -n 20 -f ${logPath}"`);
  }
}

export {
  deployArtifact,
  getWildflyConfig,
  deployGlobalModule,
  deployNormal,
  deployStandalone,
  deployDomain,
  showRestartGuidance,
  showRemoteDeploymentGuide
};
