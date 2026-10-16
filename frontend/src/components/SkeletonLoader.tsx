import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

function BaseSkeleton({ className = '', variant = 'rect' }: SkeletonProps) {
  const roundedClass =
    variant === 'circle' ? 'rounded-full' :
    variant === 'text' ? 'rounded h-3' : 'rounded-clinical';

  return (
    <div
      className={`bg-slate-200 dark:bg-slate-800 animate-pulse ${roundedClass} ${className}`}
      style={{ animationDuration: '1.5s' }}
    />
  );
}

export default function SkeletonLoader({ type }: { type: 'dashboard' | 'history' | 'reports' | 'assistant' | 'results' | 'profile' }) {
  switch (type) {
    case 'dashboard':
      return (
        <div className="space-y-6 font-sans">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-clinical-border dark:border-slate-800">
            <div className="space-y-2">
              <BaseSkeleton variant="rect" className="h-7 w-48" />
              <BaseSkeleton variant="text" className="w-96" />
            </div>
            <BaseSkeleton variant="rect" className="h-9 w-9" />
          </div>

          {/* KPI Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-3xl p-5 h-32 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="space-y-2 flex-1 mr-4">
                    <BaseSkeleton variant="text" className="w-16 h-2" />
                    <BaseSkeleton variant="rect" className="w-12 h-6" />
                  </div>
                  <BaseSkeleton variant="rect" className="h-9 w-9 rounded-2xl" />
                </div>
                <BaseSkeleton variant="text" className="w-20 h-2" />
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-5 h-28 flex flex-col justify-between">
                <BaseSkeleton variant="circle" className="h-8 w-8" />
                <div className="space-y-1.5">
                  <BaseSkeleton variant="text" className="w-20" />
                  <BaseSkeleton variant="text" className="w-28 h-2" />
                </div>
              </div>
            ))}
          </div>

          {/* Lower layout grids */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-5 h-96">
              <BaseSkeleton variant="rect" className="h-full w-full" />
            </div>
            <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-5 h-96">
              <BaseSkeleton variant="rect" className="h-full w-full" />
            </div>
          </div>
        </div>
      );

    case 'history':
    case 'reports':
      return (
        <div className="space-y-6 font-sans">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-clinical-border dark:border-slate-800">
            <div className="space-y-2">
              <BaseSkeleton variant="rect" className="h-7 w-48" />
              <BaseSkeleton variant="text" className="w-80" />
            </div>
          </div>

          {/* Table Toolbar controls */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3.5 bg-white dark:bg-[#1E293B] p-4 rounded-clinical border border-clinical-border dark:border-slate-800">
            <BaseSkeleton variant="rect" className="h-9 w-64" />
            <div className="flex gap-2">
              <BaseSkeleton variant="rect" className="h-9 w-28" />
              <BaseSkeleton variant="rect" className="h-9 w-28" />
            </div>
          </div>

          {/* Table Mock Rows */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical overflow-hidden">
            <div className="h-10 bg-slate-50 dark:bg-slate-800/50 border-b border-clinical-border dark:border-slate-800 px-4 flex items-center justify-between">
              {[...Array(5)].map((_, i) => (
                <BaseSkeleton key={i} variant="text" className="w-20" />
              ))}
            </div>
            <div className="p-4 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-4">
                  <BaseSkeleton variant="rect" className="h-8 w-24" />
                  <BaseSkeleton variant="text" className="w-28" />
                  <BaseSkeleton variant="text" className="w-20" />
                  <BaseSkeleton variant="rect" className="h-5 w-16 rounded-full" />
                  <BaseSkeleton variant="rect" className="h-8 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'assistant':
      return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8.5rem)] font-sans">
          {/* Patient specs column */}
          <div className="lg:col-span-1 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 flex flex-col gap-4">
            <BaseSkeleton variant="rect" className="h-6 w-32" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1">
                <BaseSkeleton variant="text" className="w-12 h-2" />
                <BaseSkeleton variant="rect" className="w-full h-8" />
              </div>
            ))}
          </div>
          {/* Chat bubbles column */}
          <div className="lg:col-span-3 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 flex flex-col justify-between">
            <div className="space-y-4 flex-1 overflow-hidden pr-2">
              <div className="flex gap-3">
                <BaseSkeleton variant="circle" className="h-8 w-8" />
                <BaseSkeleton variant="rect" className="h-16 w-1/2" />
              </div>
              <div className="flex gap-3 justify-end">
                <BaseSkeleton variant="rect" className="h-12 w-1/3" />
                <BaseSkeleton variant="circle" className="h-8 w-8" />
              </div>
              <div className="flex gap-3">
                <BaseSkeleton variant="circle" className="h-8 w-8" />
                <BaseSkeleton variant="rect" className="h-24 w-2/3" />
              </div>
            </div>
            <div className="border-t border-clinical-border dark:border-slate-800 pt-4 flex gap-2">
              <BaseSkeleton variant="rect" className="h-10 flex-1" />
              <BaseSkeleton variant="rect" className="h-10 w-20" />
            </div>
          </div>
        </div>
      );

    case 'results':
      return (
        <div className="space-y-6 font-sans">
          <div className="flex justify-between items-center pb-4 border-b border-clinical-border dark:border-slate-800">
            <div className="space-y-2">
              <BaseSkeleton variant="rect" className="h-7 w-48" />
              <BaseSkeleton variant="text" className="w-80" />
            </div>
            <div className="flex gap-2">
              <BaseSkeleton variant="rect" className="h-9 w-24" />
              <BaseSkeleton variant="rect" className="h-9 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-5 h-[500px]">
              <BaseSkeleton variant="rect" className="h-full w-full" />
            </div>
            <div className="lg:col-span-4 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-5 h-[500px]">
              <BaseSkeleton variant="rect" className="h-full w-full" />
            </div>
          </div>
        </div>
      );

    case 'profile':
      return (
        <div className="space-y-6 font-sans">
          <div className="pb-4 border-b border-clinical-border dark:border-slate-800 space-y-2">
            <BaseSkeleton variant="rect" className="h-7 w-48" />
            <BaseSkeleton variant="text" className="w-80" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-5 flex flex-col items-center gap-4 h-64">
              <BaseSkeleton variant="circle" className="h-24 w-24" />
              <BaseSkeleton variant="rect" className="h-6 w-32" />
              <BaseSkeleton variant="text" className="w-20" />
            </div>
            <div className="md:col-span-2 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-5 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <BaseSkeleton variant="text" className="w-20" />
                    <BaseSkeleton variant="rect" className="h-9 w-full" />
                  </div>
                  <div className="space-y-1">
                    <BaseSkeleton variant="text" className="w-20" />
                    <BaseSkeleton variant="rect" className="h-9 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    default:
      return <BaseSkeleton className="h-32 w-full" />;
  }
}
