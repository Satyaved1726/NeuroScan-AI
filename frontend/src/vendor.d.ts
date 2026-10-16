declare module 'framer-motion' {
  export const motion: Record<string, import('react').ComponentType<any>>;
  export const AnimatePresence: import('react').ComponentType<{ children?: import('react').ReactNode }>;
}

declare module 'recharts' {
  export const Bar: import('react').ComponentType<any>;
  export const BarChart: import('react').ComponentType<any>;
  export const CartesianGrid: import('react').ComponentType<any>;
  export const Cell: import('react').ComponentType<any>;
  export const Line: import('react').ComponentType<any>;
  export const LineChart: import('react').ComponentType<any>;
  export const Pie: import('react').ComponentType<any>;
  export const PieChart: import('react').ComponentType<any>;
  export const ResponsiveContainer: import('react').ComponentType<any>;
  export const Tooltip: import('react').ComponentType<any>;
  export const XAxis: import('react').ComponentType<any>;
  export const YAxis: import('react').ComponentType<any>;
}
