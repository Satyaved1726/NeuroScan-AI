import { useNavigate } from 'react-router-dom';
import MaterialIcon from '../components/MaterialIcon';

const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const Home = ({ className }: { className?: string }) => <MaterialIcon name="home" className={className} />;
const ArrowLeft = ({ className }: { className?: string }) => <MaterialIcon name="arrow_back" className={className} />;
import { motion } from 'framer-motion';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100"
    >
      <div className="text-center max-w-md space-y-6">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-500/10 border border-red-500/20 p-5">
            <AlertCircle className="h-12 w-12 text-red-500 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-6xl font-extrabold text-white tracking-tighter">404</h1>
          <p className="text-xl font-extrabold text-slate-200">Session Voxel Index Misaligned</p>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            The resource plane you requested is outside active coordination boundaries. Let's redirect your telemetry node.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back Plane
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-3 rounded-xl bg-clinical-primary text-xs font-bold text-white shadow-lg shadow-clinical-primary/20 hover:bg-clinical-primary/90 transition flex items-center justify-center gap-1.5"
          >
            <Home className="h-4 w-4" /> Back to Overview
          </button>
        </div>

        <div className="mt-12 rounded-3xl bg-slate-900/40 border border-white/10 p-6 backdrop-blur shadow-xl">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Clinical Support Desk</p>
          <p className="text-slate-450 text-[11px] font-semibold mt-2">
            Reach system operations at{' '}
            <a href="mailto:support@neuroscan.ai" className="font-extrabold text-clinical-primary hover:text-clinical-primary-dark transition">
              support@neuroscan.ai
            </a>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
