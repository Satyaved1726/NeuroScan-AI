import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clinical-primary font-mono">[{eyebrow.toUpperCase()}]</p>
      <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight text-clinical-ink dark:text-white">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-clinical-textSecondary">{description}</p> : null}
    </div>
  );
}

export function MetricCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-[#101827] border border-clinical-border dark:border-[#1E293B]/60 rounded-clinical p-5 shadow-soft"
    >
      <p className="text-xs font-semibold text-clinical-textSecondary font-sans uppercase tracking-wider">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="font-mono text-3xl font-medium tracking-tight text-clinical-ink dark:text-white tabular-nums leading-none">{value}</p>
        {delta ? (
          <span className="rounded-clinical border border-clinical-status-normal/20 bg-clinical-status-normal/5 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-clinical-status-normal">{delta}</span>
        ) : null}
      </div>
    </motion.div>
  );
}

export function ContentCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-[#101827] border border-clinical-border dark:border-[#1E293B]/60 rounded-clinical p-6 shadow-soft ${className}`}>{children}</div>;
}
