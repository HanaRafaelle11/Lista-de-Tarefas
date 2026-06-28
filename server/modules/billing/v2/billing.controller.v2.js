/**
 * Billing Controller V2 — Handlers das APIs de Telemetria e V2
 * 
 * Expõe endpoints V2 para Health, Anomalias, Replay e Forecast em coexistência com V1.
 */
import { BillingHealthV2 } from './billing.health.v2.js';
import { BillingAnomalyV2 } from './billing.anomaly.v2.js';
import { BillingForecastV2 } from './billing.forecast.v2.js';
import { BillingReplayV2 } from './billing.replay.v2.js';

export const billingControllerV2 = {
  async getHealthV2(req, res) {
    const data = await BillingHealthV2.getMetrics();
    return res.status(200).json(data);
  },

  async getAnomaliesV2(req, res) {
    const data = await BillingAnomalyV2.detectAnomalies();
    return res.status(200).json(data);
  },

  async getForecastV2(req, res) {
    const data = await BillingForecastV2.generateForecast();
    return res.status(200).json(data);
  },

  async postReplayV2(req, res) {
    const { fromDate, toDate, eventTypes, dryRun } = req.body || req.query || {};
    const data = await BillingReplayV2.replay({
      fromDate,
      toDate,
      eventTypes: Array.isArray(eventTypes) ? eventTypes : (eventTypes ? [eventTypes] : []),
      dryRun: dryRun !== false && dryRun !== 'false'
    });
    return res.status(200).json(data);
  }
};
