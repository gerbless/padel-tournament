import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { PlayerClubStats } from './entities/player-club-stats.entity';
import { FreePlayMatch } from '../courts/entities/free-play-match.entity';
import { User } from '../users/entities/user.entity';
import { Club } from '../clubs/entities/club.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';
import { PlayerRankingService } from './player-ranking.service';
import { PlayerRecommendationService } from './player-recommendation.service';
import { TenantService } from '../tenant/tenant.service';
import { EmailService } from '../email/email.service';
import { PhoneVerificationService } from '../phone-verification/phone-verification.service';
import { randomUUID } from 'crypto';

@Injectable()
export class PlayersService {
    constructor(
        @InjectRepository(Player)
        private playerRepository: Repository<Player>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Club)
        private clubRepository: Repository<Club>,
        private rankingService: PlayerRankingService,
        private recommendationService: PlayerRecommendationService,
        private tenant: TenantService,
        private emailService: EmailService,
        private phoneVerificationService: PhoneVerificationService,
    ) { }

    async create(createPlayerDto: CreatePlayerDto): Promise<Player> {
        // Build query to check for existing player by identifiers
        const whereConditions: any[] = [{ name: createPlayerDto.name }];
        if (createPlayerDto.identification) {
            whereConditions.push({ identification: createPlayerDto.identification });
        }
        if (createPlayerDto.email) {
            whereConditions.push({ email: createPlayerDto.email });
        }

        const existing = await this.playerRepository.findOne({
            where: whereConditions
        });

        if (existing) {
            return existing; // Idempotent: return existing if found
        }

        const player = this.playerRepository.create({
            name: createPlayerDto.name,
            identification: createPlayerDto.identification,
            email: createPlayerDto.email,
            phone: (createPlayerDto as any).phone,
            category: createPlayerDto.categoryId ? { id: createPlayerDto.categoryId } as any : undefined,
            position: createPlayerDto.position
        });

        try {
            // Save player first to get ID
            const savedPlayer = await this.playerRepository.save(player);

            // Handle club associations if provided
            if (createPlayerDto.clubIds && createPlayerDto.clubIds.length > 0) {
                savedPlayer.clubs = createPlayerDto.clubIds.map(id => ({ id } as any));
                await this.playerRepository.save(savedPlayer);
            }
            // If no clubs specified, player belongs to ALL clubs (no associations needed)

            return savedPlayer;
        } catch (error) {
            // Handle duplicate key error from concurrent requests
            // Handle duplicate key error from concurrent requests
            if (error.code === '23505') {
                const whereConditions: any[] = [{ name: createPlayerDto.name }];
                if (createPlayerDto.identification) {
                    whereConditions.push({ identification: createPlayerDto.identification });
                }
                if (createPlayerDto.email) {
                    whereConditions.push({ email: createPlayerDto.email });
                }

                const existingPlayer = await this.playerRepository.findOne({
                    where: whereConditions,
                    relations: ['category', 'clubs']
                });
                if (existingPlayer) {
                    return existingPlayer;
                }
            }
            throw error;
        }
    }

    async findOrCreateByName(name: string): Promise<Player> {
        return this.create({ name });
    }

    async findAll(clubId?: string, pagination?: PaginationQueryDto, search?: string): Promise<PaginatedResult<Player>> {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        const skip = (page - 1) * limit;

        const qb = this.playerRepository.createQueryBuilder('player')
            .leftJoinAndSelect('player.category', 'category')
            .leftJoinAndSelect('player.clubs', 'clubs');

        if (clubId) {
            // Players explicitly assigned to this club OR players with no club (belong to all)
            qb.where(
                `(player.id IN (SELECT pc."player_id" FROM player_clubs pc WHERE pc."club_id" = :clubId)` +
                ` OR player.id NOT IN (SELECT DISTINCT pc2."player_id" FROM player_clubs pc2))`,
                { clubId },
            );
        }

        if (search && search.trim()) {
            const s = `%${search.trim()}%`;
            qb.andWhere(
                '(player.name ILIKE :s OR player.email ILIKE :s OR player.phone ILIKE :s OR player.identification ILIKE :s)',
                { s },
            );
        }

        qb.orderBy('player.name', 'ASC');

        const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(id: string): Promise<Player> {
        const player = await this.playerRepository.findOne({
            where: { id },
            relations: ['category']
        });
        if (!player) {
            throw new NotFoundException(`Player with ID ${id} not found`);
        }
        return player;
    }

    /**
     * Find a player that was pre-registered by an admin (has no associated User account yet).
     * Used during self-registration to auto-fill the form.
     */
    async findPreregisteredByEmailOrIdentification(
        email?: string,
        identification?: string,
    ): Promise<Player | null> {
        const conditions: any[] = [];
        if (email) conditions.push({ email });
        if (identification) conditions.push({ identification });
        if (conditions.length === 0) return null;

        const player = await this.playerRepository.findOne({ where: conditions });
        if (!player) return null;

        // Check that this player does NOT already have a user account
        // We rely on UsersService not being available here — use a raw query
        const hasUser = await this.playerRepository.query(
            `SELECT id FROM users WHERE "playerId" = $1 LIMIT 1`,
            [player.id],
        );

        return hasUser.length === 0 ? player : null;
    }

    /**
     * Update phone for an existing player.
     */
    async updatePhone(id: string, phone: string): Promise<void> {
        await this.playerRepository.update(id, { phone } as any);
    }

    async update(id: string, updatePlayerDto: UpdatePlayerDto): Promise<Player> {
        const player = await this.playerRepository.findOne({
            where: { id },
            relations: ['category', 'clubs']
        });

        if (!player) {
            throw new NotFoundException(`Player with ID ${id} not found`);
        }

        if (updatePlayerDto.name !== undefined) {
            player.name = updatePlayerDto.name;
        }

        if (updatePlayerDto.email !== undefined) {
            player.email = updatePlayerDto.email;
        }

        if (updatePlayerDto.identification !== undefined) {
            player.identification = updatePlayerDto.identification;
        }

        if (updatePlayerDto.categoryId !== undefined) {
            player.category = updatePlayerDto.categoryId ? { id: updatePlayerDto.categoryId } as any : null;
        }

        if (updatePlayerDto.position !== undefined) {
            player.position = updatePlayerDto.position;
        }

        if (updatePlayerDto.clubIds !== undefined) {
            // Update club associations
            player.clubs = updatePlayerDto.clubIds.length > 0
                ? updatePlayerDto.clubIds.map(clubId => ({ id: clubId } as any))
                : [];
        }

        return this.playerRepository.save(player);
    }

    async getRanking(categoryId?: string, clubId?: string): Promise<Player[]> {
        return this.rankingService.getRanking(categoryId, clubId);
    }

    async updateStats(id: string, stats: Partial<Player>): Promise<void> {
        await this.playerRepository.update(id, stats);
    }

    async remove(id: string): Promise<void> {
        const player = await this.findOne(id);

        // Check if player is part of any team (using tenant-scoped repo for club tables)
        const [teamCount1, teamCount2] = await this.tenant.runInContext(async (em) => {
            const tc1 = await em.getRepository(Player).createQueryBuilder('player')
                .leftJoin('player.teamsAsPlayer1', 'team')
                .where('player.id = :id', { id })
                .andWhere('team.id IS NOT NULL')
                .getCount();

            const tc2 = await em.getRepository(Player).createQueryBuilder('player')
                .leftJoin('player.teamsAsPlayer2', 'team')
                .where('player.id = :id', { id })
                .andWhere('team.id IS NOT NULL')
                .getCount();

            return [tc1, tc2];
        });

        if (player.tournamentsPlayed > 0 || teamCount1 > 0 || teamCount2 > 0) {
            throw new ConflictException('No se puede eliminar el jugador porque tiene torneos jugados');
        }

        await this.playerRepository.delete(id);
    }

    async recalculateTotalPoints(playerIds: string[]) {
        const uniqueIds = [...new Set(playerIds)];
        if (uniqueIds.length === 0) return;

        await this.tenant.runInContext(async (em) => {

        // Single query: load ALL players with ALL relations at once (eliminates N+1)
        // Use tenant-scoped repo so search_path includes the club schema
        // (teams, matches, league_teams live in club schemas, not public)
        const players = await em.getRepository(Player).createQueryBuilder('player')
            .leftJoinAndSelect('player.teamsAsPlayer1', 'tp1')
            .leftJoinAndSelect('tp1.tournament', 'tp1_tournament')
            .leftJoinAndSelect('tp1.matchesAsTeam1', 'tp1_m1')
            .leftJoinAndSelect('tp1_m1.winner', 'tp1_m1_winner')
            .leftJoinAndSelect('tp1.matchesAsTeam2', 'tp1_m2')
            .leftJoinAndSelect('tp1_m2.winner', 'tp1_m2_winner')
            .leftJoinAndSelect('player.teamsAsPlayer2', 'tp2')
            .leftJoinAndSelect('tp2.tournament', 'tp2_tournament')
            .leftJoinAndSelect('tp2.matchesAsTeam1', 'tp2_m1')
            .leftJoinAndSelect('tp2_m1.winner', 'tp2_m1_winner')
            .leftJoinAndSelect('tp2.matchesAsTeam2', 'tp2_m2')
            .leftJoinAndSelect('tp2_m2.winner', 'tp2_m2_winner')
            .leftJoinAndSelect('player.leagueTeamsAsPlayer1', 'ltp1')
            .leftJoinAndSelect('ltp1.league', 'ltp1_league')
            .leftJoinAndSelect('player.leagueTeamsAsPlayer2', 'ltp2')
            .leftJoinAndSelect('ltp2.league', 'ltp2_league')
            .leftJoinAndSelect('player.clubs', 'club')
            .where('player.id IN (:...ids)', { ids: uniqueIds })
            .getMany();

        for (const player of players) {

            // Global stats
            let globalTotalPoints = 0;
            let globalLeaguePoints = 0;
            let globalTournamentPoints = 0;
            let globalMatchesWon = 0;
            const globalTournamentIds = new Set<string>();
            const globalLeagueIds = new Set<string>();

            // Stats grouped by club: { clubId: { totalPoints, leaguePoints, tournamentPoints, matchesWon, ... } }
            const statsByClub = new Map<string, any>();

            // Helper to ensure club stats entry exists
            const ensureClubStats = (clubId: string | null) => {
                const key = clubId || 'NO_CLUB';
                if (!statsByClub.has(key)) {
                    statsByClub.set(key, {
                        clubId,
                        totalPoints: 0,
                        leaguePoints: 0,
                        tournamentPoints: 0,
                        freePlayPoints: 0,
                        matchesWon: 0,
                        matchesLost: 0,
                        gamesWon: 0,
                        gamesLost: 0,
                        tournamentIds: new Set<string>(),
                        leagueIds: new Set<string>()
                    });
                }
                return statsByClub.get(key);
            };

            // Process tournament teams
            const processTournamentTeams = (teams: any[]) => {
                teams.forEach(team => {
                    const clubId = team.tournament?.clubId || null;
                    const clubStats = ensureClubStats(clubId);

                    if (team.tournamentId) {
                        globalTournamentIds.add(team.tournamentId);
                        clubStats.tournamentIds.add(team.tournamentId);
                    }

                    const config = team.tournament?.config || {};
                    const ptsWin = config.pointsForWin ?? 3;
                    const ptsTie = config.pointsForTie ?? 1;
                    const ptsLoss = config.pointsForLoss ?? 0;

                    // Process matches where team was Team 1
                    team.matchesAsTeam1?.forEach(match => {
                        if (match.status === 'completed') {
                            if (match.winner?.id === team.id) {
                                // Win
                                globalTournamentPoints += ptsWin;
                                globalMatchesWon++;
                                clubStats.tournamentPoints += ptsWin;
                                clubStats.matchesWon++;
                            } else if (!match.winner) {
                                // Draw
                                globalTournamentPoints += ptsTie;
                                clubStats.tournamentPoints += ptsTie;
                            } else {
                                // Loss
                                globalTournamentPoints += ptsLoss;
                                clubStats.tournamentPoints += ptsLoss;
                                clubStats.matchesLost++;
                            }
                        }
                    });

                    // Process matches where team was Team 2
                    team.matchesAsTeam2?.forEach(match => {
                        if (match.status === 'completed') {
                            if (match.winner?.id === team.id) {
                                // Win
                                globalTournamentPoints += ptsWin;
                                globalMatchesWon++;
                                clubStats.tournamentPoints += ptsWin;
                                clubStats.matchesWon++;
                            } else if (!match.winner) {
                                // Draw
                                globalTournamentPoints += ptsTie;
                                clubStats.tournamentPoints += ptsTie;
                            } else {
                                // Loss
                                globalTournamentPoints += ptsLoss;
                                clubStats.tournamentPoints += ptsLoss;
                                clubStats.matchesLost++;
                            }
                        }
                    });
                });
            };

            processTournamentTeams(player.teamsAsPlayer1 || []);
            processTournamentTeams(player.teamsAsPlayer2 || []);

            // Process league teams
            const processLeagueTeams = (teams: any[]) => {
                teams.forEach(team => {
                    const clubId = team.league?.clubId || null;
                    const clubStats = ensureClubStats(clubId);

                    if (team.leagueId) {
                        globalLeagueIds.add(team.leagueId);
                        clubStats.leagueIds.add(team.leagueId);
                    }

                    const points = team.points || 0;
                    const matchesWon = team.matchesWon || 0;

                    globalLeaguePoints += points;
                    globalMatchesWon += matchesWon;
                    clubStats.leaguePoints += points;
                    clubStats.matchesWon += matchesWon;
                });
            };

            processLeagueTeams(player.leagueTeamsAsPlayer1 || []);
            processLeagueTeams(player.leagueTeamsAsPlayer2 || []);

            // Process free-play matches
            let globalFreePlayPoints = 0;
            let globalFreePlayWins = 0;

            const freePlayMatches = await em.getRepository(FreePlayMatch).createQueryBuilder('fpm')
                .where('fpm.status = :status', { status: 'completed' })
                .andWhere('fpm.countsForRanking = true')
                .getMany();

            for (const m of freePlayMatches) {
                const inTeam1 = (m.team1PlayerIds || []).includes(player.id);
                const inTeam2 = (m.team2PlayerIds || []).includes(player.id);
                if (!inTeam1 && !inTeam2) continue;

                const clubId = m.clubId || null;
                const clubStats = ensureClubStats(clubId);

                if ((m.winner === 1 && inTeam1) || (m.winner === 2 && inTeam2)) {
                    globalFreePlayPoints += m.pointsPerWin;
                    globalFreePlayWins++;
                    globalMatchesWon++;
                    clubStats.freePlayPoints = (clubStats.freePlayPoints || 0) + m.pointsPerWin;
                    clubStats.matchesWon++;
                } else if (m.winner !== null) {
                    clubStats.matchesLost++;
                }
            }

            // Calculate total points for each club
            statsByClub.forEach(stats => {
                stats.totalPoints = stats.tournamentPoints + stats.leaguePoints + (stats.freePlayPoints || 0);
                stats.tournamentsPlayed = stats.tournamentIds.size;
                stats.leaguesPlayed = stats.leagueIds.size;
            });

            // Update global player stats — use update() instead of save()
            // to avoid TypeORM cascade issues with cross-schema relations (teams, league_teams)
            globalTotalPoints = globalTournamentPoints + globalLeaguePoints + globalFreePlayPoints;

            await this.playerRepository.update(player.id, {
                totalPoints: globalTotalPoints,
                tournamentPoints: globalTournamentPoints,
                leaguePoints: globalLeaguePoints,
                freePlayPoints: globalFreePlayPoints,
                matchesWon: globalMatchesWon,
                tournamentsPlayed: globalTournamentIds.size,
                leaguesPlayed: globalLeagueIds.size,
            });

            // Update PlayerClubStats for each club
            for (const [key, stats] of statsByClub.entries()) {
                if (key === 'NO_CLUB' || !stats.clubId) {
                    // Skip inter-club stats (they use global Player stats)
                    continue;
                }

                const clubStats = await this.getOrCreatePlayerClubStats(player.id, stats.clubId);
                if (clubStats) {
                    // Use update() instead of save() to avoid cascade issues
                    await em.getRepository(PlayerClubStats).update(clubStats.id, {
                        totalPoints: stats.totalPoints,
                        leaguePoints: stats.leaguePoints,
                        tournamentPoints: stats.tournamentPoints,
                        freePlayPoints: stats.freePlayPoints || 0,
                        matchesWon: stats.matchesWon,
                        matchesLost: stats.matchesLost,
                        tournamentsPlayed: stats.tournamentsPlayed,
                        leaguesPlayed: stats.leaguesPlayed,
                    });
                }
            }
        }
        }); // end tenant.runInContext
    }

    async getLeagueRanking(categoryId?: string, clubId?: string): Promise<Player[]> {
        return this.rankingService.getLeagueRanking(categoryId, clubId);
    }

    async getTournamentRanking(categoryId?: string, clubId?: string): Promise<Player[]> {
        return this.rankingService.getTournamentRanking(categoryId, clubId);
    }

    async getFreePlayRanking(categoryId?: string, clubId?: string): Promise<Player[]> {
        return this.rankingService.getFreePlayRanking(categoryId, clubId);
    }

    async getPairRankings(type: 'global' | 'league' | 'tournament', categoryId?: string, clubId?: string): Promise<any[]> {
        return this.rankingService.getPairRankings(type, categoryId, clubId);
    }

    async getRecommendedMatches(clubId?: string): Promise<any[]> {
        return this.recommendationService.getRecommendedMatches(clubId);
    }

    async getAllPartnerRecommendations(clubId?: string): Promise<any[]> {
        return this.recommendationService.getAllPartnerRecommendations(clubId);
    }

    async getGlobalTopPlayers(limit: number = 10): Promise<Player[]> {
        return this.rankingService.getGlobalTopPlayers(limit);
    }

    async cleanupOrphanedPlayers(playerIds: string[]): Promise<void> {
        // First recalculate to ensure stats are accurate (e.g. tournamentsPlayed = 0)
        await this.recalculateTotalPoints(playerIds);

        for (const id of playerIds) {
            const player = await this.findOne(id);
            if (player.tournamentsPlayed <= 0) {
                await this.playerRepository.delete(id);
            }
        }
    }

    async recalculateAll(): Promise<void> {
        const players = await this.playerRepository.find();
        const ids = players.map(p => p.id);
        await this.recalculateTotalPoints(ids);
    }

    // ==================== Player Club Stats Methods ====================

    async getOrCreatePlayerClubStats(playerId: string, clubId: string): Promise<PlayerClubStats> {
        if (!clubId) {
            return null; // No club stats for inter-club players
        }

        return this.tenant.runInContext(async (em) => {
            // Try to find existing stats
            let stats = await em.getRepository(PlayerClubStats).findOne({
                where: {
                    player: { id: playerId },
                    club: { id: clubId }
                },
                relations: ['player', 'club']
            });

            if (!stats) {
                // Create new stats
                stats = em.getRepository(PlayerClubStats).create({
                    player: { id: playerId } as Player,
                    club: { id: clubId } as any,
                    totalPoints: 0,
                    leaguePoints: 0,
                    tournamentPoints: 0,
                    matchesWon: 0,
                    matchesLost: 0,
                    gamesWon: 0,
                    gamesLost: 0,
                    tournamentsPlayed: 0,
                    leaguesPlayed: 0
                });
                stats = await em.getRepository(PlayerClubStats).save(stats);
            }

            return stats;
        });
    }

    async updatePlayerClubStats(
        playerId: string,
        clubId: string,
        updates: Partial<{
            totalPoints: number;
            leaguePoints: number;
            tournamentPoints: number;
            matchesWon: number;
            matchesLost: number;
            gamesWon: number;
            gamesLost: number;
            tournamentsPlayed: number;
            leaguesPlayed: number;
        }>
    ): Promise<PlayerClubStats> {
        const stats = await this.getOrCreatePlayerClubStats(playerId, clubId);

        if (!stats) {
            return null; // No club, nothing to update
        }

        // Apply incremental updates
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'number') {
                stats[key] += updates[key];
            }
        });

        return this.tenant.runInContext(async (em) => {
            return em.getRepository(PlayerClubStats).save(stats);
        });
    }

    async updatePlayerGlobalStats(
        playerId: string,
        updates: Partial<{
            totalPoints: number;
            leaguePoints: number;
            tournamentPoints: number;
            matchesWon: number;
        }>
    ): Promise<Player> {
        const player = await this.playerRepository.findOne({ where: { id: playerId } });

        if (!player) {
            throw new NotFoundException(`Player ${playerId} not found`);
        }

        // Apply incremental updates to global stats
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'number') {
                player[key] += updates[key];
            }
        });

        return this.playerRepository.save(player);
    }

    // ==================== Player Self-Service Profile ====================

    /**
     * Returns the full profile for the authenticated player, including:
     * - Player data (name, email, phone, identification, position, category, clubs)
     * - Verification status from the linked User
     * - Whether phone verification is available (any club has enablePhoneVerification)
     */
    async getFullProfile(playerId: string, userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        // If the user has no linked player, return a minimal profile from User data
        if (!playerId) {
            return {
                id: null,
                name: user?.email ?? '',
                email: user?.email ?? '',
                identification: null,
                phone: user?.phone ?? null,
                position: null,
                category: null,
                clubs: [],
                isEmailVerified: user?.isEmailVerified ?? false,
                isPhoneVerified: user?.isPhoneVerified ?? false,
                showPhone: false,
                noPlayer: true,
            };
        }

        const player = await this.playerRepository.findOne({
            where: { id: playerId },
            relations: ['category', 'clubs'],
        });
        if (!player) {
            throw new NotFoundException(`Jugador no encontrado.`);
        }

        // Check if ANY club the player belongs to has phone verification enabled
        let showPhone = false;
        if (player.clubs && player.clubs.length > 0) {
            const clubIds = player.clubs.map(c => c.id);
            const clubsWithPhone = await this.clubRepository
                .createQueryBuilder('club')
                .where('club.id IN (:...ids)', { ids: clubIds })
                .andWhere('club.enablePhoneVerification = true')
                .getCount();
            showPhone = clubsWithPhone > 0;
        }

        return {
            id: player.id,
            name: player.name,
            email: player.email,
            identification: player.identification,
            phone: player.phone,
            position: player.position,
            category: player.category ? { id: player.category.id, name: (player.category as any).name } : null,
            clubs: (player.clubs || []).map(c => ({ id: c.id, name: c.name })),
            isEmailVerified: user?.isEmailVerified ?? false,
            isPhoneVerified: user?.isPhoneVerified ?? false,
            showPhone,
            noPlayer: false,
        };
    }

    /**
     * Update the authenticated player's profile.
     * If email changes, reset email verification and send a new verification email.
     */
    async updateMyProfile(playerId: string, userId: string, dto: UpdatePlayerDto) {
        if (!playerId) {
            throw new BadRequestException('Tu cuenta no tiene un jugador asociado.');
        }

        const player = await this.playerRepository.findOne({
            where: { id: playerId },
            relations: ['clubs'],
        });
        if (!player) {
            throw new NotFoundException(`Jugador no encontrado.`);
        }

        const user = await this.userRepository.findOne({ where: { id: userId } });

        // Check if email is changing
        const emailChanged = dto.email !== undefined && dto.email !== player.email;

        // Apply simple field updates
        if (dto.name !== undefined) player.name = dto.name;
        if (dto.email !== undefined) player.email = dto.email;
        if (dto.identification !== undefined) player.identification = dto.identification;
        if (dto.phone !== undefined) player.phone = dto.phone;
        if (dto.position !== undefined) player.position = dto.position;
        if (dto.categoryId !== undefined) {
            player.category = dto.categoryId ? { id: dto.categoryId } as any : null;
        }
        if (dto.clubIds !== undefined) {
            player.clubs = dto.clubIds.length > 0
                ? dto.clubIds.map(id => ({ id } as any))
                : [];
        }

        await this.playerRepository.save(player);

        // If email changed, reset verification on User and send new verification email
        if (emailChanged && user) {
            const newToken = randomUUID();
            await this.userRepository.update(user.id, {
                email: dto.email,
                isEmailVerified: false,
                emailVerificationToken: newToken,
            });
            await this.emailService.sendVerificationEmail(dto.email, newToken);
        }

        return this.getFullProfile(playerId, userId);
    }

    /**
     * Resend email verification for the authenticated user.
     */
    async resendEmailVerification(userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('Usuario no encontrado.');
        if (user.isEmailVerified) return { message: 'Tu email ya está verificado.' };

        const newToken = randomUUID();
        await this.userRepository.update(user.id, { emailVerificationToken: newToken });
        await this.emailService.sendVerificationEmail(user.email, newToken);
        return { message: 'Se envió un nuevo correo de verificación.' };
    }

    /**
     * Send phone OTP via WhatsApp for the authenticated user.
     */
    async sendPhoneOtp(userId: string, phone: string) {
        // Find any club the user belongs to that has phone verification enabled, to get Twilio creds
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user || !user.playerId) throw new BadRequestException('Cuenta sin jugador asociado.');

        const player = await this.playerRepository.findOne({
            where: { id: user.playerId },
            relations: ['clubs'],
        });

        let clubId: string | undefined;
        let clubName: string | undefined;
        if (player?.clubs?.length) {
            const club = await this.clubRepository
                .createQueryBuilder('club')
                .where('club.id IN (:...ids)', { ids: player.clubs.map(c => c.id) })
                .andWhere('club.enablePhoneVerification = true')
                .getOne();
            if (club) {
                clubId = club.id;
                clubName = club.name;
            }
        }

        return this.phoneVerificationService.sendOtp(phone, clubName, clubId);
    }

    /**
     * Verify phone OTP and mark user as phone-verified.
     */
    async verifyPhone(userId: string, playerId: string, phone: string, code: string) {
        const result = await this.phoneVerificationService.verifyOtp(phone, code);
        if (result.verified) {
            // Mark user as phone-verified and update phone on both user and player
            await this.userRepository.update(userId, { phone, isPhoneVerified: true });
            if (playerId) {
                await this.playerRepository.update(playerId, { phone });
            }
        }
        return { verified: result.verified };
    }

    /**
     * Returns contact information (email, phone) for a player, along with
     * verification status from the linked user account (if any).
     * Only available to editors/admins.
     */
    async getContactStatus(playerId: string): Promise<{
        email: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isPhoneVerified: boolean;
    }> {
        const player = await this.playerRepository.findOne({ where: { id: playerId } });
        if (!player) {
            return { email: null, phone: null, isEmailVerified: false, isPhoneVerified: false };
        }

        // Find linked user account
        const user = await this.userRepository.findOne({ where: { playerId } });

        return {
            email: player.email ?? null,
            phone: (player as any).phone ?? null,
            isEmailVerified: user ? user.isEmailVerified : false,
            isPhoneVerified: user ? user.isPhoneVerified : false,
        };
    }
}

