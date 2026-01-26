export interface League {
    id: string;
    name: string;
    type: 'round_robin' | 'groups_playoff';
    startDate: Date;
    endDate?: Date;
    category?: string;

    // Configuration
    config: LeagueConfig;

    // Pairs/Teams - backend sends 'teams', we treat as 'pairs'
    pairs?: Pair[];
    teams?: any[]; // Backend structure - will be converted to pairs

    // Schedule
    matches: Match[];

    // Groups (only for groups_playoffs)
    groups?: Group[];

    // Status
    status: 'draft' | 'active' | 'completed';
    currentRound: number;

    createdAt: Date;
    updatedAt: Date;
}

export interface LeagueConfig {
    // Common
    pointsWin: number;
    pointsDraw: number;
    pointsLoss: number;
    setsToWin: number; // typically 2 (best of 3)
    gamesPerSet: number; // typically 6
    tiebreakAt: number; // typically 6
    tiebreakInThirdSet: boolean;

    // Round Robin specific
    rounds?: number; // number of times each pair plays each other

    // Groups + Playoffs specific
    numberOfGroups?: number;
    teamsAdvancePerGroup?: number; // e.g., top 2 advance to playoffs
    enableMultiTierPlayoffs?: boolean; // Gold/Silver/Bronze cups
}

export interface Pair {
    id: string;
    playerA: Player;
    playerB: Player;

    // Stats
    points: number;
    wins: number;
    draws: number;
    losses: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;

    // Match history
    matchHistory: MatchResult[];

    // Group assignment (for groups_playoffs)
    groupId?: string;
}

export interface Player {
    id: string;
    name: string;
    ranking?: number;
}

export interface Match {
    id: string;
    leagueId: string;
    round: number;
    pairA: Pair;
    pairB: Pair;

    // Scheduling
    scheduledAt?: Date;
    court?: string;

    // Results
    result?: MatchResult;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

    // Group info (for groups_playoffs)
    groupId?: string;
    group?: string; // Backend identifier (e.g. Playoff_Gold_F)
    phase?: string; // Frontend normalized phase

    createdAt: Date;
    updatedAt: Date;
}

export interface MatchResult {
    sets: SetScore[];
    winnerPairId: string;
    pointsAwarded: {
        pairA: number;
        pairB: number;
    };
    completedAt: Date;
}

export interface SetScore {
    pairAGames: number;
    pairBGames: number;
    tiebreak?: {
        pairAPoints: number;
        pairBPoints: number;
    };
}

export interface Group {
    id: string;
    name: string; // e.g., "Grupo A"
    pairs: Pair[];
    matches: Match[];
}

// Request/Response DTOs
export interface CreateLeagueRequest {
    name: string;
    type: 'round_robin' | 'groups_playoff';
    startDate: string;
    category?: string;
    config: LeagueConfig;
    playerIds?: string[]; // Array of player IDs to form pairs (legacy)
    pairs?: { playerA: string; playerB: string }[]; // New pair structure
}

export interface UpdateMatchResultRequest {
    matchId: string;
    result: MatchResult;
}
