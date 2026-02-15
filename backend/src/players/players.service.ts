import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { PlayerClubStats } from './entities/player-club-stats.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';
import { PlayerRankingService } from './player-ranking.service';
import { PlayerRecommendationService } from './player-recommendation.service';

@Injectable()
export class PlayersService {
    constructor(
        @InjectRepository(Player)
        private playerRepository: Repository<Player>,
        @InjectRepository(PlayerClubStats)
        private playerClubStatsRepository: Repository<PlayerClubStats>,
        private rankingService: PlayerRankingService,
        private recommendationService: PlayerRecommendationService,
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
            category: createPlayerDto.categoryId ? { id: createPlayerDto.categoryId } : undefined,
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

    async findAll(clubId?: string, pagination?: PaginationQueryDto): Promise<PaginatedResult<Player> | Player[]> {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        const skip = (page - 1) * limit;

        if (!clubId) {
            const [data, total] = await this.playerRepository.findAndCount({
                relations: ['category', 'clubs'],
                order: { name: 'ASC' },
                skip,
                take: limit,
            });
            return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
        }

        // When filtering by club:
        // 1. Get players explicitly assigned to this club
        // 2. Get players with NO club assignments (they belong to all clubs)
        const playersInClub = await this.playerRepository.createQueryBuilder('player')
            .leftJoinAndSelect('player.category', 'category')
            .leftJoinAndSelect('player.clubs', 'club')
            .where('club.id = :clubId', { clubId })
            .orderBy('player.name', 'ASC')
            .getMany();

        const playersWithoutClubs = await this.playerRepository.createQueryBuilder('player')
            .leftJoinAndSelect('player.category', 'category')
            .leftJoinAndSelect('player.clubs', 'club')
            .where('club.id IS NULL')
            .orderBy('player.name', 'ASC')
            .getMany();

        // Combine and deduplicate
        const playerMap = new Map();
        [...playersInClub, ...playersWithoutClubs].forEach(p => playerMap.set(p.id, p));
        const all = Array.from(playerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        const total = all.length;
        const paginated = all.slice(skip, skip + limit);
        return { data: paginated, total, page, limit, totalPages: Math.ceil(total / limit) };
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

    async update(id: string, updatePlayerDto: UpdatePlayerDto): Promise<Player> {
        const player = await this.playerRepository.findOne({
            where: { id },
            relations: ['category', 'clubs']
        });

        if (!player) {
            throw new NotFoundException(`Player with ID ${id} not found`);
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

        // Check if player is part of any team (using counts)
        const teamCount1 = await this.playerRepository.createQueryBuilder('player')
            .leftJoin('player.teamsAsPlayer1', 'team')
            .where('player.id = :id', { id })
            .andWhere('team.id IS NOT NULL')
            .getCount();

        const teamCount2 = await this.playerRepository.createQueryBuilder('player')
            .leftJoin('player.teamsAsPlayer2', 'team')
            .where('player.id = :id', { id })
            .andWhere('team.id IS NOT NULL')
            .getCount();

        if (player.tournamentsPlayed > 0 || teamCount1 > 0 || teamCount2 > 0) {
            throw new ConflictException('No se puede eliminar el jugador porque tiene torneos jugados');
        }

        await this.playerRepository.delete(id);
    }

    async recalculateTotalPoints(playerIds: string[]) {
        const uniqueIds = [...new Set(playerIds)];
        if (uniqueIds.length === 0) return;

        // Single query: load ALL players with ALL relations at once (eliminates N+1)
        const players = await this.playerRepository.createQueryBuilder('player')
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

            // Calculate total points for each club
            statsByClub.forEach(stats => {
                stats.totalPoints = stats.tournamentPoints + stats.leaguePoints;
                stats.tournamentsPlayed = stats.tournamentIds.size;
                stats.leaguesPlayed = stats.leagueIds.size;
            });

            // Update global player stats
            globalTotalPoints = globalTournamentPoints + globalLeaguePoints;
            player.totalPoints = globalTotalPoints;
            player.tournamentPoints = globalTournamentPoints;
            player.leaguePoints = globalLeaguePoints;
            player.matchesWon = globalMatchesWon;
            player.tournamentsPlayed = globalTournamentIds.size;
            player.leaguesPlayed = globalLeagueIds.size;

            await this.playerRepository.save(player);

            // Update PlayerClubStats for each club
            for (const [key, stats] of statsByClub.entries()) {
                if (key === 'NO_CLUB' || !stats.clubId) {
                    // Skip inter-club stats (they use global Player stats)
                    continue;
                }

                const clubStats = await this.getOrCreatePlayerClubStats(player.id, stats.clubId);
                if (clubStats) {
                    clubStats.totalPoints = stats.totalPoints;
                    clubStats.leaguePoints = stats.leaguePoints;
                    clubStats.tournamentPoints = stats.tournamentPoints;
                    clubStats.matchesWon = stats.matchesWon;
                    clubStats.matchesLost = stats.matchesLost;
                    clubStats.tournamentsPlayed = stats.tournamentsPlayed;
                    clubStats.leaguesPlayed = stats.leaguesPlayed;

                    await this.playerClubStatsRepository.save(clubStats);
                }
            }
        }
    }

    async getLeagueRanking(categoryId?: string, clubId?: string): Promise<Player[]> {
        return this.rankingService.getLeagueRanking(categoryId, clubId);
    }

    async getTournamentRanking(categoryId?: string, clubId?: string): Promise<Player[]> {
        return this.rankingService.getTournamentRanking(categoryId, clubId);
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

        // Try to find existing stats
        let stats = await this.playerClubStatsRepository.findOne({
            where: {
                player: { id: playerId },
                club: { id: clubId }
            },
            relations: ['player', 'club']
        });

        if (!stats) {
            // Create new stats
            stats = this.playerClubStatsRepository.create({
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
            stats = await this.playerClubStatsRepository.save(stats);
        }

        return stats;
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

        return this.playerClubStatsRepository.save(stats);
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
}

