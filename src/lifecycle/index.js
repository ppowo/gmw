const LIFECYCLE_STAGES = Object.freeze({
  PRE_DETECT: 'pre-detect',
  POST_DETECT: 'post-detect',
  PRE_BUILD: 'pre-build',
  POST_BUILD: 'post-build',
  ARTIFACT_FOUND: 'artifact-found',
  ARTIFACT_MISSING: 'artifact-missing',
  RESTART_REQUIRED: 'restart-required',
  RESTART_RECOMMENDED: 'restart-recommended',
  RESTART_NOT_REQUIRED: 'restart-not-required',
  RESTART_UNKNOWN: 'restart-unknown',
  PRE_DEPLOY: 'pre-deploy',
  POST_DEPLOY: 'post-deploy',
  REMOTE_COMMAND_GENERATED: 'remote-command-generated'
});

function createLifecycle(handlers = []) {
  const registeredHandlers = [...handlers];

  return {
    addHandlers(...newHandlers) {
      registeredHandlers.push(...newHandlers.flat());
      return this;
    },

    async emit(stage, context = {}) {
      for (const handler of registeredHandlers) {
        const stages = Array.isArray(handler.stage) ? handler.stage : [handler.stage];

        if (!stages.includes(stage)) {
          continue;
        }

        if (handler.matches && !handler.matches(context)) {
          continue;
        }

        await handler.run({ stage, ...context });
      }
    }
  };
}

function getRestartLifecycleStage(status) {
  switch (status) {
    case 'required':
      return LIFECYCLE_STAGES.RESTART_REQUIRED;
    case 'recommended':
      return LIFECYCLE_STAGES.RESTART_RECOMMENDED;
    case 'not-required':
      return LIFECYCLE_STAGES.RESTART_NOT_REQUIRED;
    default:
      return LIFECYCLE_STAGES.RESTART_UNKNOWN;
  }
}

export {
  LIFECYCLE_STAGES,
  createLifecycle,
  getRestartLifecycleStage
};
