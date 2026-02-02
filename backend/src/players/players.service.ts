import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Player } from './entities/player.entity';
import { PlayerClubStats } from './entities/player-club-stats.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayersService {
    constructor(
        @InjectRepository(Player)
        private playerRepository: Repository<Player>,
        @InjectRepository(PlayerClubStats)
        private playerClubStatsRepository: Repository<PlayerClubStats>,
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

    async findAll(clubId?: string): Promise<Player[]> {
        if (!clubId) {
            // Return all players with their club associations
            return this.playerRepository.find({
                relations: ['category', 'clubs'],
                order: { name: 'ASC' }
            });
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
        return Array.from(playerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
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
        console.log('[PlayersService.getRanking] Called with categoryId:', categoryId, 'clubId:', clubId);

        if (!clubId) {
            // No club filter: return all players sorted by global points
            let query = this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category');

            if (categoryId) {
                query = query.where('player.categoryId = :categoryId', { categoryId });
            }

            return query
                .orderBy('player.totalPoints', 'DESC')
                .addOrderBy('player.matchesWon', 'DESC')
                .getMany();
        }

        // With club filter: get stats from PlayerClubStats
        let statsQuery = this.playerClubStatsRepository.createQueryBuilder('stats')
            .leftJoinAndSelect('stats.player', 'player')
            .leftJoinAndSelect('player.category', 'category')
            .where('stats.club.id = :clubId', { clubId });

        if (categoryId) {
            statsQuery = statsQuery.andWhere('player.categoryId = :categoryId', { categoryId });
        }

        // Only show players with points in this club
        statsQuery = statsQuery.andWhere('stats.totalPoints > 0');

        const stats = await statsQuery
            .orderBy('stats.totalPoints', 'DESC')
            .addOrderBy('stats.matchesWon', 'DESC')
            .getMany();

        // Map to players with club-specific stats
        const players = stats.map(s => {
            const player = s.player;
            // Override with club-specific stats
            player.totalPoints = s.totalPoints;
            player.leaguePoints = s.leaguePoints;
            player.tournamentPoints = s.tournamentPoints;
            player.matchesWon = s.matchesWon;
            return player;
        });

        return players;
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
        for (const playerId of new Set(playerIds)) {
            const player = await this.playerRepository.findOne({
                where: { id: playerId },
                relations: [
                    'teamsAsPlayer1', 'teamsAsPlayer1.tournament',
                    'teamsAsPlayer1.matchesAsTeam1', 'teamsAsPlayer1.matchesAsTeam1.winner',
                    'teamsAsPlayer1.matchesAsTeam2', 'teamsAsPlayer1.matchesAsTeam2.winner',
                    'teamsAsPlayer2', 'teamsAsPlayer2.tournament',
                    'teamsAsPlayer2.matchesAsTeam1', 'teamsAsPlayer2.matchesAsTeam1.winner',
                    'teamsAsPlayer2.matchesAsTeam2', 'teamsAsPlayer2.matchesAsTeam2.winner',
                    'leagueTeamsAsPlayer1', 'leagueTeamsAsPlayer1.league',
                    'leagueTeamsAsPlayer2', 'leagueTeamsAsPlayer2.league',
                    'clubs'
                ]
            });

            if (!player) continue;

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

                const clubStats = await this.getOrCreatePlayerClubStats(playerId, stats.clubId);
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
        if (!clubId) {
            let query = this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category');

            if (categoryId) {
                query = query.where('player.categoryId = :categoryId', { categoryId });
            }

            return query
                .orderBy('player.leaguePoints', 'DESC')
                .addOrderBy('player.totalPoints', 'DESC')
                .addOrderBy('player.matchesWon', 'DESC')
                .getMany();
        }

        // With club filter: query PlayerClubStats
        let statsQuery = this.playerClubStatsRepository.createQueryBuilder('stats')
            .leftJoinAndSelect('stats.player', 'player')
            .leftJoinAndSelect('player.category', 'category')
            .where('stats.club.id = :clubId', { clubId })
            .andWhere('stats.leaguePoints > 0'); // Filter active in leagues

        if (categoryId) {
            statsQuery = statsQuery.andWhere('player.categoryId = :categoryId', { categoryId });
        }

        const stats = await statsQuery
            .orderBy('stats.leaguePoints', 'DESC')
            .addOrderBy('stats.totalPoints', 'DESC')
            .addOrderBy('stats.matchesWon', 'DESC')
            .getMany();

        // Map to players with club-specific stats
        return stats.map(s => {
            const player = s.player;
            player.totalPoints = s.totalPoints;
            player.leaguePoints = s.leaguePoints;
            player.tournamentPoints = s.tournamentPoints;
            player.matchesWon = s.matchesWon;
            return player;
        });
    }

    async getTournamentRanking(categoryId?: string, clubId?: string): Promise<Player[]> {
        if (!clubId) {
            let query = this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category');

            if (categoryId) {
                query = query.where('player.categoryId = :categoryId', { categoryId });
            }

            return query
                .orderBy('player.tournamentPoints', 'DESC')
                .addOrderBy('player.totalPoints', 'DESC')
                .addOrderBy('player.matchesWon', 'DESC')
                .getMany();
        }

        // With club filter: query PlayerClubStats
        let statsQuery = this.playerClubStatsRepository.createQueryBuilder('stats')
            .leftJoinAndSelect('stats.player', 'player')
            .leftJoinAndSelect('player.category', 'category')
            .where('stats.club.id = :clubId', { clubId })
            .andWhere('stats.tournamentPoints > 0'); // Filter active in tournaments

        if (categoryId) {
            statsQuery = statsQuery.andWhere('player.categoryId = :categoryId', { categoryId });
        }

        const stats = await statsQuery
            .orderBy('stats.tournamentPoints', 'DESC')
            .addOrderBy('stats.totalPoints', 'DESC')
            .addOrderBy('stats.matchesWon', 'DESC')
            .getMany();

        // Map to players with club-specific stats
        return stats.map(s => {
            const player = s.player;
            player.totalPoints = s.totalPoints;
            player.leaguePoints = s.leaguePoints;
            player.tournamentPoints = s.tournamentPoints;
            player.matchesWon = s.matchesWon;
            return player;
        });
    }

    async getPairRankings(type: 'global' | 'league' | 'tournament', categoryId?: string, clubId?: string): Promise<any[]> {
        // 1. Fetch all players (filtered by Category and Club if needed)
        let players: Player[];

        if (!clubId) {
            let query = this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category');

            if (categoryId) {
                query = query.where('player.categoryId = :categoryId', { categoryId });
            }

            players = await query.getMany();
        } else {
            // Get players in club OR without clubs
            let baseQuery = this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category')
                .leftJoinAndSelect('player.clubs', 'club');

            if (categoryId) {
                baseQuery = baseQuery.where('player.categoryId = :categoryId', { categoryId });
            }

            const playersInClub = await baseQuery
                .andWhere('club.id = :clubId', { clubId })
                .getMany();

            let noClubQuery = this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category')
                .leftJoin('player.clubs', 'club')
                .where('club.id IS NULL');

            if (categoryId) {
                noClubQuery = noClubQuery.andWhere('player.categoryId = :categoryId', { categoryId });
            }

            const playersWithoutClubs = await noClubQuery.getMany();

            const playerMap = new Map();
            [...playersInClub, ...playersWithoutClubs].forEach(p => playerMap.set(p.id, p));
            players = Array.from(playerMap.values());
        }

        // If no players found for category/club, return empty
        if (players.length === 0) return [];

        const playerMap = new Map(players.map(p => [p.id, p]));
        const validPlayerIds = new Set(players.map(p => p.id));

        const pairMap = new Map<string, { p1: Player, p2: Player, points: number }>();

        // Helper to process teams
        const processTeams = (teams: any[], isTournament: boolean) => {
            teams.forEach(t => {
                if (!t.player1Id || !t.player2Id) return;

                // RESTRICTION: Player cannot form a pair with themselves
                if (t.player1Id === t.player2Id) return;

                // FILTER: Both players must be in the valid list (i.e., match the category)
                // The user said "todo debe ser segmentado". Usually pairs are in same category.
                // If one is not, maybe exclude? Or include if at least one?
                // Strict segment: Both must be in category.
                if (!validPlayerIds.has(t.player1Id) || !validPlayerIds.has(t.player2Id)) {
                    return;
                }

                // Create unique key for the pair (sorted IDs)
                const [id1, id2] = [t.player1Id, t.player2Id].sort();
                const key = `${id1}_${id2}`;

                if (!pairMap.has(key)) {
                    pairMap.set(key, {
                        p1: playerMap.get(id1),
                        p2: playerMap.get(id2),
                        points: 0
                    });
                }

                const entry = pairMap.get(key);

                if (isTournament) {
                    // For tournaments, calculate points from matches
                    let points = 0;
                    // Logic from recalculateTotalPoints
                    // Logic from recalculateTotalPoints
                    const checkMatch = (match: any, teamId: string) => {
                        if (match.status === 'completed') {
                            const config = t.tournament?.config || {};
                            const ptsWin = config.pointsForWin ?? 3;
                            const ptsTie = config.pointsForTie ?? 1;
                            const ptsLoss = config.pointsForLoss ?? 0;

                            if (match.winner?.id === teamId) {
                                points += ptsWin;
                            } else if (!match.winner) {
                                points += ptsTie;
                            } else {
                                points += ptsLoss;
                            }
                        }
                    };
                    t.matchesAsTeam1?.forEach(m => checkMatch(m, t.id));
                    t.matchesAsTeam2?.forEach(m => checkMatch(m, t.id));

                    if (type === 'global' || type === 'tournament') {
                        entry.points += points;
                    }
                } else {
                    // For leagues, take stored points
                    if (type === 'global' || type === 'league') {
                        entry.points += (t.points || 0);
                    }
                }
            });
        };

        // 2. Fetch Data based on type (optimized to fetch relations only needed)
        // We'll fetch everything for simplicity in first iteration, similar to recalculate logic
        // But better to use QueryBuilder for performance if dataset grows. 
        // For now, reuse repository fetches.
        // NOTE: We fetch ALL teams, but filter inside processTeams using validPlayerIds

        if (type === 'global' || type === 'tournament') {
            // Fetch tournament teams, filtered by tournament's clubId if applicable
            let tournamentTeamsQuery = this.playerRepository.manager.getRepository('Team')
                .createQueryBuilder('team')
                .leftJoinAndSelect('team.matchesAsTeam1', 'matchesAsTeam1')
                .leftJoinAndSelect('matchesAsTeam1.winner', 'winner1')
                .leftJoinAndSelect('team.matchesAsTeam2', 'matchesAsTeam2')
                .leftJoinAndSelect('matchesAsTeam2.winner', 'winner2')
                .leftJoin('team.tournament', 'tournament');

            if (clubId) {
                tournamentTeamsQuery = tournamentTeamsQuery.where('tournament.clubId = :clubId OR tournament.clubId IS NULL', { clubId });
            }

            const tournamentTeams = await tournamentTeamsQuery.getMany();
            processTeams(tournamentTeams, true);
        }

        if (type === 'global' || type === 'league') {
            // Fetch league teams, filtered by league's clubId if applicable
            let leagueTeamsQuery = this.playerRepository.manager.getRepository('LeagueTeam')
                .createQueryBuilder('leagueTeam')
                .leftJoin('leagueTeam.league', 'league');

            if (clubId) {
                leagueTeamsQuery = leagueTeamsQuery.where('league.clubId = :clubId OR league.clubId IS NULL', { clubId });
            }

            const leagueTeams = await leagueTeamsQuery.getMany();
            processTeams(leagueTeams, false);
        }

        // 3. Convert Map to Array and Sort
        return Array.from(pairMap.values())
            .sort((a, b) => b.points - a.points);
    }

    async getRecommendedMatches(clubId?: string): Promise<any[]> {
        // 1. Get Global Pair Rankings filtered by club
        const rankings = await this.getPairRankings('global', undefined, clubId);
        const recommendations = [];

        // 2. iterate to find balanced matches
        for (let i = 0; i < rankings.length - 1; i++) {
            const pairA = rankings[i];

            // Look at the next few pairs (e.g., next 3) to find a valid opponent
            for (let j = i + 1; j < Math.min(i + 4, rankings.length); j++) {
                const pairB = rankings[j];

                // Check for player intersection
                const playersA = [pairA.p1.id, pairA.p2.id];
                const playersB = [pairB.p1.id, pairB.p2.id];
                const intersection = playersA.filter(id => playersB.includes(id));

                if (intersection.length === 0) {
                    // Valid Matchup
                    const pointDiff = Math.abs(pairA.points - pairB.points);

                    recommendations.push({
                        pair1: pairA,
                        pair2: pairB,
                        pointDiff: pointDiff
                    });

                    // Break inner loop to avoid recommending the same pair multiple times too aggressively
                    // (Optional: keep strictly one recommendation per "lead" pair)
                    break;
                }
            }
        }

        // Return top 5 most balanced matches based on point difference (or just top 5 high-level matches)
        // Here we prioritize high-ranking matches that are balanced
        return recommendations.slice(0, 5);
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

    async getAllPartnerRecommendations(clubId?: string): Promise<any[]> {
        // Get all players with category and position, filtered by club if provided
        let eligiblePlayers: Player[];

        if (!clubId) {
            eligiblePlayers = await this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category')
                .where('player.position IS NOT NULL')
                .andWhere('player.categoryId IS NOT NULL')
                .getMany();
        } else {
            // Get players in club OR without clubs
            const playersInClub = await this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category')
                .innerJoin('player.clubs', 'club')
                .where('player.position IS NOT NULL')
                .andWhere('player.categoryId IS NOT NULL')
                .andWhere('club.id = :clubId', { clubId })
                .getMany();

            const playersWithoutClubs = await this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category')
                .leftJoin('player.clubs', 'club')
                .where('player.position IS NOT NULL')
                .andWhere('player.categoryId IS NOT NULL')
                .andWhere('club.id IS NULL')
                .getMany();

            const playerMap = new Map();
            [...playersInClub, ...playersWithoutClubs].forEach(p => playerMap.set(p.id, p));
            eligiblePlayers = Array.from(playerMap.values());
        }

        // Helper function to check position compatibility
        const isPositionCompatible = (pos1: string, pos2: string): boolean => {
            if (pos1 === 'mixto' || pos2 === 'mixto') return true;
            if (pos1 === 'reves' && pos2 === 'drive') return true;
            if (pos1 === 'drive' && pos2 === 'reves') return true;
            return false;
        };

        const recommendations = [];

        // For each player, find compatible partners
        for (let i = 0; i < eligiblePlayers.length; i++) {
            const player1 = eligiblePlayers[i];

            for (let j = i + 1; j < eligiblePlayers.length; j++) {
                const player2 = eligiblePlayers[j];

                // Safety check: ensure not the same player
                if (player1.id === player2.id) continue;

                // Check if they are in the same category and have compatible positions
                if (player1.category.id === player2.category.id &&
                    isPositionCompatible(player1.position, player2.position)) {

                    const pointDiff = Math.abs(player1.totalPoints - player2.totalPoints);
                    const avgPoints = Math.round((player1.totalPoints + player2.totalPoints) / 2);

                    recommendations.push({
                        player1: {
                            id: player1.id,
                            name: player1.name,
                            position: player1.position,
                            totalPoints: player1.totalPoints
                        },
                        player2: {
                            id: player2.id,
                            name: player2.name,
                            position: player2.position,
                            totalPoints: player2.totalPoints
                        },
                        category: player1.category.name,
                        pointDifference: pointDiff,
                        averagePoints: avgPoints,
                        compatibility: 100 - Math.min(pointDiff, 100)
                    });
                }
            }
        }

        // Sort by compatibility (highest first) and return top 10
        recommendations.sort((a, b) => b.compatibility - a.compatibility);
        return recommendations.slice(0, 10);
    }

    async getGlobalTopPlayers(limit: number = 10): Promise<Player[]> {
        // Get top players across all clubs (aggregated stats)
        // Only return players who have actually played (totalPoints > 0)
        return this.playerRepository.find({
            relations: ['category'],
            where: {
                totalPoints: MoreThan(0)
            },
            order: {
                totalPoints: 'DESC',
                matchesWon: 'DESC'
            },
            take: limit
        });
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

