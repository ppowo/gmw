import { spawn } from 'node:child_process';

function getJavaVersion() {
  return new Promise((resolve, reject) => {
    const child = spawn('java', ['-version'], {
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to execute java -version: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`java -version exited with code ${code}`));
        return;
      }

      const version = parseJavaVersion(stderr);
      if (!version) {
        reject(new Error('Could not parse Java version from output'));
        return;
      }

      resolve(version);
    });
  });
}

function parseJavaVersion(output) {
  // Match: openjdk version "17.0.18" or java version "1.8.0_421"
  const versionMatch = output.match(/version "(.+?)"/);
  if (!versionMatch) {
    return null;
  }

  const versionString = versionMatch[1];
  const majorVersion = extractMajorVersion(versionString);

  return {
    full: versionString,
    major: majorVersion
  };
}

function extractMajorVersion(versionString) {
  // Java 8 and earlier: 1.8.0_421 -> 8
  if (versionString.startsWith('1.')) {
    const match = versionString.match(/^1\.(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  // Java 9+: 17.0.18 -> 17
  const match = versionString.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function checkJavaVersion(requiredMajor, currentVersion) {
  return {
    valid: currentVersion.major === requiredMajor,
    required: requiredMajor,
    current: currentVersion
  };
}

export {
  getJavaVersion,
  parseJavaVersion,
  checkJavaVersion
};
