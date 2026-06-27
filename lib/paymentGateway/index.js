import { AsaasGateway } from './asaas.js';

/**
 * Camada Exclusiva de Gateway de Pagamento.
 * Todo o sistema interage exclusivamente através desta interface,
 * isolando completamente os detalhes de fornecedor (Asaas).
 */
export const PaymentGateway = {
  ensureCustomer: async (userProfile, authEmail, rawCpf) => {
    return await AsaasGateway.ensureCustomer(userProfile, authEmail, rawCpf);
  },

  createPixCharge: async (options) => {
    return await AsaasGateway.createPixCharge(options);
  },

  createCreditCardCharge: async (options) => {
    return await AsaasGateway.createCreditCardCharge(options);
  },

  createSubscription: async (options) => {
    return await AsaasGateway.createSubscription(options);
  },

  cancelSubscription: async (subscriptionId) => {
    return await AsaasGateway.cancelSubscription(subscriptionId);
  },

  getPayment: async (paymentId) => {
    return await AsaasGateway.getPayment(paymentId);
  },

  getSubscription: async (subscriptionId) => {
    return await AsaasGateway.getSubscription(subscriptionId);
  }
};
