import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';

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

        const player = this.playerRepository.create(createPlayerDto);
        return this.playerRepository.save(player);
    }

    async findOrCreateByName(name: string): Promise<Player> {
        return this.create({ name });
    }

    async findAll(): Promise<Player[]> {
        return this.playerRepository.find({
            order: { name: 'ASC' }
        });
    }

    async findOne(id: string): Promise<Player> {
        const player = await this.playerRepository.findOne({ where: { id } });
        if (!player) {
            throw new NotFoundException(`Player with ID ${id} not found`);
        }
        return player;
    }

    async getRanking(): Promise<Player[]> {
        return this.playerRepository.find({
            order: {
                totalPoints: 'DESC',
                matchesWon: 'DESC',
                gamesWon: 'DESC'
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

    async processTournamentResults(tournament: any): Promise<void> {
        // Iterate through all matches to calculate points
        // Win = 3 points, Loss = 1 point
        // Tournament Played = +1

        const playerStats = new Map<string, { points: number, matchesWon: number, matchesPlayed: number }>();

        // Initialize players from teams
        tournament.teams.forEach(team => {
            [team.player1Id, team.player2Id].forEach(pid => {
                if (!playerStats.has(pid)) {
                    playerStats.set(pid, { points: 0, matchesWon: 0, matchesPlayed: 0 });
                }
            });
        });

        // Calculate match points
        tournament.matches.forEach(match => {
            if (match.status !== 'completed' || !match.winnerId) return;

            const winnerTeam = match.winnerId === match.team1Id ? match.team1 : match.team2;
            const loserTeam = match.winnerId === match.team1Id ? match.team2 : match.team1;

            // Winner points (+3)
            [winnerTeam.player1Id, winnerTeam.player2Id].forEach(pid => {
                const stats = playerStats.get(pid);
                if (stats) {
                    stats.points += 3;
                    stats.matchesWon += 1;
                    stats.matchesPlayed += 1;
                }
            });

            // Loser points (+1)
            [loserTeam.player1Id, loserTeam.player2Id].forEach(pid => {
                const stats = playerStats.get(pid);
                if (stats) {
                    stats.points += 1;
                    stats.matchesPlayed += 1;
                }
            });
        });

        // Update database
        for (const [playerId, stats] of playerStats.entries()) {
            const player = await this.findOne(playerId);
            player.totalPoints += stats.points;
            player.matchesWon += stats.matchesWon;
            player.tournamentsPlayed += 1;
            // Note: gamesWon is not calculated here for simplicity, but could be added

            await this.playerRepository.save(player);
        }
    }
}
