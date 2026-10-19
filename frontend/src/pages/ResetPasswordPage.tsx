import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import MaterialIcon from '../components/MaterialIcon';
import { supabase } from '../lib/supabase';
import { useToastContext } from '../hooks/useToastContext';

const Lock = ({ className }: { className?: string }) => <MaterialIcon name="lock" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const CheckCircle = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;
const ShieldCheck = ({ className }: { className?: string }) => <MaterialIcon name="admin_panel_settings" className={className} />;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToastContext();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function checkRecoverySession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasValidSession(true);
        } else {
          // If no active session, wait brief moment for Supabase to parse URL hash
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (event === 'PASSWORD_RECOVERY' || newSession) {
              setHasValidSession(true);
            }
          });
          setTimeout(() => {
            setHasValidSession((current) => (current !== null ? current : false));
          }, 1500);
          return () => subscription.unsubscribe();
        }
      } catch {
        setHasValidSession(false);
      }
    }

    checkRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError('Please provide a new password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one uppercase letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setIsSuccess(true);
      toast.success('Your password has been successfully updated.');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err: any) {
      const message = err?.message || 'Unable to update password. Your recovery link may have expired.';
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
      <div className="w-full max-w-md rounded-clinical overflow-hidden border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-soft p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-clinical-primary text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-semibold text-base tracking-tight text-clinical-ink dark:text-white">
            NEUROSCAN <span className="text-clinical-primary font-bold">AI</span>
          </span>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-clinical-ink dark:text-white">Set New Password</h2>
          <p className="text-xs text-clinical-textSecondary font-semibold mt-1">
            Create a secure password to restore access to your clinical account.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-clinical border border-clinical-status-critical/20 bg-clinical-status-critical/5 p-4">
            <AlertCircle className="h-4.5 w-4.5 text-clinical-status-critical flex-shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-clinical-status-critical">{error}</p>
          </div>
        )}

        {hasValidSession === false ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-clinical border border-clinical-status-critical/20 bg-clinical-status-critical/5 p-4">
              <AlertCircle className="h-5 w-5 text-clinical-status-critical flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-clinical-status-critical">Expired or Invalid Link</p>
                <p className="text-xs text-clinical-textSecondary mt-1">
                  This recovery session is invalid or has expired. Please request a new recovery link.
                </p>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link to="/forgot-password" className="text-xs font-semibold text-clinical-primary hover:text-clinical-primaryDark transition-colors">
                Request New Recovery Link
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-clinical border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Password Updated</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Your credentials have been securely refreshed. Redirecting to login...
                </p>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs font-semibold text-clinical-primary hover:text-clinical-primaryDark transition-colors">
                Proceed to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">
                New Password
              </span>
              <div className="flex items-center gap-3 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] px-3.5 py-2.5 transition-colors focus-within:border-clinical-primary">
                <Lock className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="Min. 8 characters (uppercase & number)"
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">
                Confirm New Password
              </span>
              <div className="flex items-center gap-3 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] px-3.5 py-2.5 transition-colors focus-within:border-clinical-primary">
                <Lock className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="Repeat new password"
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-clinical bg-clinical-primary px-4 py-3 font-semibold text-white shadow-soft hover:bg-clinical-primaryDark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all btn-transition"
            >
              {isLoading ? 'Updating password...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
