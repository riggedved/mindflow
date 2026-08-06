import { API_BASE_URL } from "./config";

export interface User {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// Store auth data in localStorage
export const authStorage = {
  setToken: (token: string) => {
    localStorage.setItem("access_token", token);
  },
  getToken: (): string | null => {
    return localStorage.getItem("access_token");
  },
  setUser: (user: User) => {
    localStorage.setItem("user", JSON.stringify(user));
  },
  getUser: (): User | null => {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },
  clear: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  },
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem("access_token");
  },
};

// Initiate Google OAuth login
export const loginWithGoogle = () => {
  // Redirect to backend OAuth endpoint
  window.location.href = `${API_BASE_URL}/api/v1/auth/login`;
};

// Handle OAuth callback (extract token from URL or handle redirect)
export const handleAuthCallback = (): AuthResponse | null => {
  // Check if we have auth data in the URL params (if backend redirects with params)
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const userStr = params.get("user");

  if (token && userStr) {
    const user = JSON.parse(decodeURIComponent(userStr));
    const authResponse: AuthResponse = {
      access_token: token,
      token_type: "bearer",
      user,
    };
    
    authStorage.setToken(token);
    authStorage.setUser(user);
    
    return authResponse;
  }

  return null;
};

// Logout
export const logout = () => {
  authStorage.clear();
  window.location.href = "/";
};

// Get current user
export const getCurrentUser = (): User | null => {
  return authStorage.getUser();
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return authStorage.isAuthenticated();
};
