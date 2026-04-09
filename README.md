# jmw

Java Maven WildFly helper CLI for building Maven modules and deploying artifacts to WildFly.

## Requirements

- Node.js 20+
- Maven
- Access to the target WildFly installation(s)

## Install

```bash
npm install
```

Current workflow is preserved:
- `npm run build` builds `dist/jmw`
- `npm run install` copies `dist/jmw` to `~/.bio/bin/`

## Development

```bash
npm run dev
```

## Configuration

Configuration is source-owned and bundled into the CLI at build time.

- The config lives in `src/config.js`
- To change configuration, edit `src/config.js` and rebuild

There is no external runtime config lookup.

### Configuration Structure

```javascript
{
  projects: {
    <project-name>: {
      java_version: 17,
      base_path: '~/Work/<project>',
      reactor_build: false,
      default_profile: 'TEST',
      maven_profiles: {
        TEST: ['TEST', '!PROD'],
        PROD: ['PROD', '!TEST']
      },
      skip_tests: true,
      wildfly_root: '~/ApplicationServer/wildfly-<project>',
      wildfly_mode: 'domain', // or 'standalone'
      server_group: 'main-server-group', // for domain mode
      clients: {
        <client-name>: {
          host: 'SERVER-HOSTNAME',
          user: 'root',
          wildfly_path: '/opt/wildfly',
          restart_cmd: 'service wildfly restart',
          remote_copy_dir: '/root/war' // optional, defaults based on mode
        }
      },
      global_modules: {
        <ModuleName>: 'modules/<module-path>/main'
      }
    }
  },
  restart_rules: {
    patterns: [
      { match: 'entities/.*\\.java', reason: 'Entity class modification', severity: 'required' }
    ]
  }
}
```

## Architecture

The codebase is split into focused ESM modules:

- `src/cli.js` - CLI wiring
- `src/commands/` - command handlers (`build`, `deploy`, `clients`)
- `src/project/` - project and module detection
- `src/build/` - build planning, execution, artifacts, restart analysis
- `src/deploy/` - deployment planning, execution, remote command generation
- `src/lifecycle/` - lifecycle stages and handlers
- `src/config.js` - bundled configuration

## Lifecycle stages

The tool emits explicit lifecycle stages for maintainability:

- `pre-build` / `post-build`
- `artifact-found` / `artifact-missing`
- `restart-required` / `restart-recommended` / `restart-not-required` / `restart-unknown`
- `pre-deploy` / `post-deploy`
- `remote-command-generated`

Handlers react based on target context such as project, packaging, WildFly mode, and whether a module is global.

## Usage

```bash
jmw build
jmw build TEST --client <client-name>
jmw deploy ./target/myapp.war
jmw clients
```

### `jmw build`

Builds the Maven module in the current directory.

- Detects the project and module from `pom.xml` and `src/config.js`
- Validates Java version requirements
- Uses configured Maven profiles based on the profile argument
- With `--client`, generates remote deployment commands after build

### `jmw deploy <artifact>`

Deploys an artifact to the local WildFly installation.

The deployment behavior depends on the module type and WildFly mode:

#### Global Modules

For modules listed in `global_modules` config:

```
<wildfly_root>/<module.deploymentPath>/<artifact-name>
```

Example: `~/ApplicationServer/wildfly-xxx/modules/ejbpcs/main/EJBPcs.jar`

#### Standalone Mode

Artifacts are copied to the WildFly deployments directory with a deployment marker:

```
<wildfly_root>/standalone/deployments/<artifact-name>
<wildfly_root>/standalone/deployments/<artifact-name>.dodeploy
```

Example paths:
- `~/ApplicationServer/wildfly-xxx/standalone/deployments/myapp.war`
- `~/ApplicationServer/wildfly-xxx/standalone/deployments/myapp.war.dodeploy`

#### Domain Mode

Uses `jboss-cli.sh` for managed deployment:

```
<wildfly_root>/bin/jboss-cli.sh
```

Commands executed:
```
undeploy <artifact-name> --server-groups=<server-group>
deploy <artifact-path> --name=<artifact-name> --runtime-name=<artifact-name> --server-groups=<server-group>
```

### `jmw build --client <name>`

After building, generates remote deployment commands for the specified client. The commands vary based on deployment type:

#### Global Module Remote Deployment

1. `scp <artifact> <user>@<host>:<wildfly_path>/<module-path>/`
2. `ssh <user>@<host> "<restart_cmd>"`
3. `ssh <user>@<host> "tail -n 20 -f <wildfly_path>/<mode>/log/server.log"`

#### Standalone Remote Deployment

1. `scp <artifact> <user>@<host>:<wildfly_path>/standalone/deployments/`
2. `ssh <user>@<host> "touch <wildfly_path>/standalone/deployments/<artifact>.dodeploy"`
3. `ssh <user>@<host> "tail -n 20 -f <wildfly_path>/standalone/log/server.log"`

#### Domain Remote Deployment

1. `scp <artifact> <user>@<host>:/tmp/<artifact-name>`
2. `ssh <user>@<host> "<wildfly_path>/bin/jboss-cli.sh --connect --commands='deploy /tmp/<artifact-name> --name=<artifact-name> --runtime-name=<artifact-name> --server-groups=<server-group> --force'"`
3. `ssh <user>@<host> "tail -n 20 -f <wildfly_path>/domain/log/server.log"`

### `jmw clients`

Lists all configured clients for the current project with their connection details.

## License

MIT
