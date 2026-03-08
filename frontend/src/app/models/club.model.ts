export interface EnabledModules {
    dashboard: boolean;
    tournaments: boolean;
    leagues: boolean;
    courts: boolean;
    players: boolean;
    ranking: boolean;
    estadisticas: boolean;
}

export const DEFAULT_ENABLED_MODULES: EnabledModules = {
    dashboard: true,
    tournaments: true,
    leagues: true,
    courts: true,
    players: true,
    ranking: true,
    estadisticas: true,
};

export interface Club {
    id: string;
    name: string;
    description?: string;
    logo?: string;
    enableCourtPricing?: boolean;
    freePlayPointsPerWin?: number;
    enablePaymentLinkSending?: boolean;
    enablePhoneVerification?: boolean;
    enablePayments?: boolean;
    transferInfo?: ClubTransferInfo | null;
    enabledModules?: EnabledModules;
    createdAt: Date;
    updatedAt: Date;
}

export interface ClubTransferInfo {
    bankName?: string;
    accountHolder?: string;
    accountType?: string;
    accountNumber?: string;
    rut?: string;
    email?: string;
    notes?: string;
}

export interface ClubSmtpCredentials {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
}

export interface ClubTwilioCredentials {
    accountSid?: string;
    authToken?: string;
    whatsappFrom?: string;
}

export interface ClubMercadoPagoCredentials {
    accessToken?: string;
    publicKey?: string;
    notificationUrl?: string;
}

export interface ClubCredentials {
    smtp?: ClubSmtpCredentials;
    twilio?: ClubTwilioCredentials;
    mercadopago?: ClubMercadoPagoCredentials;
}

export interface UpdateClubCredentialsDto {
    smtp?: ClubSmtpCredentials;
    twilio?: ClubTwilioCredentials;
    mercadopago?: ClubMercadoPagoCredentials;
}

export interface CreateClubDto {
    name: string;
    description?: string;
    logo?: string;
}

export interface UpdateClubDto {
    name?: string;
    description?: string;
    logo?: string;
    enableCourtPricing?: boolean;
    freePlayPointsPerWin?: number;
    enablePaymentLinkSending?: boolean;
    enablePhoneVerification?: boolean;
    enablePayments?: boolean;
    transferInfo?: ClubTransferInfo | null;
    enabledModules?: Partial<EnabledModules>;
}
