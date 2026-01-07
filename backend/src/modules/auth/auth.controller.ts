import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { OtpVerifyDto } from './dto/otp-verify.dto.js';
import { OtpResendDto } from './dto/otp-resend.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly config: ConfigService) {}

  private useCookieMode() {
    return (this.config?.get<string>('AUTH_TOKEN_MODE') ?? 'body') === 'cookie';
  }

  private setAuthCookies(res: Response, tokens: { accessToken?: string; refreshToken?: string }) {
    if (!res) return;
    if (!this.useCookieMode()) return;
    const accessTtl = (this.config?.get<number>('ACCESS_TOKEN_TTL') ?? 900) * 1000;
    const refreshTtl = (this.config?.get<number>('REFRESH_TOKEN_TTL') ?? 60 * 60 * 24 * 14) * 1000;

    if (tokens.accessToken) {
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: accessTtl,
        path: '/',
      });
    }

    if (tokens.refreshToken) {
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: refreshTtl,
        path: '/',
      });
    }
  }

  private clearAuthCookies(res: Response) {
    if (!res) return;
    if (!this.useCookieMode()) return;
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
  }

  private extractRefreshToken(req: Request, provided?: string) {
    if (!req) return provided;
    if (provided) return provided;
    if (!this.useCookieMode()) return provided;
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return provided;
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const refresh = cookies.find((c) => c.startsWith('refreshToken='));
    if (!refresh) return provided;
    const value = refresh.split('=')[1];
    return value ? decodeURIComponent(value) : provided;
  }

  @Post('register')
  async register(@Body() body: RegisterDto) {
    await this.authService.register(body);
    return { status: 'pending' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if ('accessToken' in result || 'refreshToken' in result) {
      this.setAuthCookies(res, { accessToken: (result as any).accessToken, refreshToken: (result as any).refreshToken });
    }
    return result;
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: OtpVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyOtp({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setAuthCookies(res, { accessToken: (result as any).accessToken, refreshToken: (result as any).refreshToken });
    return result;
  }

  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() body: OtpResendDto, @Req() req: Request) {
    return this.authService.resendOtp({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = this.extractRefreshToken(req, body.refreshToken);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }
    const result = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = this.extractRefreshToken(req, body.refreshToken);
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.clearAuthCookies(res);
    return {};
  }
}
