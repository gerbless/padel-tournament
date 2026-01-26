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

    async recalculateStats(playerIds: string[]) {
        for (const playerId of new Set(playerIds)) {
            // 1. Get all teams for this player
            const player = await this.playerRepository.findOne({
                where: { id: playerId },
                relations: [
                    'teamsAsPlayer1', 'teamsAsPlayer1.matchesAsTeam1', 'teamsAsPlayer1.matchesAsTeam1.winner',
                    'teamsAsPlayer1.matchesAsTeam2', 'teamsAsPlayer1.matchesAsTeam2.winner',
                    'teamsAsPlayer2', 'teamsAsPlayer2.matchesAsTeam1', 'teamsAsPlayer2.matchesAsTeam1.winner',
                    'teamsAsPlayer2', 'teamsAsPlayer2.matchesAsTeam2', 'teamsAsPlayer2.matchesAsTeam2.winner'
                ]
            });

            if (!player) continue;

            let totalPoints = 0;
            let matchesWon = 0;
            const tournamentIds = new Set<string>();

            // Helper to process teams
            const processTeams = (teams: any[]) => {
                teams.forEach(team => {
                    if (team.tournamentId) {
                        tournamentIds.add(team.tournamentId);
                    }

                    // Process matches where team was Team 1
                    team.matchesAsTeam1?.forEach(match => {
                        if (match.status === 'completed') {
                            if (match.winner?.id === team.id) {
                                totalPoints += 3;
                                matchesWon++;
                            } else {
                                totalPoints += 1;
                            }
                        }
                    });

                    // Process matches where team was Team 2
                    team.matchesAsTeam2?.forEach(match => {
                        if (match.status === 'completed') {
                            if (match.winner?.id === team.id) {
                                totalPoints += 3;
                                matchesWon++;
                            } else {
                                totalPoints += 1;
                            }
                        }
                    });
                });
            };

            processTeams(player.teamsAsPlayer1 || []);
            processTeams(player.teamsAsPlayer2 || []);

            // Update Player
            player.totalPoints = totalPoints;
            player.matchesWon = matchesWon;
            player.tournamentsPlayed = tournamentIds.size;

            await this.playerRepository.save(player);
        }
    }

    async cleanupOrphanedPlayers(playerIds: string[]): Promise<void> {
        // First recalculate to ensure stats are accurate (e.g. tournamentsPlayed = 0)
        await this.recalculateStats(playerIds);

        for (const id of playerIds) {
            const player = await this.findOne(id);
            if (player.tournamentsPlayed <= 0) {
                await this.playerRepository.delete(id);
            }
        }
    }
}
