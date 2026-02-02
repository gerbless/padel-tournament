import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament, TournamentType, TournamentStatus } from './entities/tournament.entity';
import { Team } from '../teams/entities/team.entity';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { PlayersService } from '../players/players.service';

export interface Standing {
    teamId: string;
    player1Name: string;
    player2Name: string;
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    matchesDrawn: number;
    setsWon: number;
    setsLost: number;
    setDifference: number;
    gamesWon: number;
    gamesLost: number;
    gameDifference: number;
    position: number;
}

@Injectable()
export class TournamentsService {
    constructor(
        @InjectRepository(Tournament)
        private tournamentRepository: Repository<Tournament>,
        @InjectRepository(Team)
        private teamRepository: Repository<Team>,
        @InjectRepository(Match)
        private matchRepository: Repository<Match>,
        private playersService: PlayersService,
    ) { }

    async create(createTournamentDto: CreateTournamentDto): Promise<Tournament> {
        const { name, type, teams: teamsData } = createTournamentDto;

        // Validate team count
        const expectedTeamCount = type === TournamentType.CUADRANGULAR ? 4 : 6;
        if (teamsData.length !== expectedTeamCount) {
            throw new BadRequestException(
                `${type} tournament requires exactly ${expectedTeamCount} teams`
            );
        }

        // Create tournament
        const tournament = this.tournamentRepository.create({
            name,
            type,
            status: TournamentStatus.IN_PROGRESS,
            clubId: createTournamentDto.clubId || null, // Ensure null if undefined/empty
            config: createTournamentDto.config || { strictScoring: false, allowTies: true } // Default to flexible if not specified
        });

        let savedTournament: Tournament;
        try {
            savedTournament = await this.tournamentRepository.save(tournament);
        } catch (error) {
            console.error('Error saving tournament:', error);
            if (error.code === '23503') { // Foreign Key Violation
                throw new BadRequestException('El club seleccionado no es válido (ID no encontrado). Intente seleccionar el club nuevamente.');
            }
            throw error;
        }

        // Create teams
        const teams = await Promise.all(
            teamsData.map(async teamData => {
                // Ensure players exist (idempotent)
                const p1 = await this.playersService.findOrCreateByName(teamData.player1Name);
                const p2 = await this.playersService.findOrCreateByName(teamData.player2Name);

                return this.teamRepository.save({
                    player1: p1,
                    player2: p2,
                    tournamentId: savedTournament.id,
                });
            })
        );

        // Generate round-robin matches
        const matches = [];
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                matches.push({
                    tournamentId: savedTournament.id,
                    team1Id: teams[i].id,
                    team2Id: teams[j].id,
                    status: MatchStatus.PENDING,
                });
            }
        }

        await this.matchRepository.save(matches);

        return this.findOne(savedTournament.id);
    }

    async findAll(clubId?: string): Promise<Tournament[]> {
        const query: any = {
            relations: ['teams', 'teams.player1', 'teams.player2', 'matches'],
            order: { createdAt: 'DESC' as any },
        };

        if (clubId) {
            query.where = { clubId };
        }

        return this.tournamentRepository.find(query);
    }

    async findOne(id: string): Promise<Tournament> {
        const tournament = await this.tournamentRepository.findOne({
            where: { id },
            relations: [
                'teams',
                'teams.player1',
                'teams.player2',
                'matches',
                'matches.team1',
                'matches.team1.player1',
                'matches.team1.player2',
                'matches.team2',
                'matches.team2.player1',
                'matches.team2.player2',
                'matches.winner'
            ],
        });

        if (!tournament) {
            throw new NotFoundException(`Tournament with ID ${id} not found`);
        }

        return tournament;
    }

    async getStandings(tournamentId: string): Promise<Standing[]> {
        const tournament = await this.findOne(tournamentId);
        const teams = tournament.teams;
        const matches = tournament.matches.filter(m => m.status === MatchStatus.COMPLETED);

        // Initialize standings
        const standingsMap = new Map<string, Standing>();
        teams.forEach(team => {
            standingsMap.set(team.id, {
                teamId: team.id,
                player1Name: team.player1Name,
                player2Name: team.player2Name,
                matchesPlayed: 0,
                matchesWon: 0,
                matchesLost: 0,
                matchesDrawn: 0,
                setsWon: 0,
                setsLost: 0,
                setDifference: 0,
                gamesWon: 0,
                gamesLost: 0,
                gameDifference: 0,
                position: 0,
            });
        });

        // Calculate stats from matches
        matches.forEach(match => {
            if (!match.sets || match.sets.length === 0) return;

            const team1Stats = standingsMap.get(match.team1Id);
            const team2Stats = standingsMap.get(match.team2Id);

            let team1SetsWon = 0;
            let team2SetsWon = 0;
            let team1GamesTotal = 0;
            let team2GamesTotal = 0;

            match.sets.forEach(set => {
                const t1Games = parseInt(set.team1Games as any, 10) || 0;
                const t2Games = parseInt(set.team2Games as any, 10) || 0;

                if (t1Games > t2Games) {
                    team1SetsWon++;
                } else if (t2Games > t1Games) {
                    team2SetsWon++;
                }
                team1GamesTotal += t1Games;
                team2GamesTotal += t2Games;
            });

            team1Stats.setsWon += team1SetsWon;
            team1Stats.setsLost += team2SetsWon;
            team1Stats.gamesWon += team1GamesTotal;
            team1Stats.gamesLost += team2GamesTotal;

            team2Stats.setsWon += team2SetsWon;
            team2Stats.setsLost += team1SetsWon;
            team2Stats.gamesWon += team2GamesTotal;
            team2Stats.gamesLost += team1GamesTotal;

            team1Stats.matchesPlayed++;
            team2Stats.matchesPlayed++;

            if (match.winnerId === match.team1Id) {
                team1Stats.matchesWon++;
                team2Stats.matchesLost++;
            } else if (match.winnerId === match.team2Id) {
                team2Stats.matchesWon++;
                team1Stats.matchesLost++;
            } else if (match.winnerId === null && match.status === MatchStatus.COMPLETED) {
                team1Stats.matchesDrawn++;
                team2Stats.matchesDrawn++;
            }
        });

        // Calculate differences
        standingsMap.forEach(standing => {
            standing.setDifference = standing.setsWon - standing.setsLost;
            standing.gameDifference = standing.gamesWon - standing.gamesLost;
        });

        // Sort standings
        const standings = Array.from(standingsMap.values()).sort((a, b) => {
            // 1. Matches won (descending)
            if (b.matchesWon !== a.matchesWon) {
                return b.matchesWon - a.matchesWon;
            }
            // 2. Set difference (descending)
            if (b.setDifference !== a.setDifference) {
                return b.setDifference - a.setDifference;
            }
            // 3. Game difference (descending)
            if (b.gameDifference !== a.gameDifference) {
                return b.gameDifference - a.gameDifference;
            }
            // 4. Head-to-head (would need additional logic)
            return 0;
        });

        // Assign positions
        standings.forEach((standing, index) => {
            standing.position = index + 1;
        });

        return standings;
    }

    async remove(id: string): Promise<void> {
        const tournament = await this.findOne(id);

        if (tournament.status === TournamentStatus.COMPLETED) {
            throw new BadRequestException('Cannot delete a completed tournament');
        }

        // Collect involved players BEFORE deleting
        const playerIds = new Set<string>();
        tournament.teams.forEach(t => {
            playerIds.add(t.player1Id);
            playerIds.add(t.player2Id);
        });

        // 1. Delete tournament
        await this.tournamentRepository.remove(tournament);

        // 2. Recalculate stats for involved players & cleanup (since tournament is gone, stats will adjust downwards)
        await this.playersService.cleanupOrphanedPlayers(Array.from(playerIds));
    }

    async closeTournament(id: string): Promise<Tournament> {
        const tournament = await this.findOne(id);

        // Verify all matches have sets
        const allMatchesCompleted = tournament.matches.every(
            match => match.sets && match.sets.length > 0
        );

        if (!allMatchesCompleted) {
            throw new BadRequestException('Cannot close tournament: All matches must have at least one set played');
        }

        tournament.status = TournamentStatus.COMPLETED;
        const savedTournament = await this.tournamentRepository.save(tournament);

        // Collect all players to update their stats
        const playerIds = new Set<string>();
        savedTournament.teams.forEach(t => {
            playerIds.add(t.player1Id);
            playerIds.add(t.player2Id);
        });

        // Recalculate global stats
        await this.playersService.recalculateTotalPoints(Array.from(playerIds));

        return savedTournament;
    }
}
