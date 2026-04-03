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

This keeps the current project workflow:
- builds `dist/jmw`
- copies `dist/jmw` to `~/.bio/bin/`

You can also build manually:

```bash
npm run build
```

## Development

```bash
npm run dev
npm test
```

## Configuration

Configuration is now JavaScript-based.

Lookup order:
1. `~/.config/jmw/config.cjs`
2. `./config.cjs`
3. embedded defaults bundled into the CLI

Example config format:

```js
module.exports = {
  projects: {
    myproject: {
      base_path: '~/Work/myproject',
      reactor_build: true,
      maven_profiles: {
        '': ['!TEST', '!PROD'],
        TEST: ['TEST', '!PROD']
      },
      skip_tests: true,
      wildfly_root: '~/ApplicationServer/wildfly',
      wildfly_mode: 'standalone',
      clients: {
        demo: {
          host: 'my-host',
          user: 'root',
          wildfly_path: '/wildfly',
          restart_cmd: 'service wildfly restart'
        }
      },
      default_client: 'demo',
      global_modules: {}
    }
  },
  restart_rules: {
    patterns: []
  }
};
```

See `config.cjs` for the bundled defaults.

## Usage

```bash
jmw build
jmw build TEST --client metro
jmw deploy ./target/myapp.war
jmw clients
```
