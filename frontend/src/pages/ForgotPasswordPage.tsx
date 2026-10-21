import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import MaterialIcon from '../components/MaterialIcon';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useToastContext } from '../hooks/useToastContext';

const Mail = ({ className }: { className?: string }) => <MaterialIcon name="mail" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const CheckCircle = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;
const ShieldCheck = ({ className }: { className?: string }) => <MaterialIcon name="admin_panel_settings" className={className} />;

export default function ForgotPasswordPage() {
  const toast = useToastContext();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (!isSupabaseConfigured) {
        throw new Error('Password recovery service is unavailable in this environment. Please contact support.');
      }

      const redirectOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${redirectOrigin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setIsSubmitted(true);
      toast.success('Password reset email sent if an account matches that address.');
    } catch (err: any) {
      const message = err?.message || 'Unable to process password reset request. Please try again.';
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
          <h2 className="text-2xl font-semibold text-clinical-ink dark:text-white">Reset Password</h2>
          <p className="text-xs text-clinical-textSecondary font-semibold mt-1">
            Enter your account email to receive secure recovery instructions.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-clinical border border-clinical-status-critical/20 bg-clinical-status-critical/5 p-4">
            <AlertCircle className="h-4.5 w-4.5 text-clinical-status-critical flex-shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-clinical-status-critical">{error}</p>
          </div>
        )}

        {isSubmitted ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-clinical border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Recovery Email Dispatched</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  If an account exists for <span className="font-semibold">{email}</span>, a secure password recovery link has been sent. Please check your inbox and spam folders.
                </p>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs font-semibold text-clinical-primary hover:text-clinical-primaryDark transition-colors">
                Return to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">
                Account Email
              </span>
              <div className="flex items-center gap-3 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] px-3.5 py-2.5 transition-colors focus-within:border-clinical-primary">
                <Mail className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="name@hospital.com"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-clinical bg-clinical-primary px-4 py-3 font-semibold text-white shadow-soft hover:bg-clinical-primaryDark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all btn-transition"
            >
              {isLoading ? 'Sending recovery link...' : 'Send Recovery Link'}
            </button>

            <p className="mt-4 text-center text-xs font-semibold text-clinical-textSecondary">
              Remember your password?{' '}
              <Link to="/login" className="text-clinical-primary hover:text-clinical-primaryDark transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </motion.div>
  );
}
