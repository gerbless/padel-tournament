export interface Court {
    id: string;
    clubId: string;
    name: string;
    courtNumber: number;
    surfaceType?: string;
    isActive: boolean;
    priceBlocks?: CourtPriceBlock[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CourtPriceBlock {
    id?: string;
    courtId?: string;
    daysOfWeek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
    startTime: string;    // "08:00"
    endTime: string;      // "10:00"
    priceFullCourt: number;
    pricePerPlayer: number;
}

export interface Reservation {
    id: string;
    courtId: string;
    clubId: string;
    date: string;         // "YYYY-MM-DD"
    startTime: string;    // "08:00"
    endTime: string;      // "09:30"
    title?: string;
    status: 'pending' | 'confirmed' | 'cancelled';
    players: string[];
    playerCount: number;
    priceType: 'full_court' | 'per_player';
    basePrice: number;
    finalPrice: number;
    paymentStatus: 'pending' | 'paid' | 'partial';
    paymentMethod?: 'cash' | 'transfer' | 'mercado_pago' | 'red_compras';
    paymentNotes?: string;
    playerPayments?: { playerId?: string; playerName: string; paid: boolean; amount: number; paymentMethod?: string }[];
    countsForRanking?: boolean;
    court?: Court;
    createdAt: Date;
    updatedAt: Date;
}

export interface FreePlayMatch {
    id?: string;
    reservationId: string;
    clubId: string;
    date: string;
    team1PlayerIds: string[];
    team2PlayerIds: string[];
    team1Names: string[];
    team2Names: string[];
    sets: { team1: number; team2: number }[];
    winner?: number | null;
    countsForRanking: boolean;
    pointsPerWin: number;
    status: 'pending' | 'completed';
    createdAt?: Date;
    updatedAt?: Date;
}

export interface RevenueReport {
    totalRevenue: number;
    totalReservations: number;
    paidRevenue: number;
    pendingRevenue: number;
}

export interface MonthlyRevenue {
    month: number;
    totalRevenue: number;
    totalReservations: number;
    paidRevenue: number;
}

export interface CourtBilling {
    courtId: string;
    courtName: string;
    courtNumber: number;
    totalReservations: number;
    paidCount: number;
    partialCount: number;
    pendingCount: number;
    totalRevenue: number;
    paidRevenue: number;
    partialRevenue: number;
    pendingRevenue: number;
    collectedRevenue: number;
    owedRevenue: number;
}

export interface BillingTotals {
    totalReservations: number;
    paidCount: number;
    partialCount: number;
    pendingCount: number;
    totalRevenue: number;
    paidRevenue: number;
    partialRevenue: number;
    pendingRevenue: number;
    collectedRevenue: number;
    owedRevenue: number;
}

export interface MonthlyTrend {
    month: number;
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    partialRevenue: number;
    totalReservations: number;
}

export interface PaymentMethodStat {
    method: string;
    count: number;
    revenue: number;
}

export interface PlayerBillingStat {
    name: string;
    gamesPlayed: number;
    totalBilled: number;
    totalPaid: number;
    totalOwed: number;
    paymentMethods: { method: string; count: number }[];
}

export interface BillingDashboard {
    courts: CourtBilling[];
    totals: BillingTotals;
    monthlyTrend: MonthlyTrend[];
    paymentMethodStats: PaymentMethodStat[];
}

export interface CourtBlock {
    id: string;
    clubId: string;
    startDate: string;
    endDate: string;
    blockType: 'full_day' | 'morning' | 'afternoon' | 'night' | 'custom';
    customStartTime?: string;
    customEndTime?: string;
    courtIds: string[] | null;
    reason: string;
    isActive: boolean;
    createdAt: Date;
}
