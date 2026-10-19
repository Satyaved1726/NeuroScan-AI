import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import MaterialIcon from '../components/MaterialIcon';

const Mail = ({ className }: { className?: string }) => <MaterialIcon name="mail" className={className} />;
const Lock = ({ className }: { className?: string }) => <MaterialIcon name="lock" className={className} />;
const User2 = ({ className }: { className?: string }) => <MaterialIcon name="person" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const ShieldCheck = ({ className }: { className?: string }) => <MaterialIcon name="admin_panel_settings" className={className} />;
const CheckCircle = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;

import { useAuth } from '../hooks/useAuth';
import { useToastContext } from '../hooks/useToastContext';

interface FormData {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface ValidationErrors {
  full_name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const toast = useToastContext();

  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length < 2) {
      errors.full_name = 'Full name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter and one number';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      const result = await register(
        formData.email.trim(),
        formData.password,
        formData.full_name.trim()
      );

      if (result.needsEmailVerification) {
        setSuccessMessage(
          'Registration initiated! Please check your email inbox to verify your account before logging in.'
        );
        toast.info('Verification email sent. Please check your inbox.');
      } else {
        toast.success('Account created successfully! Welcome to NeuroScan AI.');
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      let message = 'Unable to complete registration. Please try again.';
      if (err?.message) {
        if (err.message.includes('User already registered')) {
          message = 'An account with this email address already exists. Please log in or use password recovery.';
        } else if (err.message.includes('Password should be')) {
          message = err.message;
        } else {
          message = err.message;
        }
      }
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
      className="min-h-[85vh] flex items-center justify-center p-4 lg:p-8 bg-clinical-bgApp dark:bg-[#0F172A] -mt-16 font-sans antialiased"
    >
      <div className="w-full max-w-4xl grid gap-0 lg:grid-cols-2 rounded-clinical overflow-hidden border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-soft">
        {/* Left Panel */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-blue-50 dark:bg-slate-800/40 text-clinical-ink dark:text-white relative border-r border-clinical-border dark:border-slate-700">
          <div className="flex items-center gap-2 relative z-10">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-clinical-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-semibold text-base tracking-tight">
              NEUROSCAN <span className="text-clinical-primary font-bold">AI</span>
            </span>
          </div>

          <div className="space-y-6 relative z-10 my-auto py-10">
            <h3 className="text-2xl font-semibold leading-tight text-clinical-textPrimary dark:text-white">
              Patient Registration
            </h3>
            <p className="text-sm leading-relaxed text-clinical-textSecondary">
              Create your secure patient account to access personal neurological scan evaluations, track longitudinal brain health, and access verified clinical reports.
            </p>
            <div className="space-y-3 font-sans">
              {[
                { label: 'Secure Identity Protection', desc: 'Enterprise-grade Supabase authentication' },
                { label: 'Personal Clinical Isolation', desc: 'Private data sandboxing and encrypted storage' },
                { label: 'Verified Reports Access', desc: 'Secure retrieval of AI decision-support documentation' }
              ].map((item) => (
                <div key={item.label} className="flex gap-2 text-xs">
                  <span className="text-clinical-primary font-bold">✓</span>
                  <div>
                    <p className="font-semibold text-clinical-textPrimary dark:text-slate-200">{item.label}</p>
                    <p className="text-clinical-textSecondary text-[11px] font-semibold">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-clinical-textSecondary font-semibold tracking-wider uppercase relative z-10">
            Strict Doctor and Admin roles require institutional authorization.
          </p>
        </div>

        {/* Right Form Card */}
        <div className="p-8 lg:p-12 flex flex-col justify-center bg-white dark:bg-[#1E293B] text-clinical-textPrimary dark:text-slate-100">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-clinical-ink dark:text-white">Create Account</h2>
            <p className="text-xs text-clinical-textSecondary font-semibold mt-1">Register your patient account</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-clinical border border-clinical-status-critical/20 bg-clinical-status-critical/5 p-4">
              <AlertCircle className="h-4.5 w-4.5 text-clinical-status-critical flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-clinical-status-critical">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-start gap-3 rounded-clinical border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">Full Name</span>
              <div className={`flex items-center gap-3 rounded-clinical border bg-white dark:bg-[#1E293B] px-3.5 py-2 transition-colors ${
                validationErrors.full_name ? 'border-clinical-status-critical' : 'border-clinical-border dark:border-slate-700 focus-within:border-clinical-primary'
              }`}>
                <User2 className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="John Doe"
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
              {validationErrors.full_name && <p className="mt-1 text-xs text-clinical-status-critical font-semibold">{validationErrors.full_name}</p>}
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">Email Address</span>
              <div className={`flex items-center gap-3 rounded-clinical border bg-white dark:bg-[#1E293B] px-3.5 py-2 transition-colors ${
                validationErrors.email ? 'border-clinical-status-critical' : 'border-clinical-border dark:border-slate-700 focus-within:border-clinical-primary'
              }`}>
                <Mail className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="name@hospital.com"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              {validationErrors.email && <p className="mt-1 text-xs text-clinical-status-critical font-semibold">{validationErrors.email}</p>}
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">Password</span>
              <div className={`flex items-center gap-3 rounded-clinical border bg-white dark:bg-[#1E293B] px-3.5 py-2 transition-colors ${
                validationErrors.password ? 'border-clinical-status-critical' : 'border-clinical-border dark:border-slate-700 focus-within:border-clinical-primary'
              }`}>
                <Lock className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="Min. 8 characters (uppercase & number)"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              {validationErrors.password && <p className="mt-1 text-xs text-clinical-status-critical font-semibold">{validationErrors.password}</p>}
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">Confirm Password</span>
              <div className={`flex items-center gap-3 rounded-clinical border bg-white dark:bg-[#1E293B] px-3.5 py-2 transition-colors ${
                validationErrors.confirmPassword ? 'border-clinical-status-critical' : 'border-clinical-border dark:border-slate-700 focus-within:border-clinical-primary'
              }`}>
                <Lock className="h-4.5 w-4.5 text-clinical-textSecondary" />
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full bg-transparent outline-none text-xs font-semibold text-clinical-textPrimary dark:text-white placeholder-slate-400"
                  placeholder="Verify password"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              {validationErrors.confirmPassword && <p className="mt-1 text-xs text-clinical-status-critical font-semibold">{validationErrors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-clinical bg-clinical-primary px-4 py-3 font-semibold text-white shadow-soft hover:bg-clinical-primaryDark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all btn-transition"
            >
              {isLoading ? 'Creating account...' : 'Register Patient Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs font-semibold text-clinical-textSecondary">
            Already registered? <Link to="/login" className="text-clinical-primary hover:text-clinical-primaryDark transition-colors">Sign in here</Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
