import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import MaterialIcon from '../components/MaterialIcon';

const Eye = ({ className }: { className?: string }) => <MaterialIcon name="visibility" className={className} />;
const EyeOff = ({ className }: { className?: string }) => <MaterialIcon name="visibility_off" className={className} />;
const Lock = ({ className }: { className?: string }) => <MaterialIcon name="lock" className={className} />;
const Mail = ({ className }: { className?: string }) => <MaterialIcon name="mail" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const ShieldCheck = ({ className }: { className?: string }) => <MaterialIcon name="admin_panel_settings" className={className} />;
const CheckCircle = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;
import { useAuth } from '../hooks/useAuth';
import { useToastContext } from '../hooks/useToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeError, getUserFriendlyMessage } from '../utils/errorHandler';
import { login as loginUser } from '../services/authService';
import { fetchPatientProfile } from '../services/profileService';
import { fetchLatestAnalysis } from '../services/mriService';
import { fetchDashboardData } from '../services/dashboardService';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const toast = useToastContext();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    const sessionExpiredMessage = sessionStorage.getItem('neuroscan_session_expired_message');
    if (sessionExpiredMessage) {
      sessionStorage.removeItem('neuroscan_session_expired_message');
      setError(sessionExpiredMessage);
      toast.error(sessionExpiredMessage);
    }

    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await loginUser({ email, password });

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Prefetch data immediately based on role
      if (response.user.role === 'User') {
        queryClient.prefetchQuery({
          queryKey: ['patientProfile'],
          queryFn: fetchPatientProfile,
        });
        queryClient.prefetchQuery({
          queryKey: ['latestAnalysis'],
          queryFn: fetchLatestAnalysis,
        });
      } else {
        queryClient.prefetchQuery({
          queryKey: ['dashboardData'],
          queryFn: fetchDashboardData,
        });
      }

      setUser(response.user);
      toast.success('Login successful. Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      const errorInfo = normalizeError(err);
      const message = getUserFriendlyMessage(errorInfo);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[85vh] flex flex-col items-center justify-center p-4 lg:p-8 bg-clinical-bgApp dark:bg-[#0F172A] -mt-16 font-sans antialiased"
    >
      {/* Container holding left panel + right form card */}
      <div className="w-full max-w-4xl grid gap-0 lg:grid-cols-2 rounded-clinical overflow-hidden border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-soft">

        {/* Left Panel */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-[#0C152B] to-slate-950 text-white relative overflow-hidden border-r border-clinical-border dark:border-slate-800">
          {/* Subtle medical grid background overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent opacity-60 pointer-events-none" />

          <div className="flex items-center gap-2.5 relative z-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-clinical-primary text-white shadow-lg shadow-clinical-primary/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-base tracking-wider text-slate-100 uppercase">
              NEUROSCAN <span className="text-clinical-primary font-black">AI</span>
            </span>
          </div>

          <div className="space-y-6 relative z-10 my-auto py-8">
            <div>
              <h3 className="text-2xl font-bold leading-tight text-white">
                Clinical Decision Support Platform
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-300 font-medium">
              Empowering healthcare professionals with a secure and intuitive workspace for clinical imaging and patient management.
            </p>
            <div className="space-y-3.5 pt-2">
              {[
                'Secure Clinical Access',
                'Patient-Centered Workflow',
                'Trusted Healthcare Environment'
              ].map((label) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <CheckCircle className="text-teal-400 h-4.5 w-4.5 shrink-0" />
                  <span className="font-bold text-slate-150">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10 border-t border-white/5 pt-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
              Confidential • Secure • Authorized Access Only
            </p>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="p-8 lg:p-14 flex flex-col justify-center bg-white dark:bg-[#1E293B]">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-clinical-ink dark:text-white">Welcome Back</h2>
            <p className="text-xs text-clinical-textSecondary font-semibold mt-1">Sign in to access your clinical workspace.</p>
          </div>

          {error && (
            <div className="mb-4.5 flex items-start gap-3 rounded-clinical border border-clinical-status-critical/20 bg-clinical-status-critical/5 p-4">
              <AlertCircle className="h-4.5 w-4.5 text-clinical-status-critical flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-clinical-status-critical">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">Email Address</span>
              <div className={`flex items-center gap-3 rounded-clinical border bg-white dark:bg-[#1E293B] px-3.5 py-2.5 transition-colors ${
                validationErrors.email ? 'border-clinical-status-critical' : 'border-clinical-border dark:border-slate-700 focus-within:border-clinical-primary'
              }`}>
                <Mail className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="name@hospital.com"
                  disabled={isLoading}
                />
              </div>
              {validationErrors.email && <p className="mt-1 text-xs text-clinical-status-critical font-semibold">{validationErrors.email}</p>}
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">Password</span>
              <div className={`flex items-center gap-3 rounded-clinical border bg-white dark:bg-[#1E293B] px-3.5 py-2.5 transition-colors ${
                validationErrors.password ? 'border-clinical-status-critical' : 'border-clinical-border dark:border-slate-700 focus-within:border-clinical-primary'
              }`}>
                <Lock className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) setValidationErrors(prev => ({ ...prev, password: undefined }));
                  }}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="Enter secure password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-clinical-textSecondary hover:text-clinical-ink transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {validationErrors.password && <p className="mt-1 text-xs text-clinical-status-critical font-semibold">{validationErrors.password}</p>}
            </div>

            <div className="flex items-center justify-between text-xs font-semibold text-clinical-textSecondary">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded-clinical border-clinical-border bg-white text-clinical-primary cursor-pointer accent-clinical-primary dark:border-slate-700 dark:bg-slate-800"
                  disabled={isLoading}
                />
                Remember me
              </label>
              <a href="#" className="text-clinical-primary hover:text-clinical-primaryDark transition-colors">Forgot Password?</a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-clinical bg-clinical-primary px-4 py-3 font-semibold text-white shadow-soft hover:bg-clinical-primaryDark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all btn-transition"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs font-semibold text-clinical-textSecondary">
            Need credentials? <Link to="/register" className="text-clinical-primary hover:text-clinical-primaryDark transition-colors">Create account</Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
