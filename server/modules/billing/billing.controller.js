/**
 * Billing Controller — Handlers da API Oficial de Billing
 * 
 * Intercepta as requisições administrativas e responde com payloads fortemente tipados e blindados.
 */
import { billingService } from './billing.service.js';

export const billingController = {
  async getTimeline(req, res) {
    try {
      const userIdOrSearch = req.query.userId || req.query.search || req.params?.userId || req.params?.id;
      const data = await billingService.getBillingTimeline(userIdOrSearch);
      return res.status(200).json(data);
    } catch (err) {
      console.error('[BillingController] getTimeline Exception:', err.message);
      return res.status(200).json({
        userId: null,
        user: null,
        subscription: null,
        events: [],
        ledger: [],
        history: [],
        status: 'free',
        amount: 0,
        error: err.message
      });
    }
  },

  async getHealth(req, res) {
    try {
      const healthData = await billingService.getReliabilityHealth();
      return res.status(200).json(healthData);
    } catch (err) {
      console.error('[BillingController] getHealth Exception:', err.message);
      return res.status(500).json({ status: 'ERROR', message: err.message });
    }
  }
};
