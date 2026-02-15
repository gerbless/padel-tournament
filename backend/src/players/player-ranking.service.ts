import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Player } from './entities/player.entity';
import { PlayerClubStats } from './entities/player-club-stats.entity';

@Injectable()
export class PlayerRankingService {
    constructor(
        @InjectRepository(Player)
        private playerRepository: Repository<Player>,
        @InjectRepository(PlayerClubStats)
        private playerClubStatsRepository: Repository<PlayerClubStats>,
    ) { }

    private mapClubStatsToPlayers(stats: PlayerClubStats[]): Player[] {
        return stats.map(s => {
            const player = s.player;
            player.totalPoints = s.totalPoints;
            player.leaguePoints = s.leaguePoints;
            player.tournamentPoints = s.tournamentPoints;
            player.matchesWon = s.matchesWon;
            return player;
        });
    }

    async getRanking(categoryId?: string, clubId?: string): Promise<Player[]> {
        if (!clubId) {
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

        let statsQuery = this.playerClubStatsRepository.createQueryBuilder('stats')
            .leftJoinAndSelect('stats.player', 'player')
            .leftJoinAndSelect('player.category', 'category')
            .where('stats.club.id = :clubId', { clubId })
            .andWhere('stats.totalPoints > 0');

        if (categoryId) {
            statsQuery = statsQuery.andWhere('player.categoryId = :categoryId', { categoryId });
        }

        const stats = await statsQuery
            .orderBy('stats.totalPoints', 'DESC')
            .addOrderBy('stats.matchesWon', 'DESC')
            .getMany();

        return this.mapClubStatsToPlayers(stats);
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

        let statsQuery = this.playerClubStatsRepository.createQueryBuilder('stats')
            .leftJoinAndSelect('stats.player', 'player')
            .leftJoinAndSelect('player.category', 'category')
            .where('stats.club.id = :clubId', { clubId })
            .andWhere('stats.leaguePoints > 0');

        if (categoryId) {
            statsQuery = statsQuery.andWhere('player.categoryId = :categoryId', { categoryId });
        }

        const stats = await statsQuery
            .orderBy('stats.leaguePoints', 'DESC')
            .addOrderBy('stats.totalPoints', 'DESC')
            .addOrderBy('stats.matchesWon', 'DESC')
            .getMany();

        return this.mapClubStatsToPlayers(stats);
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

        let statsQuery = this.playerClubStatsRepository.createQueryBuilder('stats')
            .leftJoinAndSelect('stats.player', 'player')
            .leftJoinAndSelect('player.category', 'category')
            .where('stats.club.id = :clubId', { clubId })
            .andWhere('stats.tournamentPoints > 0');

        if (categoryId) {
            statsQuery = statsQuery.andWhere('player.categoryId = :categoryId', { categoryId });
        }

        const stats = await statsQuery
            .orderBy('stats.tournamentPoints', 'DESC')
            .addOrderBy('stats.totalPoints', 'DESC')
            .addOrderBy('stats.matchesWon', 'DESC')
            .getMany();

        return this.mapClubStatsToPlayers(stats);
    }

    async getPairRankings(type: 'global' | 'league' | 'tournament', categoryId?: string, clubId?: string): Promise<any[]> {
        let players: Player[];

        if (!clubId) {
            let query = this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category');

            if (categoryId) {
                query = query.where('player.categoryId = :categoryId', { categoryId });
            }

            players = await query.getMany();
        } else {
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

        if (players.length === 0) return [];

        const playerMap = new Map(players.map(p => [p.id, p]));
        const validPlayerIds = new Set(players.map(p => p.id));
        const pairMap = new Map<string, { p1: Player, p2: Player, points: number }>();

        const processTeams = (teams: any[], isTournament: boolean) => {
            teams.forEach(t => {
                if (!t.player1Id || !t.player2Id) return;
                if (t.player1Id === t.player2Id) return;
                if (!validPlayerIds.has(t.player1Id) || !validPlayerIds.has(t.player2Id)) return;

                const [id1, id2] = [t.player1Id, t.player2Id].sort();
                const key = `${id1}_${id2}`;

                if (!pairMap.has(key)) {
                    pairMap.set(key, { p1: playerMap.get(id1), p2: playerMap.get(id2), points: 0 });
                }

                const entry = pairMap.get(key);

                if (isTournament) {
                    let points = 0;
                    const checkMatch = (match: any, teamId: string) => {
                        if (match.status === 'completed') {
                            const config = t.tournament?.config || {};
                            const ptsWin = config.pointsForWin ?? 3;
                            const ptsTie = config.pointsForTie ?? 1;
                            const ptsLoss = config.pointsForLoss ?? 0;

                            if (match.winner?.id === teamId) points += ptsWin;
                            else if (!match.winner) points += ptsTie;
                            else points += ptsLoss;
                        }
                    };
                    t.matchesAsTeam1?.forEach(m => checkMatch(m, t.id));
                    t.matchesAsTeam2?.forEach(m => checkMatch(m, t.id));

                    if (type === 'global' || type === 'tournament') entry.points += points;
                } else {
                    if (type === 'global' || type === 'league') entry.points += (t.points || 0);
                }
            });
        };

        if (type === 'global' || type === 'tournament') {
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

            processTeams(await tournamentTeamsQuery.getMany(), true);
        }

        if (type === 'global' || type === 'league') {
            let leagueTeamsQuery = this.playerRepository.manager.getRepository('LeagueTeam')
                .createQueryBuilder('leagueTeam')
                .leftJoin('leagueTeam.league', 'league');

            if (clubId) {
                leagueTeamsQuery = leagueTeamsQuery.where('league.clubId = :clubId OR league.clubId IS NULL', { clubId });
            }

            processTeams(await leagueTeamsQuery.getMany(), false);
        }

        return Array.from(pairMap.values()).sort((a, b) => b.points - a.points);
    }

    async getGlobalTopPlayers(limit: number = 10): Promise<Player[]> {
        return this.playerRepository.find({
            relations: ['category'],
            where: { totalPoints: MoreThan(0) },
            order: { totalPoints: 'DESC', matchesWon: 'DESC' },
            take: limit
        });
    }
}
