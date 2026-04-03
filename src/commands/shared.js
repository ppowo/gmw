import { loadConfig, getClientConfig } from '../config.js';
import { detectProject } from '../project/detector.js';

function loadDetection(cwd) {
  const config = loadConfig();
  return detectProject(config, cwd);
}

function resolveClientSelection(projectConfig, requestedClient) {
  if (requestedClient) {
    return {
      clientName: requestedClient,
      clientConfig: getClientConfig(projectConfig, requestedClient),
      source: 'requested'
    };
  }

  if (projectConfig.default_client) {
    return {
      clientName: projectConfig.default_client,
      clientConfig: getClientConfig(projectConfig, projectConfig.default_client),
      source: 'default'
    };
  }

  if (projectConfig.clients && Object.keys(projectConfig.clients).length > 0) {
    const clientName = Object.keys(projectConfig.clients)[0];
    return {
      clientName,
      clientConfig: getClientConfig(projectConfig, clientName),
      source: 'first-available'
    };
  }

  return {
    clientName: null,
    clientConfig: null,
    source: 'none'
  };
}

export {
  loadDetection,
  resolveClientSelection
};
