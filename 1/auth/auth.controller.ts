import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Redirect,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SigninRequest } from './dto/signin.request';
import { AuthService } from './auth.service';
import { RegistrationRequest } from './dto/registration.request';
import { AuthResponse } from './dto/auth.response';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ResetPasswordRequest } from './dto/reset-password.request';
import { ResetPasswordDataRequest } from './dto/reset-password-data.request';
import { AllowUnsubscribed } from '../payments/payments.decorators';

@AllowUnsubscribed()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: AuthResponse })
  @HttpCode(HttpStatus.OK)
  register(
    @Body() registrationData: RegistrationRequest,
  ): Promise<AuthResponse> {
    return this.authService.register(registrationData);
  }

  @Post('signin')
  @ApiCreatedResponse({ type: AuthResponse })
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInData: SigninRequest): Promise<AuthResponse> {
    return this.authService.signIn(signInData);
  }

  @Delete('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req): Promise<void> {
    return this.authService.logout(req.user);
  }

  // TODO: add FE success page url
  @Get('email/:email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Redirect(
    `${process.env.FRONTEND_HOST}/registration-success`,
    HttpStatus.MOVED_PERMANENTLY,
  )
  async verifyEmail(
    @Param('email') email: string,
    @Query('code') code: string,
  ) {
    await this.authService.verifyEmail(email, code);
    return { url: `${process.env.FRONTEND_HOST}/registration-success` };
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPasswordRequest(
    @Body() resetPasswordRequest: ResetPasswordRequest,
  ): Promise<void> {
    return this.authService.resetPasswordRequest(resetPasswordRequest);
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body() resetPasswordDataRequest: ResetPasswordDataRequest,
  ): Promise<void> {
    return this.authService.resetPassword(resetPasswordDataRequest);
  }

  @Get('status')
  status() {
    return 'ok';
  }
}
