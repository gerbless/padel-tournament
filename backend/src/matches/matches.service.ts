import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus, SetResult } from './entities/match.entity';
import { UpdateMatchScoreDto } from './dto/update-match-score.dto';

@Injectable()
export class MatchesService {
    constructor(
        @InjectRepository(Match)
        private matchRepository: Repository<Match>,
    ) { }

    async findOne(id: string): Promise<Match> {
        const match = await this.matchRepository.findOne({
            where: { id },
            relations: ['team1', 'team2', 'winner', 'tournament'],
        });

        if (!match) {
            throw new NotFoundException(`Match with ID ${id} not found`);
        }

        return match;
    }

    async updateScore(id: string, updateMatchScoreDto: UpdateMatchScoreDto): Promise<Match> {
        const match = await this.matchRepository.findOne({
            where: { id },
            relations: ['team1', 'team2', 'winner', 'tournament'],
        });

        if (!match) {
            throw new NotFoundException(`Match with ID ${id} not found`);
        }

        if (match.tournament && match.tournament.status === 'completed') {
            throw new BadRequestException('Cannot update match result for a completed tournament');
        }

        const { sets } = updateMatchScoreDto;

        // Validate sets
        this.validateSets(sets);

        // Calculate winner
        const winnerId = this.calculateMatchWinner(sets, match.team1Id, match.team2Id);

        // Update match using direct update to avoid relation conflicts with save()
        await this.matchRepository.update(id, {
            sets: sets,
            winnerId: winnerId,
            status: MatchStatus.COMPLETED
        });

        console.log(`[DEBUG] Updated match ${id} with winner ${winnerId}`);

        return this.findOne(id);
    }

    private validateSets(sets: SetResult[]): void {
        if (sets.length === 0 || sets.length > 3) {
            throw new BadRequestException('A match must have 1 to 3 sets');
        }

        sets.forEach((set, index) => {
            const { team1Games, team2Games, tiebreak } = set;

            // Check minimum games
            if (team1Games < 0 || team2Games < 0) {
                throw new BadRequestException(`Set ${index + 1}: Games cannot be negative`);
            }

            // Normal set: must win by 2, minimum 6 games
            const maxGames = Math.max(team1Games, team2Games);
            const minGames = Math.min(team1Games, team2Games);
            const diff = maxGames - minGames;

            // Check for tie-break scenario (6-6 -> 7-6 or higher)
            if (team1Games === 6 && team2Games === 6) {
                throw new BadRequestException(
                    `Set ${index + 1}: At 6-6, must play a tie-break (enter 7-6 or 6-7 with tiebreak score)`
                );
            }

            // Tie-break set (7-6 or 6-7)
            if ((team1Games === 7 && team2Games === 6) || (team1Games === 6 && team2Games === 7)) {
                if (!tiebreak) {
                    throw new BadRequestException(`Set ${index + 1}: Tie-break score required for 7-6 or 6-7 result`);
                }
                if (tiebreak.team1Points < 0 || tiebreak.team2Points < 0) {
                    throw new BadRequestException(`Set ${index + 1}: Tie-break points cannot be negative`);
                }
                const maxPoints = Math.max(tiebreak.team1Points, tiebreak.team2Points);
                const minPoints = Math.min(tiebreak.team1Points, tiebreak.team2Points);
                if (maxPoints < 7 || maxPoints - minPoints < 2) {
                    throw new BadRequestException(
                        `Set ${index + 1}: Tie-break must reach at least 7 points with 2-point difference`
                    );
                }
            } else {
                // Normal set validation
                if (maxGames < 6) {
                    throw new BadRequestException(`Set ${index + 1}: Winner must have at least 6 games`);
                }
                if (maxGames === 6 && diff < 2) {
                    throw new BadRequestException(`Set ${index + 1}: Must win by at least 2 games at 6`);
                }
                if (maxGames > 6 && diff !== 2) {
                    throw new BadRequestException(`Set ${index + 1}: Must win by exactly 2 games when going beyond 6`);
                }
            }
        });
    }

    private calculateMatchWinner(sets: SetResult[], team1Id: string, team2Id: string): string {
        let team1SetsWon = 0;
        let team2SetsWon = 0;

        sets.forEach(set => {
            if (set.team1Games > set.team2Games) {
                team1SetsWon++;
            } else {
                team2SetsWon++;
            }
        });

        if (team1SetsWon > team2SetsWon) {
            return team1Id;
        } else if (team2SetsWon > team1SetsWon) {
            return team2Id;
        }

        throw new BadRequestException('Cannot determine match winner from provided sets');
    }
}
