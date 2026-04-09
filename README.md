# jmw

Java Maven WildFly helper CLI for building Maven modules and deploying artifacts to WildFly.

## Install

```bash
npm install
npm run build
npm run install  # copies to ~/.bio/bin/
```

## Usage

```bash
jmw build [profile] [--client <name>]
jmw deploy <artifact>
jmw clients
```

### `jmw build`

Builds the Maven module in the current directory. Use `--client` to generate remote deployment commands after build.

### `jmw deploy <artifact>`

Deploys an artifact (JAR/WAR) to the local WildFly. Shows full paths of all files copied/created:

- **Standalone**: copies to `<wildfly_root>/standalone/deployments/` with `.dodeploy` marker
- **Domain**: uses `jboss-cli.sh` to deploy to configured server group
- **Global modules**: copies to `<wildfly_root>/<deployment-path>/`

### `jmw clients`

Lists configured clients for remote deployment.

## Configuration

Edit `src/config.js` before building. Projects define:
- Java version, Maven profiles, WildFly path/mode
- Clients (SSH hosts) for remote deployment
- Global modules that require server restart

## License

MIT
