import { ResponsiveContainer, LineChart, Line } from 'recharts';
import MaterialIcon from './MaterialIcon';

interface MedicalKpiCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: string;
  trendData?: number[];
  color?: string;
}

export default function MedicalKpiCard({
  title,
  value,
  subtext,
  icon,
  trendData,
  color = '#006A61',
}: MedicalKpiCardProps) {
  // Format trend data for Recharts
  const formattedData = trendData ? trendData.map((val, idx) => ({ id: idx, val })) : [];

  return (
    <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-3xl p-5 shadow-soft hover:shadow-md hover:border-clinical-primary/30 transition-all duration-300 group flex flex-col justify-between h-32 relative overflow-hidden select-none">

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="space-y-0.5 min-w-0">
          <span className="text-[10px] text-clinical-textSecondary font-bold uppercase tracking-wider block truncate">
            {title}
          </span>
          <span className="text-2xl font-bold text-clinical-ink dark:text-white mt-1 block tracking-tight">
            {value}
          </span>
        </div>
        <div className="h-9 w-9 rounded-2xl bg-clinical-primary/10 text-clinical-primary border border-clinical-primary/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <MaterialIcon name={icon} className="text-[20px]" />
        </div>
      </div>

      {/* Sparkline & Subtext row */}
      <div className="flex items-end justify-between gap-4 mt-2 relative z-10">
        {subtext && (
          <span className="text-[10px] font-semibold text-clinical-textSecondary block truncate">
            {subtext}
          </span>
        )}

        {/* Recharts Mini Line Chart */}
        {trendData && trendData.length > 0 && (
          <div className="h-8 w-24 shrink-0 overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedData}>
                <Line
                  type="monotone"
                  dataKey="val"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom accent glow strip */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 bg-transparent group-hover:bg-clinical-primary transition-colors"
        style={{ backgroundColor: `rgba(var(--clinical-primary), 0.1)` }}
      />
    </div>
  );
}
