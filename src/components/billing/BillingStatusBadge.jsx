import React from 'react';
import { CheckCircle2, Clock, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { billingCopy } from './billingCopywriting';

export default function BillingStatusBadge({ status }) {
  const normalized = String(status || 'active').toLowerCase().trim();

  const config = {
    active: {
      label: billingCopy.status.active,
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/30',
      icon: CheckCircle2
    },
    paid: {
      label: billingCopy.status.paid,
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/30',
      icon: CheckCircle2
    },
    pending: {
      label: billingCopy.status.pending,
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/30',
      icon: Clock
    },
    processing: {
      label: billingCopy.status.processing,
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500/30',
      icon: Loader2,
      animate: true
    },
    failed: {
      label: billingCopy.status.failed,
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/30',
      icon: AlertCircle
    },
    canceled: {
      label: billingCopy.status.canceled,
      bg: 'bg-slate-500/10 dark:bg-slate-500/20',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-500/30',
      icon: XCircle
    }
  };

  const activeConfig = config[normalized] || config.active;
  const Icon = activeConfig.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${activeConfig.bg} ${activeConfig.text} ${activeConfig.border} transition-all shadow-sm`}>
      <Icon className={`w-3.5 h-3.5 ${activeConfig.animate ? 'animate-spin' : ''}`} />
      {activeConfig.label}
    </span>
  );
}
