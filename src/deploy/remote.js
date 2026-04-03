import path from 'node:path';

function createRemoteDeploymentPlan(artifactPath, wildflyConfig, clientConfig, moduleInfo, projectName = '') {
  const artifactName = path.basename(artifactPath);
  const artifactExtension = path.extname(artifactName).toLowerCase();
  const logPath = `${clientConfig.wildfly_path}/${wildflyConfig.mode}/log/server.log`;
  const sudo = clientConfig.user === 'root' ? '' : 'sudo ';
  const defaultRemoteCopyDir = wildflyConfig.mode === 'domain'
    ? '/tmp'
    : `${clientConfig.wildfly_path}/${wildflyConfig.mode}/deployments`;
  const remoteCopyDir = clientConfig.remote_copy_dir || defaultRemoteCopyDir;

  if (projectName === 'sinfomar') {
    if (artifactExtension !== '.war') {
      return {
        title: 'remote commands',
        variant: 'sinfomar-non-war',
        warning: `${artifactName} is not a .war`,
        steps: []
      };
    }

    return {
      title: 'remote commands',
      variant: 'sinfomar-war-copy',
      steps: [
        {
          title: 'Copy WAR to remote target',
          command: `scp ${artifactPath} ${clientConfig.user}@${clientConfig.host}:${remoteCopyDir}/`
        }
      ]
    };
  }

  if (moduleInfo?.isGlobalModule) {
    const modulesPath = `${clientConfig.wildfly_path}/${moduleInfo.deploymentPath}`;

    return {
      title: 'remote commands',
      variant: 'global-module',
      steps: [
        {
          title: 'Copy artifact to WildFly modules',
          command: `scp ${artifactPath} ${clientConfig.user}@${clientConfig.host}:${modulesPath}/`
        },
        {
          title: 'Restart WildFly (required for global modules)',
          command: `ssh ${clientConfig.user}@${clientConfig.host} "${clientConfig.restart_cmd}"`
        },
        {
          title: 'Watch server logs',
          command: `ssh ${clientConfig.user}@${clientConfig.host} "${sudo}tail -n 20 -f ${logPath}"`
        }
      ]
    };
  }

  if (wildflyConfig.mode === 'domain') {
    return {
      title: 'remote commands',
      variant: 'domain',
      steps: [
        {
          title: 'Copy artifact to WildFly host (temporary path)',
          command: `scp ${artifactPath} ${clientConfig.user}@${clientConfig.host}:/tmp/${artifactName}`
        },
        {
          title: 'Deploy using jboss-cli (domain mode)',
          command: `ssh ${clientConfig.user}@${clientConfig.host} "${sudo}${clientConfig.wildfly_path}/bin/jboss-cli.sh --connect --commands='deploy /tmp/${artifactName} --name=${artifactName} --runtime-name=${artifactName} --server-groups=${wildflyConfig.serverGroup} --force'"`
        },
        {
          title: 'Watch deployment logs',
          command: `ssh ${clientConfig.user}@${clientConfig.host} "${sudo}tail -n 20 -f ${logPath}"`
        }
      ]
    };
  }

  const deploymentsPath = `${clientConfig.wildfly_path}/${wildflyConfig.mode}/deployments`;

  return {
    title: 'remote commands',
    variant: 'standalone',
    steps: [
      {
        title: 'Copy artifact to WildFly',
        command: `scp ${artifactPath} ${clientConfig.user}@${clientConfig.host}:${deploymentsPath}/`
      },
      {
        title: 'Trigger hot deployment',
        command: `ssh ${clientConfig.user}@${clientConfig.host} "${sudo}touch ${deploymentsPath}/${artifactName}.dodeploy"`
      },
      {
        title: 'Watch deployment logs',
        command: `ssh ${clientConfig.user}@${clientConfig.host} "${sudo}tail -n 20 -f ${logPath}"`
      }
    ]
  };
}

export {
  createRemoteDeploymentPlan
};
