import { AsyncLocalStorage } from "async_hooks";

import { ProfileConfig } from "../config/config";
import { CumulativeCostTracker } from "../services/pricing";

type Store = {
  costTracker: CumulativeCostTracker;
  showCostInfo: boolean;
  autoApprove: boolean;
  activeProfile?: ProfileConfig;
};

const contextVars = new AsyncLocalStorage<Store>();

// Function to run code with a context
function runWithContext<T>(
  callback: () => T,
  initialStore: Partial<Store> = {},
): T {
  const store = {
    autoApprove: false,
    showCostInfo: true,
    ...initialStore,
  } as Store;
  return contextVars.run(store, callback);
}

function setAutoApprove(autoApprove: boolean) {
  const store = contextVars.getStore();
  if (store) {
    store.autoApprove = autoApprove;
  }
}

function getAutoApprove(): boolean | undefined {
  return contextVars.getStore()?.autoApprove;
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

function setActiveProfile(profile: ProfileConfig | null) {
  const store = contextVars.getStore();
  if (store && profile) {
    store.activeProfile = profile;
  }
}

function getActiveProfile(): ProfileConfig | undefined {
  return contextVars.getStore()?.activeProfile;
}

export {
  setAutoApprove,
  getAutoApprove,
  runWithContext,
  setCostTracker,
  getCostTracker,
  setShowCostInfo,
  getShowCostInfo,
  setActiveProfile,
  getActiveProfile,
};
