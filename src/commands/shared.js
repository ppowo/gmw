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
