import {
  formatDetail,
  joinDetails,
  printError,
  printInfo,
  printSection,
  printWarning
} from '../output.js';
import { loadDetection } from './shared.js';

function registerClientsCommand(program) {
  program
    .command('clients')
    .description('Show available clients for current project')
    .action(() => {
      try {
        const detection = loadDetection();
        const clients = detection.projectConfig.clients;

        printSection('clients', [formatDetail('project', detection.project)]);

        if (!clients || Object.keys(clients).length === 0) {
          printWarning('no clients configured');
          return;
        }

        Object.entries(clients).forEach(([name, client]) => {
          printInfo(joinDetails([
            formatDetail('client', name),
            client.host ? `${client.user}@${client.host}` : 'no remote host'
          ]));
        });
      } catch (error) {
        printError(error.message);
        process.exit(1);
      }
    });
}

export {
  registerClientsCommand
};
