# Backend Integration Guide

## Connecting Your API

The routing system expects specific API endpoints for authentication. This guide shows how to set them up in your backend.

## Required API Endpoints

### 1. Login Endpoint
**POST** `/api/auth/login`

**Request:**
```json
{
  "email": "doctor@hospital.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-123",
    "email": "doctor@hospital.com",
    "name": "Dr. John Doe",
    "role": "doctor"
  }
}
```

**Error Response:**
```json
{
  "error": "Invalid credentials"
}
```

### 2. Register Endpoint
**POST** `/api/auth/register`

**Request:**
```json
{
  "email": "doctor@hospital.com",
  "password": "secure_password",
  "name": "Dr. John Doe"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-123",
    "email": "doctor@hospital.com",
    "name": "Dr. John Doe",
    "role": "doctor"
  }
}
```

### 3. Verify Token Endpoint
**GET** `/api/auth/me`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "id": "user-123",
  "email": "doctor@hospital.com",
  "name": "Dr. John Doe",
  "role": "doctor"
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized"
}
```

## Backend Implementation Example (FastAPI/Python)

```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta

app = FastAPI()
security = HTTPBearer()

SECRET_KEY = "your-secret-key-here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class User(BaseModel):
    id: str
    email: str
    name: str
    role: str

class AuthResponse(BaseModel):
    token: str
    user: User

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    # Validate credentials
    user = await authenticate_user(request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Generate JWT token
    token = create_access_token(user.id)

    return AuthResponse(
        token=token,
        user=User(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role
        )
    )

@app.post("/api/auth/register")
async def register(request: RegisterRequest):
    # Check if user exists
    existing_user = await get_user_by_email(request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    user = await create_user(
        email=request.email,
        password=request.password,
        name=request.name,
        role="doctor"  # Default role
    )

    # Generate JWT token
    token = create_access_token(user.id)

    return AuthResponse(
        token=token,
        user=User(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role
        )
    )

@app.get("/api/auth/me")
async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)):
    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role
    }

def create_access_token(user_id: str):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": user_id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Database functions (implement these)
async def authenticate_user(email: str, password: str):
    # Query database and verify password
    pass

async def get_user_by_email(email: str):
    # Query database
    pass

async def get_user_by_id(user_id: str):
    # Query database
    pass

async def create_user(email: str, password: str, name: str, role: str):
    # Create user in database with hashed password
    pass
```

## User Roles

The system supports three main roles:

| Role | Admin | Permissions |
|------|-------|-------------|
| `user` | No | Basic access to all protected routes |
| `doctor` | No | Access to analysis, reports, assistant |
| `admin` | Yes | Full access including admin panel |

## CORS Configuration

Make sure your backend allows requests from your frontend:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## API Configuration

Update `src/api.ts` to point to your backend:

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function apiCall(endpoint: string, options?: RequestInit) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token invalid, logout user
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}
```

## Environment Variables

Create `.env.local` in the frontend directory:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENV=development
```

For production (`.env.production`):

```env
REACT_APP_API_URL=https://api.neuroscan.ai
REACT_APP_ENV=production
```

## Security Best Practices

### 1. Token Management
- ✅ Store tokens in localStorage (or sessionStorage for better security)
- ✅ Include token in Authorization header
- ✅ Auto-logout on 401 response
- ✅ Implement token refresh mechanism

### 2. Password Security
- ✅ Hash passwords with bcrypt or similar
- ✅ Enforce strong password requirements
- ✅ Never log passwords
- ✅ Use HTTPS only

### 3. JWT Configuration
- ✅ Set reasonable expiration (15-60 minutes)
- ✅ Implement refresh token rotation
- ✅ Validate token signature
- ✅ Use strong secret key

### 4. API Security
- ✅ Implement CORS properly
- ✅ Rate limit login attempts
- ✅ Validate all inputs
- ✅ Never trust client-side role checks
- ✅ Always verify permissions on backend

## Testing Your API

### Using cURL

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor@hospital.com","password":"password"}'

# Verify token
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

1. Create POST request to `http://localhost:8000/api/auth/login`
2. Set body to JSON:
   ```json
   {
     "email": "doctor@hospital.com",
     "password": "password"
   }
   ```
3. Copy the `token` from response
4. Create GET request to `http://localhost:8000/api/auth/me`
5. In Authorization tab, select "Bearer Token"
6. Paste the token

## Troubleshooting

### CORS Errors
**Problem:** `Access to XMLHttpRequest blocked by CORS`
**Solution:** Add frontend URL to backend CORS configuration

### 401 Unauthorized
**Problem:** Token not accepted
**Solution:**
- Check token format (Bearer scheme)
- Verify token is not expired
- Check SECRET_KEY matches frontend expectations

### Token Persists After Logout
**Problem:** User can still access routes
**Solution:** Clear localStorage properly in logout function

### Auto-logout Not Working
**Problem:** App doesn't logout on 401
**Solution:** Verify API wrapper checks response.status === 401

## Example Flow

1. **User navigates to /login**
   - AuthContext isLoading = false
   - No token in localStorage

2. **User enters credentials and clicks login**
   - AuthContext calls login(email, password)
   - API sends POST /api/auth/login
   - Backend returns token + user data
   - AuthContext saves token to localStorage
   - AuthContext updates user state

3. **User navigates to /dashboard**
   - ProtectedRoute checks isAuthenticated
   - User is authenticated, so dashboard renders

4. **User clicks logout**
   - Shell component calls logout()
   - AuthContext clears user and localStorage
   - User redirected to home page

5. **User refreshes page**
   - App mounts with isLoading = true
   - AuthContext checks localStorage for token
   - If found, validates with GET /api/auth/me
   - If valid, sets user data and isLoading = false
   - If invalid, clears token and isLoading = false

## Next Steps

1. Implement the required API endpoints in your backend
2. Update environment variables with your API URL
3. Test the login flow thoroughly
4. Implement additional API endpoints as needed (analysis, reports, etc.)
5. Add proper error handling and user feedback

## Resources

- [React Router Documentation](https://reactrouter.com/)
- [JWT.io](https://jwt.io/) - JWT information and debugging
- [FastAPI Documentation](https://fastapi.tiangolo.com/) - If using FastAPI
- [Express.js Authentication](https://expressjs.com/) - If using Node.js
