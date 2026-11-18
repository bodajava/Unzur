import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { ContactController } from './contact.controller.js';
import { ContactListener } from './contact.listener.js';
import { ContactResolver } from './contact.resolver.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [ContactController],
  providers: [ContactService, ContactResolver, ContactListener],
})
export class ContactModule {}
