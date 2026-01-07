import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithEmail, logout as apiLogout, resendOtp as resendOtpApi, verifyOtp as verifyOtpApi } from '../api/auth';
import { getAccessToken } from '../api/http';

type User = {
  id: string;
  email: string;
  role?: string;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  pendingOtpRequestId: string | null;
  login: (email: string) => Promise<void>;
  verifyOtp: (otp: string, trustDevice?: boolean) => Promise<void>;
  resendOtp: () => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const decodeUserFromToken = (token?: string | null): User | null => {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalized);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const id = typeof parsed.sub === 'string' ? parsed.sub : undefined;
    const email = typeof parsed.email === 'string' ? parsed.email : undefined;
    const role = typeof parsed.role === 'string' ? parsed.role : undefined;
    if (!id || !email) return null;
    return { id, email, role };
  } catch (err) {
    console.error('Failed to decode access token', err);
    return null;
  }
};

const isUserShape = (value: unknown): value is User => {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as User).id === 'string' &&
    typeof (value as User).email === 'string'
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [pendingOtpRequestId, setPendingOtpRequestId] = useState<string | null>(null);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAccessToken();
      const decoded = decodeUserFromToken(token);
      if (decoded) {
        setUser(decoded);
        setIsAuthenticated(true);
        return;
      }
    } catch (err) {
      console.warn('Session restore failed', err);
    } finally {
      setIsLoading(false);
    }
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const onForcedLogout = () => {
      setIsAuthenticated(false);
      setUser(null);
      setPendingOtpRequestId(null);
      navigate('/login');
    };
    window.addEventListener('app:logout', onForcedLogout);
    return () => window.removeEventListener('app:logout', onForcedLogout);
  }, [navigate]);

  const login = useCallback(
    async (email: string) => {
      const result = await loginWithEmail(email);
      if (!result.otpRequestId) {
        throw new Error('OTP request could not be created');
      }
      setPendingOtpRequestId(result.otpRequestId);
      navigate('/otp');
    },
    [navigate],
  );

  const verifyOtp = useCallback(
    async (otp: string, trustDevice?: boolean) => {
      if (!pendingOtpRequestId) {
        throw new Error('No pending OTP request. Start login first.');
      }

      const { accessToken } = await verifyOtpApi(pendingOtpRequestId, otp, trustDevice);
      const tokenToUse = accessToken ?? getAccessToken();
      const decodedUser = decodeUserFromToken(tokenToUse);

      if (decodedUser) {
        setUser(decodedUser);
        setIsAuthenticated(true);
      }

      setPendingOtpRequestId(null);
    },
    [pendingOtpRequestId],
  );

  const resendOtp = useCallback(async () => {
    if (!pendingOtpRequestId) {
      throw new Error('No pending OTP request to resend. Start login first.');
    }

    const result = await resendOtpApi(pendingOtpRequestId);
    if (result.otpRequestId) setPendingOtpRequestId(result.otpRequestId);
  }, [pendingOtpRequestId]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setPendingOtpRequestId(null);
      navigate('/login');
    }
  }, [navigate]);

  const value = useMemo(
    () => ({ isAuthenticated, isLoading, user, pendingOtpRequestId, login, verifyOtp, resendOtp, logout, restoreSession }),
    [isAuthenticated, isLoading, user, pendingOtpRequestId, login, verifyOtp, resendOtp, logout, restoreSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
