import path from 'node:path';
import { globbySync } from 'globby';

function collectArtifacts(moduleInfo) {
  const targetPath = path.join(moduleInfo.path, 'target');
  const artifacts = findArtifacts(targetPath, moduleInfo.packaging);

  return {
    targetPath,
    artifacts,
    primaryArtifact: artifacts[0] ?? null
  };
}

function findArtifacts(targetPath, packaging) {
  const extensionMap = { ejb: 'jar', war: 'war', jar: 'jar', ear: 'ear', pom: 'pom' };
  const extension = extensionMap[packaging] || packaging;

  return globbySync(`*.${extension}`, { cwd: targetPath, absolute: true });
}

export {
  collectArtifacts,
  findArtifacts
};
