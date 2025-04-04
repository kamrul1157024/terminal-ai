const { AsyncLocalStorage } = require("async_hooks");

const contextVars = new AsyncLocalStorage();

function setAutopilot(autopilot: boolean) {
  const store = contextVars.getStore();
  if (store) {
    store.autopilot = autopilot;
  }
}

function getAutopilot() {
  return contextVars.getStore()?.autopilot;
}

export { setAutopilot, getAutopilot };
