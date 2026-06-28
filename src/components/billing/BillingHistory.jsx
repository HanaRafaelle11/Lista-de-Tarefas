import React from 'react';
import { Calendar, Receipt, ChevronRight } from 'lucide-react';
import BillingStatusBadge from './BillingStatusBadge';
import { billingCopy } from './billingCopywriting';

export default function BillingHistory({ history = [], onSelectTransaction }) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3">
        <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
        <h4 className="font-semibold text-slate-700 dark:text-slate-300">
          {billingCopy.history.empty}
        </h4>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
            {billingCopy.history.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {billingCopy.history.subtitle}
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {history.map((item, index) => {
          const formattedDate = new Date(item.createdAt || Date.now()).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });

          const formattedAmount = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(item.amount || item.value || 0);

          return (
            <div
              key={item.id || index}
              onClick={() => onSelectTransaction(item)}
              className="py-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/40 px-3 rounded-2xl transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                    Cobrança de Assinatura
                  </h5>
                  <span className="text-xs text-slate-400">{formattedDate}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block">
                    {formattedAmount}
                  </span>
                  <BillingStatusBadge status={item.status} />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
