# NeuroScan AI - Production-Ready Routing Architecture

## Overview

This document describes the complete routing architecture for the NeuroScan AI frontend application. The system implements React Router DOM with centralized route configuration, authentication guards, error handling, and production-grade navigation patterns.

## Architecture Components

### 1. **AuthContext** (`src/contexts/AuthContext.tsx`)

Manages application-wide authentication state and user session.

**Features:**
- Persistent user authentication state
- JWT token management with localStorage
- Login, register, and logout functions
- Automatic auth validation on app load
- Loading state management

**Usage:**
```typescript
const { user, isAuthenticated, isLoading, login, register, logout } = useAuth();
```

### 2. **useAuth Hook** (`src/hooks/useAuth.ts`)

Custom React hook for accessing authentication context.

**Throws error if used outside AuthProvider** - ensures proper initialization.

### 3. **Route Configuration** (`src/config/routes.ts`)

Centralized route configuration with type-safe route definitions.

**Features:**
- Single source of truth for all routes
- Route metadata (type, auth requirements, nav visibility)
- Helper function to compute navigation items based on auth state
- Type-safe route definitions

**Route Types:**
- `public`: Accessible to all users
- `auth`: Login/register pages
- `protected`: Requires authentication
- `admin`: Requires admin role

### 4. **ProtectedRoute Component** (`src/components/ProtectedRoute.tsx`)

Route guard component for protecting authenticated and admin routes.

**Features:**
- Automatic redirect to /login for unauthenticated users
- Admin role enforcement
- Loading state handling
- Clean redirect without page refresh

**Usage:**
```typescript
<Route
  path="/admin"
  element={<ProtectedRoute element={<AdminPage />} requiresAdmin={true} />}
/>
```

### 5. **ErrorBoundary Component** (`src/components/ErrorBoundary.tsx`)

React error boundary for catching and handling component errors.

**Features:**
- Catches React component errors
- Displays user-friendly error UI
- Manual refresh option
- Links back to home page

### 6. **LoadingScreen Component** (`src/components/LoadingScreen.tsx`)

Loading state UI shown during authentication checks and navigation.

**Features:**
- Animated spinner
- Centered layout
- Loading message

### 7. **NotFoundPage** (`src/pages/NotFoundPage.tsx`)

404 error page for invalid routes.

**Features:**
- Clear error messaging
- Navigation options (back, home)
- Support contact information

### 8. **Shell Component** (`src/components/Shell.tsx`)

Main application layout with dynamic sidebar and header.

**Features:**
- Dynamic navigation based on auth state
- Role-aware menu items
- User info display for authenticated users
- Logout functionality
- Responsive design (hidden on mobile)

### 9. **App Component** (`src/App.tsx`)

Main application routing configuration.

**Route Structure:**
```
/
├── / (Landing - Public)
├── /login (Login - Auth)
├── /register (Register - Auth)
├── /dashboard (Protected)
├── /analysis (Protected)
├── /results/:scanId (Protected)
├── /assistant (Protected)
├── /reports (Protected)
├── /history (Protected)
├── /profile (Protected)
├── /settings (Protected)
├── /admin (Protected + Admin)
└── * (404 - NotFound)
```

## Route Definitions

### Public Routes
- **`/`** - Landing page (accessible to all)
- **`/login`** - Login page
- **`/register`** - Registration page

### Protected Routes (Requires Authentication)
- **`/dashboard`** - Main dashboard
- **`/analysis`** - MRI scan upload and analysis
- **`/results/:scanId`** - Analysis results for specific scan
- **`/assistant`** - Clinical assistant AI
- **`/reports`** - Scan reports
- **`/history`** - Scan history
- **`/profile`** - User profile
- **`/settings`** - User settings

### Admin Routes (Requires Admin Role)
- **`/admin`** - Admin panel

### Error Routes
- **`/*`** - 404 Not Found page

## Authentication Flow

### 1. **App Initialization**
```
1. App mounts with isLoading = true
2. AuthContext checks for saved token in localStorage
3. If token exists, validates with backend API
4. Sets user data or clears token if invalid
5. isLoading set to false
```

### 2. **Login Flow**
```
1. User navigates to /login
2. LoginPage calls auth.login(email, password)
3. Backend returns token and user data
4. Token saved to localStorage
5. User redirected to /dashboard
```

### 3. **Protected Route Access**
```
1. User navigates to /dashboard
2. ProtectedRoute checks isAuthenticated
3. If false, redirects to /login
4. If true and admin required but user isn't admin, redirects to /dashboard
5. Otherwise, renders the page
```

### 4. **Logout Flow**
```
1. User clicks logout button
2. Auth context clears token and user
3. localStorage token removed
4. User redirected to home page
5. All subsequent protected routes redirect to /login
```

## Navigation Examples

### Programmatic Navigation
```typescript
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  // Navigate to dashboard
  navigate('/dashboard');

  // Navigate with state
  navigate('/results/scan-123', { state: { scanData } });

  // Go back
  navigate(-1);
}
```

