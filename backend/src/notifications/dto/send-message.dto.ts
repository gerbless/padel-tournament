export enum NotificationChannel {
    WHATSAPP = 'whatsapp',
    SMS = 'sms',
}

export enum NotificationTemplate {
    PHONE_OTP = 'phone_otp',
    RESERVATION_CONFIRM = 'reservation_confirm',
    RESERVATION_REMINDER = 'reservation_reminder',
    PAYMENT_LINK = 'payment_link',
    MATCH_SUGGESTION = 'match_suggestion',
    ADMIN_COURT_BOOKED = 'admin_court_booked',
    CUSTOM = 'custom',
}

export interface SendMessageDto {
    to: string; // E.164 format: +56912345678
    template: NotificationTemplate;
    channel?: NotificationChannel;
    params?: Record<string, string | number>;
    customBody?: string; // used when template = CUSTOM
}

export interface SendMessageResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
