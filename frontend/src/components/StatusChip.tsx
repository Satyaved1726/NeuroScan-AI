import { useLanguage } from '../hooks/useLanguage';

export type StatusType = 'completed' | 'processing' | 'uploaded' | 'failed' | 'pending' | 'generated';

interface StatusChipProps {
  status: StatusType | string;
}

export default function StatusChip({ status }: StatusChipProps) {
  const { t } = useLanguage();
  const norm = (status ?? '').toLowerCase();

  let colorClass = '';
  let label = '';
  let dotColor = '';

  if (norm === 'completed' || norm === 'generated') {
    colorClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    label = t('status_completed', 'Completed');
    dotColor = 'bg-emerald-500';
  } else if (norm === 'processing' || norm === 'pending') {
    colorClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
    label = t('status_processing', 'Processing');
    dotColor = 'bg-amber-500 animate-pulse';
  } else if (norm === 'uploaded') {
    colorClass = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    label = t('status_uploaded', 'Uploaded');
    dotColor = 'bg-blue-500';
  } else if (norm === 'failed') {
    colorClass = 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
    label = t('status_failed', 'Failed');
    dotColor = 'bg-red-500';
  } else {
    colorClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    label = status.charAt(0).toUpperCase() + status.slice(1);
    dotColor = 'bg-slate-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider select-none w-fit ${colorClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}
