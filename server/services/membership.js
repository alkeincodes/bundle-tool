// Phase 2: membership.io integration
// This will be implemented when the dev team deploys the internal API endpoint

module.exports = {
  // Placeholder for Phase 2
  provisionUser: async (email, customerId) => {
    // TODO: Implement when membership.io endpoint is available
    // For now, return a reminder for manual provisioning
    return {
      success: false,
      manualStep: 'Please manually provision user in membership.io'
    };
  }
};
