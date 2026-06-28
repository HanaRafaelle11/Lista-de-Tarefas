import React from 'react';
import { X, Calendar, CreditCard, DollarSign, ReceiptCheck, ArrowLeft } from 'lucide-react';
import BillingStatusBadge from './BillingStatusBadge';
import BillingExplanationPanel from './BillingExplanationPanel';
import { billingCopy } from './billingCopywriting';

export default function BillingDetails({ transaction, onClose }) {
  if (!transaction) return null;

  const formattedDate = new Date(transaction.createdAt || Date.now()).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(transaction.amount || transaction.value || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-6 p-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
              Comprovante de Cobrança
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center py-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Processado</span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{formattedAmount}</h2>
          <div className="pt-1 flex justify-center">
            <BillingStatusBadge status={transaction.status} />
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> Data e Horário
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formattedDate}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-500" /> Forma de Pagamento
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
              {transaction.provider || transaction.billingType || 'Cartão / Pix'}
            </span>
          </div>
        </div>

        <BillingExplanationPanel reasonType={transaction.type} />

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white font-semibold rounded-2xl transition-all shadow-md"
        >
          Fechar Comprovante
        </button>
      </div>
    </div>
  );
}
