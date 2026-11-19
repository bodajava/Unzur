import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, MaxLength } from 'class-validator';
import { NormalizeEmail, Public, RateLimit } from '../../common/decorators/index.js';
import { WheelService } from './wheel.service.js';

@InputType('WheelSpinInput')
export class WheelSpinDto {
  @Field() @NormalizeEmail() @IsEmail() @MaxLength(254) email: string;
}

@Controller('wheel')
export class WheelController {
  constructor(private readonly wheel: WheelService) {}

  /** The running wheel's labels (no odds, no chosen winners), or { active: false }. */
  @Public()
  @Get()
  current() {
    return this.wheel.publicWheel();
  }

  /** One spin per email per round; a repeat returns the same result. */
  @Public()
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Post('spin')
  @HttpCode(HttpStatus.OK)
  spin(@Body() dto: WheelSpinDto) {
    return this.wheel.spin(dto.email);
  }
}
