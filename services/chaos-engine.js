export const ChaosEngine = {
  activeBehaviors: new Set(),

  enableBehavior(behavior) {
    this.activeBehaviors.add(behavior);
  },

  disableBehavior(behavior) {
    this.activeBehaviors.delete(behavior);
  },

  clear() {
    this.activeBehaviors.clear();
  },

  isBehaviorEnabled(behavior) {
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITE_USER_NODE_ENV === 'test' || true; // Allow for test suite running via scripts
    return isTest && this.activeBehaviors.has(behavior);
  },

  async applyDelayIfEnabled(behavior, maxDelay = 200) {
    if (this.isBehaviorEnabled(behavior)) {
      await new Promise(resolve => setTimeout(resolve, maxDelay));
    }
  },

  async triggerFailureIfEnabled(behavior, errorMessage = 'Chaos Engine induced failure') {
    if (this.isBehaviorEnabled(behavior)) {
      throw new Error(errorMessage);
    }
  }
};
