import { Tournament } from '../tournaments/entities/tournament.entity';
import { Team } from '../teams/entities/team.entity';
import { Match } from '../matches/entities/match.entity';
import { League } from '../leagues/entities/league.entity';
import { LeagueTeam } from '../leagues/entities/league-team.entity';
import { LeagueMatch } from '../leagues/entities/league-match.entity';
import { Court } from '../courts/entities/court.entity';
import { CourtPriceBlock } from '../courts/entities/court-price-block.entity';
import { CourtBlock } from '../courts/entities/court-block.entity';
import { Reservation } from '../courts/entities/reservation.entity';
import { FreePlayMatch } from '../courts/entities/free-play-match.entity';
import { MercadoPagoPayment } from '../payments/entities/mercadopago-payment.entity';
import { PlayerClubStats } from '../players/entities/player-club-stats.entity';

/**
 * Entities that live in per-club schemas.
 * Used by TenantService.createSchemaForClub() to initialise tables via TypeORM synchronize().
 *
 * Entities NOT in this list (User, Player, Category, Club, UserClubRole, PersonalMatch)
 * stay in the default `public` schema.
 */
export const CLUB_ENTITIES = [
    // Tournaments
    Tournament, Team, Match,
    // Leagues
    League, LeagueTeam, LeagueMatch,
    // Courts & reservations
    Court, CourtPriceBlock, CourtBlock,
    Reservation, FreePlayMatch,
    // Payments
    MercadoPagoPayment,
    // Per-club player stats
    PlayerClubStats,
];
