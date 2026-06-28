/**
 * Billing Contracts & DTO Shapes
 * 
 * Centraliza as definições de contrato para que o Frontend nunca dependa do schema do banco de dados.
 */

export const BillingEventDTO = {
  id: '',
  userId: '',
  type: 'payment', // "payment" | "refund" | "subscription" | "chargeback"
  status: 'pending', // "pending" | "paid" | "failed" | "active" | "canceled"
  amount: 0,
  currency: 'BRL',
  provider: 'asaas',
  createdAt: ''
};

export const BillingLedgerDTO = {
  id: '',
  userId: '',
  balanceChange: 0,
  reason: '',
  referenceId: '',
  createdAt: ''
};

export const BillingTimelineDTO = {
  userId: '',
  user: null,
  subscription: null,
  events: [],
  ledger: [],
  history: []
};

export const BillingSummaryDTO = {
  totalRevenue: 0,
  monthlyRevenue: 0,
  dailyRevenue: 0,
  activeSubscriptions: 0,
  canceledSubscriptions: 0,
  churnRate: 0
};
