import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import MaterialIcon from './MaterialIcon';

const ShieldCheck = ({ className }: { className?: string }) => <MaterialIcon name="admin_panel_settings" className={className} />;
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import ProfileAvatar from './ProfileAvatar';

export default function Shell() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { photoUrl } = useProfilePhoto();

  return (
    <div className="min-h-screen bg-clinical-bgApp dark:bg-[#0F172A] text-clinical-ink dark:text-[#F8FAFC] flex flex-col font-sans overflow-x-hidden antialiased">

      {/* Sticky Header Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1E293B] border-b border-clinical-border dark:border-slate-700 h-16 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-full flex items-center justify-between">

          {/* Logo Brand */}
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => navigate('/')}>
            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[10px] bg-clinical-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-clinical-ink dark:text-white">
              NEUROSCAN <span className="text-clinical-primary font-bold">AI</span>
            </span>
          </div>

          {/* Nav Items */}
          <div className="flex items-center gap-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-xs font-bold uppercase tracking-wider transition-colors ${
                  isActive ? 'text-clinical-primary dark:text-white' : 'text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white'
                }`
              }
            >
              Overview
            </NavLink>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="rounded-clinical bg-clinical-primary px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-clinical-primaryDark transition-all btn-transition"
                >
                  Dashboard
                </button>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800">
                  <ProfileAvatar src={photoUrl} name={user?.name} sizeClassName="h-6 w-6" />
                  <span className="text-xs font-semibold text-clinical-textPrimary dark:text-slate-200">{user?.name}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-clinical text-xs font-bold uppercase tracking-wider transition-all ${
                      isActive
                        ? 'text-clinical-primary bg-slate-50 border border-clinical-border dark:bg-slate-800 dark:border-slate-700'
                        : 'text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white'
                    }`
                  }
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className="rounded-clinical bg-clinical-primary hover:bg-clinical-primaryDark px-4 py-2 text-xs font-bold text-white shadow-soft tracking-wider uppercase transition-all btn-transition"
                >
                  Register
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow pt-16">
        <Outlet />
      </main>

    </div>
  );
}
