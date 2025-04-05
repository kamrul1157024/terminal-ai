import { AsyncLocalStorage } from 'async_hooks';

// Define a type for the store to properly type the context
type Store = {
  autopilot: boolean;
  [key: string]: any;
};

const contextVars = new AsyncLocalStorage<Store>();

// Function to run code with a context
function runWithContext<T>(callback: () => T, initialStore: Partial<Store> = {}): T {
  const store = { autopilot: false, ...initialStore } as Store;
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

export { setAutopilot, getAutopilot, runWithContext };
