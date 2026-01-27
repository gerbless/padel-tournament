import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayersService {
    constructor(
        @InjectRepository(Player)
        private playerRepository: Repository<Player>,
    ) { }

    async create(createPlayerDto: CreatePlayerDto): Promise<Player> {
        // Check if player exists
        const existing = await this.playerRepository.findOne({
            where: { name: createPlayerDto.name }
        });

        if (existing) {
            return existing; // Idempotent: return existing if found
        }

        const player = this.playerRepository.create({
            name: createPlayerDto.name,
            category: createPlayerDto.categoryId ? { id: createPlayerDto.categoryId } : undefined,
            position: createPlayerDto.position
        });
        return this.playerRepository.save(player);
    }

    async findOrCreateByName(name: string): Promise<Player> {
        return this.create({ name });
    }

    async findAll(): Promise<Player[]> {
        return this.playerRepository.find({
            relations: ['category'],
            order: { name: 'ASC' }
        });
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
        const player = await this.findOne(id);

        if (updatePlayerDto.categoryId !== undefined) {
            player.category = updatePlayerDto.categoryId ? { id: updatePlayerDto.categoryId } as any : null;
        }

        if (updatePlayerDto.position !== undefined) {
            player.position = updatePlayerDto.position;
        }

        return this.playerRepository.save(player);
    }

    async getRanking(categoryId?: string): Promise<Player[]> {
        const where: any = {};
        if (categoryId) where.category = { id: categoryId };

        return this.playerRepository.find({
            where,
            order: {
                totalPoints: 'DESC',
                matchesWon: 'DESC'
            }
        });
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
                    // Tournament Teams
                    'teamsAsPlayer1', 'teamsAsPlayer1.matchesAsTeam1', 'teamsAsPlayer1.matchesAsTeam1.winner',
                    'teamsAsPlayer1.matchesAsTeam2', 'teamsAsPlayer1.matchesAsTeam2.winner',
                    'teamsAsPlayer2', 'teamsAsPlayer2.matchesAsTeam1', 'teamsAsPlayer2.matchesAsTeam1.winner',
                    'teamsAsPlayer2', 'teamsAsPlayer2.matchesAsTeam2', 'teamsAsPlayer2.matchesAsTeam2.winner',
                    // League Teams
                    'leagueTeamsAsPlayer1',
                    'leagueTeamsAsPlayer2'
                ]
            });

            if (!player) continue;

            let totalPoints = 0;
            let leaguePoints = 0;
            let tournamentPoints = 0;
            let matchesWon = 0;
            const tournamentIds = new Set<string>();
            const leagueIds = new Set<string>();

            // 1. Process Tournaments (Legacy match-based points)
            const processTournamentTeams = (teams: any[]) => {
                teams.forEach(team => {
                    if (team.tournamentId) tournamentIds.add(team.tournamentId);

                    // Process matches where team was Team 1
                    team.matchesAsTeam1?.forEach(match => {
                        if (match.status === 'completed') {
                            if (match.winner?.id === team.id) {
                                tournamentPoints += 3;
                                matchesWon++;
                            } else {
                                tournamentPoints += 1;
                            }
                        }
                    });

                    // Process matches where team was Team 2
                    team.matchesAsTeam2?.forEach(match => {
                        if (match.status === 'completed') {
                            if (match.winner?.id === team.id) {
                                tournamentPoints += 3;
                                matchesWon++;
                            } else {
                                tournamentPoints += 1;
                            }
                        }
                    });
                });
            };

            processTournamentTeams(player.teamsAsPlayer1 || []);
            processTournamentTeams(player.teamsAsPlayer2 || []);

            // 2. Process Leagues (Sum pre-calculated league points)
            // League points are stored directly on the LeagueTeam entity
            const processLeagueTeams = (teams: any[]) => {
                teams.forEach(team => {
                    if (team.leagueId) leagueIds.add(team.leagueId);
                    leaguePoints += (team.points || 0);
                    matchesWon += (team.matchesWon || 0);
                });
            };

            processLeagueTeams(player.leagueTeamsAsPlayer1 || []);
            processLeagueTeams(player.leagueTeamsAsPlayer2 || []);

            // Update Player
            player.totalPoints = tournamentPoints + leaguePoints;
            player.tournamentPoints = tournamentPoints;
            player.leaguePoints = leaguePoints;
            player.matchesWon = matchesWon;
            player.tournamentsPlayed = tournamentIds.size;
            player.leaguesPlayed = leagueIds.size;

            await this.playerRepository.save(player);
        }
    }

    async getLeagueRanking(categoryId?: string): Promise<Player[]> {
        const where: any = {};
        if (categoryId) where.category = { id: categoryId };

        return this.playerRepository.find({
            where,
            order: {
                leaguePoints: 'DESC',
                totalPoints: 'DESC',
                matchesWon: 'DESC'
            }
        });
    }

    async getTournamentRanking(categoryId?: string): Promise<Player[]> {
        const where: any = {};
        if (categoryId) where.category = { id: categoryId };

        return this.playerRepository.find({
            where,
            order: {
                tournamentPoints: 'DESC',
                totalPoints: 'DESC',
                matchesWon: 'DESC'
            }
        });
    }

    async getPairRankings(type: 'global' | 'league' | 'tournament', categoryId?: string): Promise<any[]> {
        // 1. Fetch all players (filtered by Category if needed, for optimization)
        const where: any = {};
        if (categoryId) where.category = { id: categoryId };

        const players = await this.playerRepository.find({ where, relations: ['category'] });

        // If no players found for category, return empty
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
                    const checkMatch = (match: any, teamId: string) => {
                        if (match.status === 'completed') {
                            points += (match.winner?.id === teamId) ? 3 : 1;
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
            const tournamentTeams = await this.playerRepository.manager.getRepository('Team').find({
                relations: ['matchesAsTeam1', 'matchesAsTeam1.winner', 'matchesAsTeam2', 'matchesAsTeam2.winner']
            });
            processTeams(tournamentTeams, true);
        }

        if (type === 'global' || type === 'league') {
            const leagueTeams = await this.playerRepository.manager.getRepository('LeagueTeam').find();
            processTeams(leagueTeams, false);
        }

        // 3. Convert Map to Array and Sort
        return Array.from(pairMap.values())
            .sort((a, b) => b.points - a.points);
    }

    async getRecommendedMatches(): Promise<any[]> {
        // 1. Get Global Pair Rankings
        const rankings = await this.getPairRankings('global');
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

    async getAllPartnerRecommendations(): Promise<any[]> {
        // Get all players with category and position
        const allPlayers = await this.playerRepository.find({
            relations: ['category']
        });

        // Filter players that have both category and position
        const eligiblePlayers = allPlayers.filter(p => p.category && p.position);

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
}
