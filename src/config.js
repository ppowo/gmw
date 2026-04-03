import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import defaultConfig from '../config.cjs';
import untildify from 'untildify';
const require = createRequire(path.resolve(process.cwd(), '__jmw_loader__.cjs'));

/**
 * Load and parse config.cjs
 * Expands ~ paths to home directory
 * Supports client parameter for remote deployments
 */
function loadConfig(configPath) {
  if (!configPath) {
    configPath = path.join(os.homedir(), '.config', 'jmw', 'config.cjs');
  }

  try {
    // Try user config first
    if (fs.existsSync(configPath)) {
      return loadJsConfigFile(configPath);
    }

    // Fall back to config.cjs in project directory
    const localConfig = path.join(process.cwd(), 'config.cjs');
    if (fs.existsSync(localConfig)) {
      return loadJsConfigFile(localConfig);
    }

    // Fall back to embedded defaults so bundled builds keep working after copy/install
    return expandPaths(cloneConfig(defaultConfig));
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

function loadJsConfigFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  delete require.cache[resolvedPath];

  const config = require(resolvedPath);
  return expandPaths(cloneConfig(config));
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
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