### Link Navigation
```typescript
import { Link, NavLink } from 'react-router-dom';

// Simple link
<Link to="/dashboard">Dashboard</Link>

// NavLink with active state styling
<NavLink
  to="/dashboard"
  className={({ isActive }) => isActive ? 'active' : ''}
>
  Dashboard
</NavLink>
```

### Accessing Route Parameters
```typescript
import { useParams } from 'react-router-dom';

function ResultsPage() {
  const { scanId } = useParams<{ scanId: string }>();
  return <div>Results for scan: {scanId}</div>;
}
```

## Sidebar Navigation

The sidebar automatically shows/hides menu items based on authentication and role:

### Unauthenticated Users See:
- Landing
- Login
- Register

### Authenticated Users See:
- Dashboard
- MRI Analysis
- Clinical Assistant
- Reports
- History
- Profile
- Settings

### Admin Users Additionally See:
- Admin

## Error Handling

### Component Errors
- Wrapped by ErrorBoundary
- Shows error UI
- Option to refresh or go home

### Route Errors
- Invalid routes show 404 page
- Users can navigate back or go home

### Authentication Errors
- Failed login shows error in UI
- Auto-logout on token validation failure
- Automatic redirect to login

## Loading States

### Initial App Load
- LoadingScreen shown while checking auth
- Prevents flashing of incorrect UI

### Route Navigation
- LoadingScreen shown during protected route access
- Smooth transition between pages

## Best Practices

### 1. Always Use useAuth Hook
```typescript
// ✅ Correct
const { isAuthenticated, user } = useAuth();

// ❌ Wrong - useContext directly
const context = useContext(AuthContext);
```

### 2. Protect Routes with ProtectedRoute
```typescript
// ✅ Correct
<Route
  path="/dashboard"
  element={<ProtectedRoute element={<DashboardPage />} />}
/>

// ❌ Wrong - No protection
<Route path="/dashboard" element={<DashboardPage />} />
```

### 3. Use NavLink for Navigation in UI
```typescript
// ✅ Correct - Will apply active class
<NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
  Dashboard
</NavLink>

// ❌ Wrong - No active state
<a href="/dashboard">Dashboard</a>
```

### 4. Handle Loading State
```typescript
// ✅ Correct
const { isLoading } = useAuth();
if (isLoading) return <LoadingScreen />;

// ❌ Wrong - Render without checking
return <Dashboard />;
```

### 5. Use useParams for Dynamic Routes
```typescript
// ✅ Correct
const { scanId } = useParams<{ scanId: string }>();

// ❌ Wrong - Manual URL parsing
const scanId = window.location.pathname.split('/')[2];
```

## Common Issues & Solutions

### Issue: "useAuth must be used within AuthProvider"
**Solution:** Ensure AuthProvider wraps your app in main.tsx

### Issue: Users redirected to login when should be on public page
**Solution:** Check ProtectedRoute component isn't applied to public routes

### Issue: Protected routes accessible without login
**Solution:** Verify route has ProtectedRoute wrapper with correct requiresAdmin flag

### Issue: Admin routes accessible to non-admin users
**Solution:** Ensure ProtectedRoute has requiresAdmin={true}

### Issue: Page reloads during navigation
**Solution:** This shouldn't happen - if it does, check that all navigation uses React Router (NavLink/useNavigate)

## Future Enhancements

### 1. Route Transitions
- Add page transition animations
- Use react-transition-group or framer-motion

### 2. Nested Routes
- Create nested route layouts
- Implement breadcrumb navigation

### 3. Route History
- Add route change analytics
- Track user navigation patterns

### 4. Lazy Route Loading
- Code-split pages for faster initial load
- Use React.lazy() and Suspense

### 5. Route Caching
- Cache page content
- Implement smart refresh

## Testing Routes

### Unit Tests
```typescript
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};
```

### Integration Tests
- Test redirect flows
- Test route transitions
- Test role-based access

### E2E Tests
- Test complete user journeys
- Test login flow
- Test page navigation
- Test logout flow

## Performance Considerations

1. **LoadingScreen**: Prevents layout shift during auth check
2. **Route Lazy Loading**: Can be added for large pages
3. **State Management**: Kept minimal in AuthContext
4. **Re-renders**: Optimized with proper hook dependencies

## Deployment Checklist

- [ ] All routes tested in production build
- [ ] 404 page styled and working
- [ ] Error boundary catching errors
- [ ] Loading screen visible during auth check
- [ ] No broken links in navigation
- [ ] Protected routes properly guarded
- [ ] Admin routes restricted
- [ ] Logout clears all session data
- [ ] No page refreshes during navigation
- [ ] Responsive design works on mobile

## Security Considerations

1. **Token Storage**: Stored in localStorage (could use sessionStorage for increased security)
2. **XSS Protection**: React's default XSS prevention active
3. **CSRF Protection**: Implement CSRF tokens in API calls
4. **Role Validation**: Both frontend (for UX) and backend (for security)
5. **Token Expiration**: Should be checked and handled by backend
