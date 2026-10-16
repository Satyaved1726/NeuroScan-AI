import { useLocation } from 'react-router-dom';
import MaterialIcon from './MaterialIcon';

const ChevronRight = ({ className }: { className?: string }) => <MaterialIcon name="chevron_right" className={className} />;
const Home = ({ className }: { className?: string }) => <MaterialIcon name="home" className={className} />;
import { useDarkMode } from '../hooks/useDarkMode';

const breadcrumbMap: { [key: string]: string } = {
  '/dashboard': 'Dashboard',
  '/analysis': 'MRI Analysis',
  '/results': 'Analysis Results',
  '/assistant': 'Clinical Assistant',
  '/reports': 'Reports',
  '/history': 'Scan History',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/admin': 'Administration',
};

export default function Breadcrumb() {
  const location = useLocation();
  const { isDark } = useDarkMode();

  const pathSegments = location.pathname
    .split('/')
    .filter((segment) => segment)
    .slice(0, 2); // Limit to 2 segments

  const breadcrumbs = [
    { label: 'Home', path: '/dashboard' },
    ...pathSegments.map((segment) => ({
      label: breadcrumbMap[`/${segment}`] || segment.charAt(0).toUpperCase() + segment.slice(1),
      path: `/${segment}`,
    })),
  ].filter(
    (breadcrumb, index, items) =>
      items.findIndex((item) => item.path === breadcrumb.path) === index
  );

  return (
    <div className={`flex items-center gap-2 text-sm ${
      isDark ? 'text-slate-400' : 'text-slate-600'
    }`}>
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={`${breadcrumb.path}-${index}`} className="flex items-center gap-2">
          {index === 0 ? (
            <Home className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          {index === breadcrumbs.length - 1 ? (
            <span className={`font-medium ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {breadcrumb.label}
            </span>
          ) : (
            <a
              href={breadcrumb.path}
              className={`transition-colors hover:${
                isDark ? 'text-slate-200' : 'text-slate-900'
              }`}
            >
              {breadcrumb.label}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
