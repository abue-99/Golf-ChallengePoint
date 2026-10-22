import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from './jwt.strategy';
import { InvalidTokenException } from '../common/exceptions/auth.exception';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.authService.signup(dto);
    const refreshToken = this.authService.generateRefreshToken(user.id);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken, user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.authService.login(dto);
    const refreshToken = this.authService.generateRefreshToken(user.id);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken, user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token: string | undefined = (req.cookies as Record<string, string>)[
      'refresh_token'
    ];
    if (!token) {
      throw new InvalidTokenException();
    }

    const user = await this.authService.validateRefreshToken(token);
    const accessToken = this.authService.generateAccessToken(
      user.id,
      user.email,
      user.role,
    );

    const newRefreshToken = this.authService.generateRefreshToken(user.id);
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.passwordResetService.requestReset(dto.email);
    return { ok: true };
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset(@Body() dto: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    if (!body.newPassword || body.newPassword.length < 8) {
      throw new BadRequestException(
        'New password must be at least 8 characters',
      );
    }
    await this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    return { ok: true };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      profileImage?: string | null;
      gender?: string | null;
      phoneNumber?: string | null;
      timezone?: string | null;
      country?: string | null;
      role?: string | null;
    },
  ) {
    return this.authService.updateProfile(user.id, body);
  }
}
