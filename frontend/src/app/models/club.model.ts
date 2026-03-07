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
    enabledModules?: EnabledModules;
    createdAt: Date;
    updatedAt: Date;
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
    enabledModules?: Partial<EnabledModules>;
}
