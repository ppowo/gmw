function getWildflyConfig(projectConfig) {
  return {
    root: projectConfig.wildfly_root,
    mode: projectConfig.wildfly_mode || 'standalone',
    serverGroup: projectConfig.server_group
  };
}

function createDeploymentPlan(artifactPath, detection) {
  const wildflyConfig = getWildflyConfig(detection.projectConfig);

  return {
    project: detection.project,
    projectConfig: detection.projectConfig,
    module: detection.module,
    artifactPath,
    wildflyConfig,
    deploymentType: detection.module.isGlobalModule ? 'Global Module' : 'Normal Deployment'
  };
}

export {
  getWildflyConfig,
  createDeploymentPlan
};
