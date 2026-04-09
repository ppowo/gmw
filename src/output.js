import chalk from 'chalk';
import logSymbols from 'log-symbols';

const PREFIX = chalk.cyan.bold('jmw ›');
const DETAIL_SEPARATOR = chalk.dim(' · ');

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function formatDetail(label, value) {
  if (!hasValue(value)) {
    return '';
  }

  return `${chalk.bold(label)} ${value}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatCommand(command, args = []) {
  return [command, ...args].filter(hasValue).join(' ');
}

function joinDetails(details = []) {
  return details.filter(hasValue).join(DETAIL_SEPARATOR);
}

function renderSection(title, details = []) {
  const suffix = joinDetails(details);
  const message = suffix
    ? `${chalk.bold(title)}${DETAIL_SEPARATOR}${suffix}`
    : chalk.bold(title);

  return `${PREFIX} ${message}`;
}

function renderInfo(message) {
  return `${PREFIX} ${message}`;
}

function renderSuccess(message) {
  return `${PREFIX} ${logSymbols.success} ${chalk.green(message)}`;
}

function renderWarning(message) {
  return `${PREFIX} ${logSymbols.warning} ${chalk.yellow(message)}`;
}

function renderError(message) {
  return `${PREFIX} ${logSymbols.error} ${chalk.red(message)}`;
}

function printSection(title, details = []) {
  console.log(renderSection(title, details));
}

function printInfo(message) {
  console.log(renderInfo(message));
}

function printSuccess(message) {
  console.log(renderSuccess(message));
}

function printWarning(message) {
  console.log(renderWarning(message));
}

function printError(message) {
  console.error(renderError(message));
}

function printCommand(command) {
  console.log(`      ${command}`);
}

export {
  formatCommand,
  formatDetail,
  formatBytes,
  joinDetails,
  renderSection,
  renderInfo,
  renderSuccess,
  renderWarning,
  renderError,
  printSection,
  printInfo,
  printSuccess,
  printWarning,
  printError,
  printCommand
};
