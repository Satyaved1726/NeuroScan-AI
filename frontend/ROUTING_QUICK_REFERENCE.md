# Quick Reference: NeuroScan AI Routing System

## Import Statements

```typescript
// Authentication
import { useAuth } from '../hooks/useAuth';
import { AuthProvider } from '../contexts/AuthContext';

// Routing
import { useNavigate, useParams, NavLink, Link } from 'react-router-dom';

// Components
import ProtectedRoute from '../components/ProtectedRoute';
import ErrorBoundary from '../components/ErrorBoundary';
import LoadingScreen from '../components/LoadingScreen';
```

## Common Tasks

### Check if User is Authenticated
```typescript
const { isAuthenticated, user, isLoading } = useAuth();

if (isLoading) return <LoadingScreen />;
if (!isAuthenticated) return <Navigate to="/login" />;
```

### Login User
```typescript
const { login } = useAuth();
const navigate = useNavigate();

const handleLogin = async (email: string, password: string) => {
  try {
    await login(email, password);
    navigate('/dashboard');
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

### Logout User
```typescript
const { logout } = useAuth();
const navigate = useNavigate();

const handleLogout = () => {
  logout();
  navigate('/');
};
```

### Navigate Programmatically
```typescript
const navigate = useNavigate();

// Navigate to dashboard
navigate('/dashboard');

// Navigate with state
navigate('/results/123', { state: { scanData: {...} } });

// Go back
navigate(-1);
```

### Get Route Parameters
```typescript
const { scanId } = useParams<{ scanId: string }>();
```

### Create Protected Route
```typescript
<Route
  path="/admin"
  element={<ProtectedRoute element={<AdminPage />} requiresAdmin={true} />}
/>
```

### Create Active Navigation Link
```typescript
<NavLink
  to="/dashboard"
  className={({ isActive }) =>
    isActive ? 'bg-blue-500 text-white' : 'text-gray-600'
  }
>
  Dashboard
</NavLink>
```

### Check User Role
```typescript
const { user } = useAuth();

if (user?.role === 'admin') {
  // Show admin features
}
```

## File Structure

```
src/
├── App.tsx                          # Main routing config
├── main.tsx                         # App entry point
├── components/
│   ├── Shell.tsx                   # Main layout
│   ├── ProtectedRoute.tsx          # Route guard
│   ├── ErrorBoundary.tsx           # Error handling
│   └── LoadingScreen.tsx           # Loading UI
├── contexts/
│   └── AuthContext.tsx             # Auth state
├── hooks/
│   └── useAuth.ts                  # Auth hook
├── config/
│   └── routes.ts                   # Route config
└── pages/
    ├── LandingPage.tsx
    ├── LoginPage.tsx
    ├── RegisterPage.tsx
    ├── DashboardPage.tsx
    ├── UploadPage.tsx
    ├── ResultsPage.tsx
    ├── AssistantPage.tsx
    ├── ReportsPage.tsx
    ├── HistoryPage.tsx
    ├── ProfilePage.tsx
    ├── SettingsPage.tsx
    ├── AdminPage.tsx
    └── NotFoundPage.tsx
```

## Routes at a Glance

| Route | Type | Auth Required | Admin Only | Display in Nav |
|-------|------|---------------|------------|----------------|
| / | Public | No | No | ✓ |
| /login | Auth | No | No | ✗ |
| /register | Auth | No | No | ✗ |
| /dashboard | Protected | Yes | No | ✓ |
| /analysis | Protected | Yes | No | ✓ |
| /results/:scanId | Protected | Yes | No | ✗ |
| /assistant | Protected | Yes | No | ✓ |
| /reports | Protected | Yes | No | ✓ |
| /history | Protected | Yes | No | ✓ |
| /profile | Protected | Yes | No | ✓ |
| /settings | Protected | Yes | No | ✓ |
| /admin | Protected | Yes | Yes | ✓ |
| * | Error | - | - | ✗ |

## Debugging Tips

### Check Auth State
```typescript
const auth = useAuth();
console.log('Auth State:', {
  isAuthenticated: auth.isAuthenticated,
  isLoading: auth.isLoading,
  user: auth.user,
  token: localStorage.getItem('token'),
});
```

### Trace Route Changes
```typescript
// In App.tsx
import { useLocation } from 'react-router-dom';

const location = useLocation();
console.log('Route changed to:', location.pathname);
```

### Check Navigation Queue
```typescript
const navigate = useNavigate();

// Add logging
const handleNavigation = (path: string) => {
  console.log(`Navigating to: ${path}`);
  navigate(path);
};
```

## Performance Tips

1. **Lazy Load Pages**
   ```typescript
   const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
   ```

2. **Memoize Components**
   ```typescript
   export default React.memo(ProtectedRoute);
   ```

3. **Optimize useAuth Calls**
   ```typescript
   // Use sparingly - single call per component
   const { isAuthenticated } = useAuth();
   ```

## Security Reminders

- ✓ Always protect admin routes with `requiresAdmin={true}`
- ✓ Always check `isLoading` before rendering
- ✓ Always validate tokens on app load
- ✓ Always use HTTPS in production
- ✓ Always implement CSRF protection
- ✓ Always validate on backend too (don't trust frontend)
- ✗ Don't store sensitive data in localStorage
- ✗ Don't skip ProtectedRoute wrapper
- ✗ Don't make API calls without auth token
- ✗ Don't trust client-side role checks alone

## Common Patterns

### Auth-Aware Component
```typescript
function MyComponent() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return isAuthenticated ? (
    <div>Welcome, {user?.name}</div>
  ) : (
    <div>Please log in</div>
  );
}
```

### Protected Page
```typescript
function AdminPage() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return <div>Admin Content</div>;
}
```

### Navigation with Feedback
```typescript
function MyComponent() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async () => {
    setIsLoading(true);
    try {
      // Do something
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleAction} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Submit'}
    </button>
  );
}
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| useAuth error | Wrap component in AuthProvider |
| Blank page on load | Check LoadingScreen component |
| Always redirects to login | Check token validation in AuthContext |
| 404 page not showing | Verify NotFoundPage is exported |
| Route not working | Check route path spelling |
| Protected route accessible | Verify ProtectedRoute wrapper |
| No active state on nav | Use NavLink instead of Link |
| Page reloads on navigate | Use navigate() not window.location |
