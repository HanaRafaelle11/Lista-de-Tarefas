import React from 'react';
import { HelpCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { billingCopy } from './billingCopywriting';

export default function BillingExplanationPanel({ reasonType, nextBillingDays }) {
  const explanationText = billingCopy.explanation.reasons[reasonType] || billingCopy.explanation.reasons.default;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span>{billingCopy.explanation.title}</span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {explanationText}
      </p>
      {nextBillingDays !== undefined && (
        <div className="flex items-center gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>{billingCopy.explanation.renewsIn(nextBillingDays)}</span>
        </div>
      )}
    </div>
  );
}
