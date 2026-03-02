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
    paymentNotes?: string;
    playerPayments?: { playerName: string; paid: boolean; amount: number }[];
    court?: Court;
    createdAt: Date;
    updatedAt: Date;
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
}

export interface MonthlyTrend {
    month: number;
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    partialRevenue: number;
    totalReservations: number;
}

export interface BillingDashboard {
    courts: CourtBilling[];
    totals: BillingTotals;
    monthlyTrend: MonthlyTrend[];
}
