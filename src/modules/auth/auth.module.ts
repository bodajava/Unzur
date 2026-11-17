import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { AuthSessionService } from './auth-session.service.js';
import { AuthController } from './auth.controller.js';
import { AuthListener } from './auth.listener.js';
import { AuthResolver } from './auth.resolver.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';

@Module({
  imports: [CartModule, OrdersModule],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionService, OtpService, AuthListener, AuthResolver],
  exports: [AuthService],
})
export class AuthModule {}
