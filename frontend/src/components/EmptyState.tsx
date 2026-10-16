import MaterialIcon from './MaterialIcon';

// 1. No MRI uploaded SVG
const NoMriIllustration = () => (
  <svg width="100" height="100" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-80 dark:opacity-90">
    <circle cx="60" cy="55" r="40" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 4" className="text-clinical-primary" />
    <circle cx="60" cy="55" r="32" stroke="currentColor" strokeWidth="1.5" className="text-slate-300 dark:text-slate-700" />
    <path d="M20 95H100L92 82H28L20 95Z" stroke="currentColor" strokeWidth="1.5" className="text-slate-300 dark:text-slate-700" fill="currentColor" fillOpacity="0.05" />
    <rect x="36" y="82" width="48" height="4" rx="2" fill="currentColor" className="text-clinical-primary" />
    <path d="M50 45C50 39.4772 54.4772 35 60 35C65.5228 35 70 39.4772 70 45C70 47.5 69.5 50.5 67.5 52.5C66 54 65.5 55.5 65.5 58H54.5C54.5 55.5 54 54 52.5 52.5C50.5 50.5 50 47.5 50 45Z" stroke="currentColor" strokeWidth="1.5" className="text-clinical-primary" />
    <line x1="60" y1="35" x2="60" y2="58" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" className="text-clinical-primary/40" />
    <line x1="50" y1="45" x2="70" y2="45" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" className="text-clinical-primary/40" />
  </svg>
);

// 2. No Reports SVG
const NoReportsIllustration = () => (
  <svg width="100" height="100" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-80 dark:opacity-90">
    <rect x="35" y="25" width="50" height="70" rx="8" stroke="currentColor" strokeWidth="2.5" className="text-slate-300 dark:text-slate-700" />
    <path d="M50 25H70V18C70 16.3431 68.6569 15 67 15H53C51.3431 15 50 16.3431 50 18V25Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" className="text-clinical-primary" />
    <line x1="45" y1="42" x2="75" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-200 dark:text-slate-800" />
    <line x1="45" y1="54" x2="75" y2="54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-200 dark:text-slate-800" />
    <line x1="45" y1="66" x2="65" y2="66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-200 dark:text-slate-800" />
    <circle cx="72" cy="72" r="10" stroke="currentColor" strokeWidth="1.5" fill="currentColor" className="text-clinical-primary/10" />
    <path d="M68 72L71 75L76 69" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-clinical-primary" />
  </svg>
);

// 3. No History SVG
const NoHistoryIllustration = () => (
  <svg width="100" height="100" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-80 dark:opacity-90">
    <rect x="30" y="20" width="60" height="75" rx="6" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-700" />
    <rect x="36" y="28" width="48" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-slate-350 dark:text-slate-650" />
    <rect x="36" y="50" width="48" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-slate-350 dark:text-slate-650" />
    <rect x="36" y="72" width="48" height="16" rx="3" stroke="currentColor" strokeWidth="2" className="text-clinical-primary" />
    <line x1="54" y1="36" x2="66" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-300 dark:text-slate-700" />
    <line x1="54" y1="58" x2="66" y2="58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-300 dark:text-slate-700" />
    <line x1="54" y1="80" x2="66" y2="80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-clinical-primary" />
    <circle cx="82" cy="82" r="10" fill="currentColor" className="text-clinical-primary" />
    <path d="M80 80L84 84" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 4. No Conversations SVG
const NoConversationsIllustration = () => (
  <svg width="100" height="100" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-80 dark:opacity-90">
    <path d="M25 65C25 45.1177 38.4315 30 55 30C71.5685 30 85 45.1177 85 65C85 71.3 83.1 77.2 80 82L83 95L70 91C65.5 93 60.5 94 55 94C38.4315 94 25 78.8823 25 65Z" stroke="currentColor" strokeWidth="2.5" className="text-slate-300 dark:text-slate-700" />
    <path d="M95 50C95 38.9543 86.0457 30 75 30M95 50C95 54.5 93.5 58.5 91 62L93 72L84 69C81 70.5 78 71 75 71" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" className="text-clinical-primary" />
    <path d="M38 65H46L49 55L53 73L56 61L58 65H68" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-clinical-primary" />
  </svg>
);

// 5. No Patients SVG
const NoPatientsIllustration = () => (
  <svg width="100" height="100" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 opacity-80 dark:opacity-90">
    <path d="M30 45V28C30 25.7909 31.7909 24 34 24H52L58 32H86C88.2091 32 90 33.7909 90 36V45" stroke="currentColor" strokeWidth="2.5" className="text-slate-300 dark:text-slate-700" />
    <rect x="25" y="42" width="70" height="48" rx="6" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.05" className="text-slate-300 dark:text-slate-700" />
    <circle cx="60" cy="56" r="8" stroke="currentColor" strokeWidth="1.5" className="text-clinical-primary" />
    <path d="M48 74C48 68.4772 52.4772 64 58 64H62C67.5228 64 72 68.4772 72 74V78H48V74Z" stroke="currentColor" strokeWidth="1.5" className="text-clinical-primary" />
  </svg>
);

interface EmptyStateProps {
  icon?: any;
  iconName?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  iconName = 'info',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {

  const renderIllustration = () => {
    switch (iconName) {
      case 'no_mri':
        return <NoMriIllustration />;
      case 'no_reports':
        return <NoReportsIllustration />;
      case 'no_history':
        return <NoHistoryIllustration />;
      case 'no_conversations':
        return <NoConversationsIllustration />;
      case 'no_patients':
        return <NoPatientsIllustration />;
      default:
        return (
          <div className="p-3 bg-[#EEF5FF] dark:bg-slate-800 text-clinical-primary rounded-full mb-3.5 border border-clinical-border dark:border-slate-700 flex items-center justify-center">
            <MaterialIcon name={iconName} className="text-[20px]" />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-clinical-border dark:border-slate-700/60 rounded-clinical bg-slate-50/50 dark:bg-[#1E293B]/20 py-12">
      {renderIllustration()}
      <h3 className="text-xs font-bold text-clinical-ink dark:text-white leading-tight">{title}</h3>
      <p className="text-[11px] text-clinical-textSecondary mt-1.5 max-w-xs font-semibold leading-normal">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-clinical-primary hover:bg-clinical-primaryDark text-white text-xs font-bold rounded-clinical transition shadow-soft btn-ripple"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
