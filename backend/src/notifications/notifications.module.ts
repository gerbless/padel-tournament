import { Module, Global } from '@nestjs/common';
import { TwilioService } from './providers/twilio.service';
import { NotificationsService } from './notifications.service';

/**
 * NotificationsModule — global module.
 * Import it once in AppModule. Any other module can then inject NotificationsService.
 */
@Global()
@Module({
    providers: [TwilioService, NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule {}
