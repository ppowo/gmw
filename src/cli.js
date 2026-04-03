import { Command } from 'commander';
import { registerBuildCommand } from './commands/build.js';
import { registerDeployCommand } from './commands/deploy.js';
import { registerClientsCommand } from './commands/clients.js';

const program = new Command();

program
  .name('jmw')
  .description('Java Maven WildFly - Interactive deployment helper')
  .version('2.0.0');

registerBuildCommand(program);
registerDeployCommand(program);
registerClientsCommand(program);

const helpText = `
Examples:

  $ jmw build
  $ jmw build TEST
  $ jmw build TEST --client metrocargo
  $ jmw deploy ./target/myapp.jar
  $ jmw clients

For more information: https://github.com/ppowo/jmw
`;

program.addHelpText('after', helpText);
program.parse();
