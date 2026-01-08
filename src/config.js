import yaml from 'js-yaml';
import fs from 'fs';
import os from 'os';
import path from 'path';
import untildify from 'untildify';
import embeddedConfig from '../config.yaml';

/**
 * Load and parse config.yaml
 * Expands ~ paths to home directory
 * Supports client parameter for remote deployments
 */
function loadConfig(configPath) {
  if (!configPath) {
    configPath = path.join(os.homedir(), '.config', 'jmw', 'config.yaml');
  }

  try {
    // Try user config first
    if (fs.existsSync(configPath)) {
      const doc = yaml.load(fs.readFileSync(configPath, 'utf8'));
      return expandPaths(doc);
    }

    // Fall back to config.yaml in project directory
    const localConfig = path.join(process.cwd(), 'config.yaml');
    if (fs.existsSync(localConfig)) {
      const doc = yaml.load(fs.readFileSync(localConfig, 'utf8'));
      return expandPaths(doc);
    }

    // Fall back to embedded config (Bun's YAML loader automatically parses it)
    return expandPaths(embeddedConfig);
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

/**
 * Expand ~ paths to home directory (recursive)
 */
function expandPaths(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(expandPaths);

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === 'string' ? untildify(value) :
      typeof value === 'object' ? expandPaths(value) : value
    ])
  );
}

/**
 * Get client configuration for a project
 */
function getClientConfig(project, clientName) {
  if (!clientName) return null;

  if (!project.clients || !project.clients[clientName]) {
    const available = project.clients ? Object.keys(project.clients).join(', ') : 'none';
    throw new Error(`Client '${clientName}' not found. Available clients: ${available}`);
  }

  return project.clients[clientName];
}

export {
  loadConfig,
  getClientConfig,
  expandPaths
};
