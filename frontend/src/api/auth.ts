import { getDeviceToken, http, setAccessToken, setDeviceToken, setRefreshToken, logout as clearAuthState } from './http';

type LoginResponse = {
  needOtp?: boolean;
  otpRequestId?: string;
  expiresAt?: string;
  // Trusted-device login may return tokens directly.
  accessToken?: string;
  refreshToken?: string;
  deviceToken?: string;
  trustedDevice?: boolean;
};
type VerifyOtpResponse = {
  accessToken?: string;
  refreshToken?: string;
  deviceToken?: string;
};
type ResendOtpResponse = { needOtp?: boolean; otpRequestId?: string; expiresAt?: string };
type RegisterResponse = { status: string };

function getDeviceContext(): { platform?: string; timezone?: string } {
  const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  const platform =
    typeof navigator !== 'undefined'
      ? // Prefer UA-CH when available
        ((navigator as any).userAgentData?.platform as string | undefined) ?? navigator.platform
      : undefined;
  return { platform, timezone };
}

export async function loginWithEmail(email: string) {
  const { platform, timezone } = getDeviceContext();
  const deviceToken = getDeviceToken() ?? undefined;
  const { data } = await http.post<LoginResponse>('/auth/login', { email, deviceToken, platform, timezone });

  // If backend returned tokens (trusted device flow), persist them the same way as OTP verify.
  if (data.accessToken) {
    setAccessToken(data.accessToken);
  }
  if (data.refreshToken) {
    setRefreshToken(data.refreshToken);
  }
  if (data.deviceToken) {
    setDeviceToken(data.deviceToken);
  }

  return data;
}

export async function verifyOtp(otpRequestId: string, otp: string, trustDevice?: boolean) {
  const { platform, timezone } = getDeviceContext();

  const { data } = await http.post<VerifyOtpResponse>('/auth/otp/verify', {
    otpRequestId,
    code: otp,
    trustDevice,
    platform,
    timezone,
    deviceName: trustDevice ? platform ?? 'Browser' : undefined,
  });

  if (data.accessToken) {
    setAccessToken(data.accessToken);
  }
  if (data.refreshToken) {
    setRefreshToken(data.refreshToken);
  }
  if (data.deviceToken) {
    setDeviceToken(data.deviceToken);
  }

  return data;
}

export async function resendOtp(otpRequestId: string) {
  const { data } = await http.post<ResendOtpResponse>('/auth/otp/resend', { otpRequestId });
  return data;
}

export async function registerEmail(email: string) {
  const { data } = await http.post<RegisterResponse>('/auth/register', { email });
  return data;
}

export async function logout() {
  await http.post('/auth/logout');
  clearAuthState();
}
