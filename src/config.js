import untildify from 'untildify';

const config = {
  projects: {
    sinfomar: {
      java_version: 17,
      base_path: '~/Work/SinfomarSuite',
      reactor_build: false,
      default_profile: 'TEST',
      maven_profiles: {
        TEST: ['TEST', '!PROD'],
        PROD: ['PROD', '!TEST']
      },
      skip_tests: true,
      wildfly_root: '~/ApplicationServer/wildfly-sinfomar',
      wildfly_mode: 'domain',
      server_group: 'other-server-group',
      clients: {
        trieste: {
          host: 'TEST-SINFOMAR-TRIESTE-111',
          user: 'root',
          wildfly_path: '/opt/wildfly',
          restart_cmd: 'service wildfly restart',
          remote_copy_dir: '/root/war'
        }
      },
      global_modules: {
        AllWebServiceClient: 'modules/ejbpcs/main',
        EJBPcs: 'modules/ejbpcs/main',
        EJBPcsRemote: 'modules/ejbpcs/main'
      }
    },
    mto: {
      java_version: 11,
      base_path: '~/Work/mto-suite',
      reactor_build: true,
      maven_profiles: {
        '': ['!TEST', '!PROD']
      },
      skip_tests: true,
      wildfly_root: '~/ApplicationServer/wildfly-mto-3_0',
      wildfly_mode: 'standalone',
      clients: {
        metro: {
          host: 'TEST-MTO-METROCARGO-101',
          user: 'root',
          wildfly_path: '/wildfly',
          restart_cmd: 'service wildfly restart'
        },
        psa: {
          host: 'TEST-MTO-PSA-102',
          user: 'root',
          wildfly_path: '/wildfly',
          restart_cmd: 'service wildfly restart'
        }
      },
      global_modules: {
        EJBMtoRemote: 'modules/ejbmto/main'
      }
    }
  },
  restart_rules: {
    patterns: [
      {
        match: 'entities/.*\\.java',
        reason: 'Entity class modification',
        severity: 'required'
      },
      {
        match: 'hibernate\\.cfg\\.xml',
        reason: 'Hibernate configuration change',
        severity: 'required'
      },
      {
        match: 'EJB.*\\.java',
        reason: 'EJB implementation change',
        severity: 'recommended'
      }
    ]
  }
};

function loadConfig() {
  return expandPaths(cloneConfig(config));
}

function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}

function expandPaths(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(expandPaths);

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? untildify(value)
        : typeof value === 'object'
          ? expandPaths(value)
          : value
    ])
  );
}

function getClientConfig(project, clientName) {
  if (!clientName) return null;

  if (!project.clients || !project.clients[clientName]) {
    const available = project.clients ? Object.keys(project.clients).join(', ') : 'none';
    throw new Error(`Client '${clientName}' not found. Available clients: ${available}`);
  }

  return project.clients[clientName];
}

export {
  config,
  loadConfig,
  getClientConfig,
  expandPaths
};

export default config;