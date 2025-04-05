import { AsyncLocalStorage } from "async_hooks";
import { CumulativeCostTracker } from "./pricing-calculator";
type Store = {
  autopilot: boolean;
  costTracker: CumulativeCostTracker;
  showCostInfo: boolean;
  [key: string]: any;
};

const contextVars = new AsyncLocalStorage<Store>();

// Function to run code with a context
function runWithContext<T>(
  callback: () => T,
  initialStore: Partial<Store> = {},
): T {
  const store = {
    autopilot: false,
    showCostInfo: true,
    ...initialStore,
  } as Store;
  return contextVars.run(store, callback);
}

function setAutopilot(autopilot: boolean) {
  const store = contextVars.getStore();
  if (store) {
    store.autopilot = autopilot;
  }
}

function getAutopilot(): boolean | undefined {
  return contextVars.getStore()?.autopilot;
}

function getCostTracker(): CumulativeCostTracker | undefined {
  return contextVars.getStore()?.costTracker;
}

function setCostTracker(costTracker: CumulativeCostTracker) {
  const store = contextVars.getStore();
  if (store) {
    store.costTracker = costTracker;
  }
}

function setShowCostInfo(showCostInfo: boolean) {
  const store = contextVars.getStore();
  if (store) {
    store.showCostInfo = showCostInfo;
  }
}

function getShowCostInfo(): boolean | undefined {
  return contextVars.getStore()?.showCostInfo;
}

export {
  setAutopilot,
  getAutopilot,
  runWithContext,
  setCostTracker,
  getCostTracker,
  setShowCostInfo,
  getShowCostInfo,
};
