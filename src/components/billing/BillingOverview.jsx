import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, CreditCard, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import BillingStatusBadge from './BillingStatusBadge';
import BillingHistory from './BillingHistory';
import BillingDetails from './BillingDetails';
import BillingSupportCard from './BillingSupportCard';
import { billingCopy } from './billingCopywriting';
import { useAppContext } from '../../contexts/AppContext';

export default function BillingOverview({ userId, onManageSubscription, onUpgradePlan }) {
  const { openCustomAlert } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const fetchUserBilling = async () => {
    setLoading(true);
    try {
      const target = userId || '';
      const res = await fetch(`/api/admin/billing/timeline?search=${encodeURIComponent(target)}`);
      if (res.ok) {
        const data = await res.json();
        setBillingData(data);
      }
    } catch (e) {
      console.warn('[BillingOverview] erro ao carregar faturamento:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserBilling();
  }, [userId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  const sub = billingData?.subscription;
  const planName = sub?.plan === 'premium' ? 'Flowday Premium' : 'Plano Gratuito';
  const status = sub?.status || 'free';
  const price = sub?.price || sub?.amount || 14.90;

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(price);

  const formattedNextDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Em breve';

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
          {billingCopy.overview.title}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {billingCopy.overview.subtitle}
        </p>
      </div>

      {/* Main Card Overview */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-500/10 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-medium text-indigo-100 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{planName}</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight">{billingCopy.overview.currentPlan}</h2>
            <div className="pt-1">
              <BillingStatusBadge status={status} />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 min-w-[240px] space-y-3">
            <div className="flex items-center justify-between text-xs text-indigo-200">
              <span>{billingCopy.overview.recurringAmount}</span>
              <span className="font-bold text-white text-base">{formattedPrice} / mês</span>
            </div>
            <div className="flex items-center justify-between text-xs text-indigo-200 pt-2 border-t border-white/10">
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {billingCopy.overview.nextBillingDate}</span>
              <span className="font-semibold text-white">{formattedNextDate}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-2 text-xs text-indigo-100">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Cobranças protegidas e criptografadas</span>
          </div>

          {status === 'active' || status === 'premium' ? (
            <button
              onClick={onManageSubscription}
              className="px-5 py-2.5 bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              {billingCopy.overview.manageButton}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onUpgradePlan}
              className="px-5 py-2.5 bg-amber-400 text-slate-950 hover:bg-amber-300 font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              {billingCopy.overview.upgradeButton}
              <Sparkles className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* History */}
      <BillingHistory
        history={billingData?.history || []}
        onSelectTransaction={(item) => setSelectedTransaction(item)}
      />

      {/* Support */}
      <BillingSupportCard
        onOpenSupport={() => openCustomAlert('Abrindo canal de atendimento ao cliente...')}
        onReportIssue={() => openCustomAlert('Iniciando relatório de contestação de cobrança...')}
      />

      {/* Details Modal */}
      {selectedTransaction && (
        <BillingDetails
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}
