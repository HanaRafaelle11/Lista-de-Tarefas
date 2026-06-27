import handleUnifiedAsaasWebhook from '../billing/asaas-webhook.js';

export default async function handler(req, res) {
  return handleUnifiedAsaasWebhook(req, res);
}

export async function handleAsaasWebhook(req, res) {
  return handleUnifiedAsaasWebhook(req, res);
}
