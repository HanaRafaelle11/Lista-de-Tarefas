import React from 'react';
import { HeadphonesIcon, MessageSquare, AlertTriangle } from 'lucide-react';
import { billingCopy } from './billingCopywriting';

export default function BillingSupportCard({ onOpenSupport, onReportIssue }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <HeadphonesIcon className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
            {billingCopy.support.title}
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {billingCopy.support.description}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 self-end md:self-auto">
        <button
          onClick={onReportIssue}
          className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {billingCopy.support.reportIssue}
        </button>
        <button
          onClick={onOpenSupport}
          className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {billingCopy.support.talkToSupport}
        </button>
      </div>
    </div>
  );
}
