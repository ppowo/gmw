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

Configuration is now fully source-owned.

- The config lives in `src/config.js`
- It is bundled into the CLI at build time
- To change configuration, edit `src/config.js` and rebuild

There is no external runtime config lookup anymore.

## Architecture

The codebase is split into focused ESM modules:

- `src/cli.js` - CLI wiring
- `src/commands/` - command handlers
- `src/project/` - project and module detection
- `src/build/` - build planning, execution, artifacts, restart analysis
- `src/deploy/` - deployment planning, execution, remote command generation
- `src/lifecycle/` - lifecycle stages and handlers
- `src/config.js` - bundled configuration

## Lifecycle stages

The tool now emits explicit lifecycle stages for maintainability:

- `pre-build` / `post-build`
- `artifact-found` / `artifact-missing`
- `restart-required` / `restart-recommended` / `restart-not-required` / `restart-unknown`
- `pre-deploy` / `post-deploy`
- `remote-command-generated`

Handlers can react based on target context such as project, packaging, WildFly mode, and whether a module is global.

## Usage

```bash
jmw build
jmw build TEST --client metro
jmw deploy ./target/myapp.war
jmw clients
```
