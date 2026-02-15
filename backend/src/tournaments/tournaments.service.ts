import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tournament, TournamentType, TournamentStatus, DurationMode } from './entities/tournament.entity';
import { Team } from '../teams/entities/team.entity';
import { Match, MatchStatus, MatchPhase } from '../matches/entities/match.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { PlayersService } from '../players/players.service';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';

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
    points: number;
    groupNumber?: number;
}

/**
 * Round-robin scheduling using the "circle method" (polygon algorithm).
 * For N teams (N must be even): generates N-1 rounds of N/2 matches.
 * For N teams (N odd): adds a "bye" team, generating N rounds of (N-1)/2 matches + 1 bye.
 * Only returns the actual pairings (skipping bye matches).
 */
function generateRoundRobinSchedule(teamCount: number): { round: number; pairings: { t1: number; t2: number }[] }[] {
    const rounds: { round: number; pairings: { t1: number; t2: number }[] }[] = [];
    // If odd, add a phantom team for byes
    const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;

    if (n < 2) return rounds;

    const fixed = 0;
    const rotating = Array.from({ length: n - 1 }, (_, i) => i + 1);
    const half = Math.floor(n / 2);

    for (let r = 0; r < n - 1; r++) {
        const pairings: { t1: number; t2: number }[] = [];
        // First pairing: fixed vs first in rotating list
        if (fixed < teamCount && rotating[0] < teamCount) {
            pairings.push({ t1: fixed, t2: rotating[0] });
        }
        // Remaining pairings: pair opposite ends of the rotating list
        for (let k = 1; k < half; k++) {
            const a = rotating[k];
            const b = rotating[rotating.length - k];
            if (a < teamCount && b < teamCount) {
                pairings.push({ t1: a, t2: b });
            }
        }
        if (pairings.length > 0) {
            rounds.push({ round: r + 1, pairings });
        }
        rotating.unshift(rotating.pop()!);
    }
    return rounds;
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
        private dataSource: DataSource,
    ) { }

    async create(createTournamentDto: CreateTournamentDto): Promise<Tournament> {
        const { name, teams: teamsData, courts, durationMode, totalGroups, matchesPerTeam } = createTournamentDto;

        // Validate: each group must have at least 2 teams
        const groupCounts = new Map<number, number>();
        for (const t of teamsData) {
            groupCounts.set(t.groupNumber, (groupCounts.get(t.groupNumber) || 0) + 1);
        }
        for (const [gn, count] of groupCounts) {
            if (count < 2) {
                throw new BadRequestException(`El grupo ${gn} tiene solo ${count} pareja(s). Se necesitan al menos 2.`);
            }
        }
        // Validate group numbers are 1..totalGroups
        for (const [gn] of groupCounts) {
            if (gn < 1 || gn > totalGroups) {
                throw new BadRequestException(`Número de grupo ${gn} inválido. Debe ser entre 1 y ${totalGroups}.`);
            }
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const tournament = queryRunner.manager.create(Tournament, {
                name,
                type: createTournamentDto.type || TournamentType.CUADRANGULAR,
                status: TournamentStatus.IN_PROGRESS,
                courts,
                durationMode,
                durationMinutes: createTournamentDto.durationMinutes || null,
                matchesPerTeam: matchesPerTeam,
                totalGroups,
                clubId: createTournamentDto.clubId || null,
                config: createTournamentDto.config || { strictScoring: false, allowTies: true }
            });

            const savedTournament = await queryRunner.manager.save(tournament);

            // Create teams with their group assignments
            const teamsByGroup = new Map<number, Team[]>();
            for (const teamData of teamsData) {
                const p1 = await this.playersService.findOrCreateByName(teamData.player1Name);
                const p2 = await this.playersService.findOrCreateByName(teamData.player2Name);

                const team = await queryRunner.manager.save(Team, {
                    player1: p1,
                    player2: p2,
                    tournamentId: savedTournament.id,
                    groupNumber: teamData.groupNumber,
                });

                if (!teamsByGroup.has(teamData.groupNumber)) {
                    teamsByGroup.set(teamData.groupNumber, []);
                }
                teamsByGroup.get(teamData.groupNumber)!.push(team);
            }

            // Generate round-robin matches for each group independently
            await this.generateGroupRoundRobinMatches(queryRunner, savedTournament, teamsByGroup);

            await queryRunner.commitTransaction();

            return this.findOne(savedTournament.id);
        } catch (error) {
            await queryRunner.rollbackTransaction();

            if (error.code === '23503') {
                throw new BadRequestException('El club seleccionado no es válido (ID no encontrado). Intente seleccionar el club nuevamente.');
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Generate round-robin matches for all groups, coordinating them into
     * GLOBAL rounds that fill courts simultaneously without conflicts.
     *
     * KEY CONSTRAINT: A team can only play ONCE per global round.
     * Since teams don't cross groups, the constraint is equivalent to:
     * never put matches from DIFFERENT internal rounds of the SAME group
     * into the SAME global round.
     *
     * Algorithm:
     * 1. Generate each group's round-robin schedule (list of internal rounds).
     * 2. Use a cursor per group tracking which internal round to take next.
     * 3. Fill each global round by taking matches from groups' current rounds,
     *    advancing a group's cursor only when ALL matches from that internal
     *    round have been placed.
     * 4. In each global round, assign court numbers 1..courts sequentially.
     */
    private async generateGroupRoundRobinMatches(
        queryRunner: any,
        tournament: Tournament,
        teamsByGroup: Map<number, Team[]>
    ): Promise<void> {
        const courts = tournament.courts;

        // 1. Generate per-group schedules
        interface GroupMatch { groupNumber: number; team1Id: string; team2Id: string }
        const groupRounds: Map<number, GroupMatch[][]> = new Map();

        for (const [groupNumber, teams] of teamsByGroup) {
            const schedule = generateRoundRobinSchedule(teams.length);
            // Limit rounds to matchesPerTeam if set (> 0), otherwise use all (full round-robin)
            const maxRounds = (tournament.matchesPerTeam && tournament.matchesPerTeam > 0)
                ? Math.min(tournament.matchesPerTeam, schedule.length)
                : schedule.length;
            const rounds: GroupMatch[][] = [];
            for (let ri = 0; ri < maxRounds; ri++) {
                const round = schedule[ri];
                const roundMatches: GroupMatch[] = [];
                for (const pairing of round.pairings) {
                    roundMatches.push({
                        groupNumber,
                        team1Id: teams[pairing.t1].id,
                        team2Id: teams[pairing.t2].id,
                    });
                }
                rounds.push(roundMatches);
            }
            groupRounds.set(groupNumber, rounds);
        }

        // 2. Cursors: for each group, track [internal round index, match index within that round]
        const cursors: Map<number, { roundIdx: number; matchIdx: number }> = new Map();
        for (const [gn] of groupRounds) {
            cursors.set(gn, { roundIdx: 0, matchIdx: 0 });
        }

        // 3. Fill global rounds
        const matches: Partial<Match>[] = [];
        let globalRound = 0;

        while (true) {
            globalRound++;
            const roundMatches: GroupMatch[] = [];
            // Track which groups have contributed from which internal round in THIS global round
            const groupInternalRounds: Map<number, number> = new Map();

            // Try to fill `courts` matches for this global round
            let filled = false;
            do {
                filled = false;
                for (const [gn, rounds] of groupRounds) {
                    if (roundMatches.length >= courts) break;

                    const cursor = cursors.get(gn)!;
                    if (cursor.roundIdx >= rounds.length) continue; // group exhausted

                    // Check: can we take from this group?
                    // Only if we haven't already started a DIFFERENT internal round
                    // for this group in this global round.
                    const existingInternalRound = groupInternalRounds.get(gn);
                    if (existingInternalRound !== undefined && existingInternalRound !== cursor.roundIdx) {
                        continue; // would mix internal rounds of same group — skip
                    }

                    const internalRound = rounds[cursor.roundIdx];
                    if (cursor.matchIdx < internalRound.length) {
                        roundMatches.push(internalRound[cursor.matchIdx]);
                        groupInternalRounds.set(gn, cursor.roundIdx);
                        cursor.matchIdx++;
                        filled = true;

                        // If we finished this group's internal round, advance to next
                        if (cursor.matchIdx >= internalRound.length) {
                            cursor.roundIdx++;
                            cursor.matchIdx = 0;
                        }
                    }
                }
            } while (filled && roundMatches.length < courts);

            if (roundMatches.length === 0) break; // all groups exhausted

            // 4. Assign court numbers and save
            for (let i = 0; i < roundMatches.length; i++) {
                const pm = roundMatches[i];
                matches.push({
                    tournamentId: tournament.id,
                    team1Id: pm.team1Id,
                    team2Id: pm.team2Id,
                    status: MatchStatus.PENDING,
                    groupNumber: pm.groupNumber,
                    courtNumber: i + 1,
                    round: globalRound,
                    phase: MatchPhase.GROUP,
                });
            }
        }

        await queryRunner.manager.save(Match, matches);
    }

    async findAll(clubId?: string, pagination?: PaginationQueryDto, month?: number, year?: number): Promise<PaginatedResult<Tournament>> {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const skip = (page - 1) * limit;

        const qb = this.tournamentRepository.createQueryBuilder('t')
            .leftJoinAndSelect('t.teams', 'team')
            .leftJoinAndSelect('team.player1', 'p1')
            .leftJoinAndSelect('team.player2', 'p2')
            .leftJoinAndSelect('t.matches', 'match')
            .leftJoinAndSelect('t.club', 'club')
            .orderBy('t.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        if (clubId) {
            qb.andWhere('t."clubId" = :clubId', { clubId });
        }
        if (month) {
            qb.andWhere('EXTRACT(MONTH FROM t."createdAt") = :month', { month });
        }
        if (year) {
            qb.andWhere('EXTRACT(YEAR FROM t."createdAt") = :year', { year });
        }

        const [data, total] = await qb.getManyAndCount();
        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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

    async getStandings(tournamentId: string, groupNumber?: number, phaseFilter?: string): Promise<Standing[]> {
        const tournament = await this.findOne(tournamentId);
        let teams = tournament.teams;
        let matches = tournament.matches.filter(m => m.status === MatchStatus.COMPLETED);

        // Filter by phase if specified ('group' = only group phase)
        if (phaseFilter === 'group') {
            matches = matches.filter(m => m.phase === MatchPhase.GROUP);
        }

        // Filter by group if specified
        if (groupNumber) {
            teams = teams.filter(t => t.groupNumber === groupNumber);
            matches = matches.filter(m => m.groupNumber === groupNumber);
        }

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
                points: 0,
                groupNumber: team.groupNumber,
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

        // Calculate points and differences
        const ptsWin = tournament.config?.pointsForWin ?? 3;
        const ptsTie = tournament.config?.pointsForTie ?? 1;
        const ptsLoss = tournament.config?.pointsForLoss ?? 0;

        standingsMap.forEach(standing => {
            standing.setDifference = standing.setsWon - standing.setsLost;
            standing.gameDifference = standing.gamesWon - standing.gamesLost;
            standing.points = (standing.matchesWon * ptsWin) +
                (standing.matchesDrawn * ptsTie) +
                (standing.matchesLost * ptsLoss);
        });

        // Sort standings
        const standings = Array.from(standingsMap.values()).sort((a, b) => {
            // 1. Points (descending)
            if (b.points !== a.points) {
                return b.points - a.points;
            }
            // 2. Matches won (descending)
            if (b.matchesWon !== a.matchesWon) {
                return b.matchesWon - a.matchesWon;
            }
            // 3. Set difference (descending)
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

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            await queryRunner.manager.remove(tournament);
            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }

        // Recalculate stats outside transaction (non-critical)
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

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            tournament.status = TournamentStatus.COMPLETED;
            const savedTournament = await queryRunner.manager.save(tournament);

            await queryRunner.commitTransaction();

            // Collect all players to update their stats
            const playerIds = new Set<string>();
            savedTournament.teams.forEach(t => {
                playerIds.add(t.player1Id);
                playerIds.add(t.player2Id);
            });

            // Recalculate global stats (outside transaction — non-critical)
            await this.playersService.recalculateTotalPoints(Array.from(playerIds));

            return savedTournament;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Generate elimination matches for FREE mode tournaments.
     * Called after all round-robin matches are completed.
     * Top teams advance: 1st vs 4th, 2nd vs 3rd (semifinal-style).
     */
    async generateEliminationMatches(tournamentId: string): Promise<Match[]> {
        const tournament = await this.findOne(tournamentId);

        if (tournament.durationMode !== DurationMode.FREE) {
            throw new BadRequestException('La eliminación progresiva solo aplica en modo tiempo libre');
        }

        const existingElim = tournament.matches.filter(m => m.phase === MatchPhase.ELIMINATION);
        const semiFinals = existingElim.filter(m => m.round === 1);
        const finalMatch = existingElim.filter(m => m.round === 2);

        // ── Case 1: Generate FINAL from completed semifinals ──
        if (semiFinals.length === 2 && finalMatch.length === 0) {
            const allSemisDone = semiFinals.every(m => m.status === MatchStatus.COMPLETED && m.winnerId);
            if (!allSemisDone) {
                throw new BadRequestException('Ambas semifinales deben estar completadas antes de generar la final');
            }

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                const finalMatchData: Partial<Match> = {
                    tournamentId,
                    team1Id: semiFinals[0].winnerId!,
                    team2Id: semiFinals[1].winnerId!,
                    status: MatchStatus.PENDING,
                    phase: MatchPhase.ELIMINATION,
                    round: 2,
                    courtNumber: 1,
                };

                const saved = await queryRunner.manager.save(Match, [finalMatchData]);
                await queryRunner.commitTransaction();
                return saved as Match[];
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
            }
        }

        // ── Case 2: Already have a final ──
        if (finalMatch.length > 0) {
            throw new BadRequestException('La final ya fue generada');
        }

        // ── Case 3: No elimination matches yet → generate SEMIFINALS ──
        if (existingElim.length > 0) {
            throw new BadRequestException('Los partidos de eliminación ya fueron generados');
        }

        // Check all group matches are completed
        const groupMatches = tournament.matches.filter(m => m.phase === MatchPhase.GROUP);
        const allGroupsDone = groupMatches.every(m => m.status === MatchStatus.COMPLETED);

        if (!allGroupsDone) {
            throw new BadRequestException('Todos los partidos deben estar completados antes de generar la eliminación');
        }

        // Get overall standings
        const standings = await this.getStandings(tournamentId);

        if (standings.length < 4) {
            throw new BadRequestException('Se necesitan al menos 4 parejas para generar eliminación');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const eliminationMatches: Partial<Match>[] = [];
            const courts = tournament.courts;

            // Semifinal: 1st vs 4th, 2nd vs 3rd
            eliminationMatches.push(
                {
                    tournamentId, team1Id: standings[0].teamId, team2Id: standings[3].teamId,
                    status: MatchStatus.PENDING, phase: MatchPhase.ELIMINATION,
                    round: 1, courtNumber: 1,
                },
                {
                    tournamentId, team1Id: standings[1].teamId, team2Id: standings[2].teamId,
                    status: MatchStatus.PENDING, phase: MatchPhase.ELIMINATION,
                    round: 1, courtNumber: Math.min(2, courts),
                }
            );

            const saved = await queryRunner.manager.save(Match, eliminationMatches);
            await queryRunner.commitTransaction();
            return saved as Match[];
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    // ===================== MONTHLY STATS =====================
    async getMonthlyStats(month: number, year: number, clubId?: string) {
        const qb = this.tournamentRepository.createQueryBuilder('t')
            .leftJoinAndSelect('t.matches', 'match')
            .leftJoinAndSelect('match.team1', 'mt1')
            .leftJoinAndSelect('mt1.player1', 'mt1p1')
            .leftJoinAndSelect('mt1.player2', 'mt1p2')
            .leftJoinAndSelect('match.team2', 'mt2')
            .leftJoinAndSelect('mt2.player1', 'mt2p1')
            .leftJoinAndSelect('mt2.player2', 'mt2p2')
            .where('EXTRACT(MONTH FROM t."createdAt") = :month', { month })
            .andWhere('EXTRACT(YEAR FROM t."createdAt") = :year', { year });

        if (clubId) {
            qb.andWhere('t."clubId" = :clubId', { clubId });
        }

        const tournaments = await qb.getMany();

        // Aggregate player stats
        const playerMap = new Map<string, { id: string; name: string; matchesWon: number; matchesPlayed: number; tournamentIds: Set<string> }>();
        const pairMap = new Map<string, { player1Name: string; player2Name: string; matchesWon: number; matchesPlayed: number; tournamentIds: Set<string> }>();

        for (const tournament of tournaments) {
            const completed = (tournament.matches || []).filter(m => m.status === MatchStatus.COMPLETED);

            for (const match of completed) {
                const sides = [
                    { team: match.team1, teamId: match.team1Id, isWinner: match.winnerId === match.team1Id },
                    { team: match.team2, teamId: match.team2Id, isWinner: match.winnerId === match.team2Id },
                ];

                for (const { team, isWinner } of sides) {
                    if (!team) continue;

                    // Player stats
                    for (const player of [team.player1, team.player2]) {
                        if (!player) continue;
                        if (!playerMap.has(player.id)) {
                            playerMap.set(player.id, { id: player.id, name: player.name, matchesWon: 0, matchesPlayed: 0, tournamentIds: new Set() });
                        }
                        const ps = playerMap.get(player.id)!;
                        ps.matchesPlayed++;
                        if (isWinner) ps.matchesWon++;
                        ps.tournamentIds.add(tournament.id);
                    }

                    // Pair stats
                    const names = [team.player1?.name || '', team.player2?.name || ''].sort();
                    const pairKey = names.join('|');
                    if (!pairMap.has(pairKey)) {
                        pairMap.set(pairKey, { player1Name: names[0], player2Name: names[1], matchesWon: 0, matchesPlayed: 0, tournamentIds: new Set() });
                    }
                    const pair = pairMap.get(pairKey)!;
                    pair.matchesPlayed++;
                    if (isWinner) pair.matchesWon++;
                    pair.tournamentIds.add(tournament.id);
                }
            }
        }

        const topPlayers = Array.from(playerMap.values())
            .map(p => ({ id: p.id, name: p.name, matchesWon: p.matchesWon, matchesPlayed: p.matchesPlayed, tournamentsPlayed: p.tournamentIds.size }))
            .sort((a, b) => b.matchesWon - a.matchesWon || b.matchesPlayed - a.matchesPlayed)
            .slice(0, 20);

        const topPairs = Array.from(pairMap.values())
            .map(p => ({ player1Name: p.player1Name, player2Name: p.player2Name, matchesWon: p.matchesWon, matchesPlayed: p.matchesPlayed, tournamentsPlayed: p.tournamentIds.size }))
            .sort((a, b) => b.matchesWon - a.matchesWon || b.matchesPlayed - a.matchesPlayed)
            .slice(0, 20);

        return {
            month,
            year,
            totalTournaments: tournaments.length,
            totalMatches: tournaments.reduce((acc, t) => acc + (t.matches || []).filter(m => m.status === MatchStatus.COMPLETED).length, 0),
            topPlayers,
            topPairs,
        };
    }
}
