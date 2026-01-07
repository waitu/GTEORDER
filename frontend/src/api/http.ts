import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const DEVICE_TOKEN_KEY = 'deviceToken';

const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
const getDeviceToken = () => localStorage.getItem(DEVICE_TOKEN_KEY);

const setAccessToken = (token?: string | null) => {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

const setRefreshToken = (token?: string | null) => {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

const setDeviceToken = (token?: string | null) => {
  if (token) {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  }
};

const logout = () => {
  setAccessToken(null);
  setRefreshToken(null);
  window.dispatchEvent(new Event('app:logout'));
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const { data } = await axios.post<{ accessToken?: string; refreshToken?: string }>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { withCredentials: true },
    );

    if (data.accessToken) {
      setAccessToken(data.accessToken);
    }
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
    }

    return data.accessToken ?? null;
  } catch (err) {
    console.error('Token refresh failed', err);
    return null;
  }
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { response, config } = error;
    if (!response || !config) {
      return Promise.reject(error);
    }

    const originalRequest = config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();

      const newToken = await refreshPromise;
      refreshPromise = null;

      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return http(originalRequest);
      }

      logout();
    }

    return Promise.reject(error);
  },
);

export {
  http,
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  getDeviceToken,
  setDeviceToken,
  logout,
};
