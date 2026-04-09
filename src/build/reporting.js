import {
  formatCommand,
  formatDetail,
  joinDetails,
  printInfo,
  printSection,
  printSuccess,
  printWarning
} from '../output.js';

function showBuildPlan(plan) {
  printSection('build', [
    formatDetail('project', plan.project),
    formatDetail('module', plan.module.artifactId),
    formatDetail('packaging', plan.module.packaging)
  ]);

  const modulePath = plan.module.relativePath || 'root';
  printInfo(joinDetails([
    formatDetail('path', modulePath),
    formatDetail('profile', plan.effectiveProfile),
    plan.skipTests ? 'skip tests' : ''
  ]));
  printInfo(formatDetail('maven', formatCommand(plan.command, plan.commandArgs)));
}

function showBuildSuccess() {
  printSuccess('Maven build finished');
}

function showArtifactReport(artifactReport) {
  if (artifactReport.artifacts.length === 0) {
    printWarning(`no artifacts found in ${artifactReport.targetPath}`);
    return null;
  }

  printSection('artifacts', [formatDetail('count', artifactReport.artifacts.length)]);

  artifactReport.artifacts.forEach((artifact, index) => {
    printInfo(formatDetail(index === 0 ? 'primary' : 'extra', artifact));
  });

  return artifactReport.primaryArtifact;
}

function showRestartGuidance(decision) {
  const statusLabels = {
    required: 'required',
    recommended: 'recommended',
    'not-required': 'not needed',
    unknown: 'check manually'
  };

  printSection('restart', [statusLabels[decision.status] || statusLabels.unknown, decision.reason]);

  decision.matches.forEach((match) => {
    printInfo(`${match.severity} ${match.file} — ${match.reason}`);
  });
}

export {
  showBuildPlan,
  showBuildSuccess,
  showArtifactReport,
  showRestartGuidance
};
