import { logger } from '../logger/index.js';

export const paymentGateway = {
  async createPixCharge({ customerId, value, description }) {
    logger.info('services.paymentGateway.createPixCharge', { customerId, value });
    return { success: true, pixQrCode: 'mock_qr_code', chargeId: `pay_${Date.now()}` };
  },
  async getSubscription(subscriptionId) {
    logger.info('services.paymentGateway.getSubscription', { subscriptionId });
    return { id: subscriptionId, status: 'ACTIVE' };
  }
};
