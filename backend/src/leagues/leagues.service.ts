import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { League, LeagueStatus } from './entities/league.entity';
import { LeagueTeam } from './entities/league-team.entity';
import { LeagueMatch, MatchStatus } from './entities/league-match.entity';
import { PlayersService } from '../players/players.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class LeaguesService {
    constructor(
        @InjectRepository(League)
        private leagueRepository: Repository<League>,
        @InjectRepository(LeagueTeam)
        private leagueTeamRepository: Repository<LeagueTeam>,
        @InjectRepository(LeagueMatch)
        private leagueMatchRepository: Repository<LeagueMatch>,
        private playersService: PlayersService,
        private dataSource: DataSource,
    ) { }

    async create(createLeagueDto: CreateLeagueDto): Promise<League> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const league = queryRunner.manager.create(League, {
                ...createLeagueDto,
                clubId: createLeagueDto.clubId
            });
            const savedLeague = await queryRunner.manager.save(league);

            // If pairs are provided, create teams automatically
            if (createLeagueDto.pairs && createLeagueDto.pairs.length > 0) {
                for (let i = 0; i < createLeagueDto.pairs.length; i++) {
                    const pair = createLeagueDto.pairs[i];
                    await queryRunner.manager.save(LeagueTeam, {
                        leagueId: savedLeague.id,
                        player1Id: pair.playerA,
                        player2Id: pair.playerB,
                        teamName: `Pareja ${i + 1}`
                    });
                }
            }

            await queryRunner.commitTransaction();
            return this.findOne(savedLeague.id);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async findAll(clubId?: string, pagination?: PaginationQueryDto): Promise<PaginatedResult<League>> {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const skip = (page - 1) * limit;

        const queryOptions: any = {
            relations: ['teams', 'teams.player1', 'teams.player2', 'matches'],
            skip,
            take: limit,
        };

        if (clubId) {
            queryOptions.where = { clubId };
        }

        const [data, total] = await this.leagueRepository.findAndCount(queryOptions);
        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(id: string): Promise<League> {
        const league = await this.leagueRepository.findOne({
            where: { id },
            relations: [
                'teams', 'teams.player1', 'teams.player2',
                'matches',
                'matches.team1', 'matches.team1.player1', 'matches.team1.player2',
                'matches.team2', 'matches.team2.player1', 'matches.team2.player2'
            ]
        });
        if (!league) {
            throw new NotFoundException(`League with ID ${id} not found`);
        }
        return league;
    }

    async update(id: string, updateLeagueDto: UpdateLeagueDto): Promise<League> {
        const league = await this.findOne(id);
        this.leagueRepository.merge(league, updateLeagueDto);
        return this.leagueRepository.save(league);
    }

    async remove(id: string): Promise<void> {
        const league = await this.findOne(id);

        if (league.status === LeagueStatus.COMPLETED) {
            throw new BadRequestException('Cannot delete a completed league');
        }

        // Collect player IDs to recalculate stats after deletion
        const playerIds = new Set<string>();
        league.teams.forEach(t => {
            if (t.player1Id) playerIds.add(t.player1Id);
            if (t.player2Id) playerIds.add(t.player2Id);
        });

        await this.leagueRepository.remove(league);

        // Recalculate stats for affected players (points will be removed)
        if (playerIds.size > 0) {
            await this.playersService.recalculateTotalPoints(Array.from(playerIds));
        }
    }

    async addTeam(id: string, player1Id: string, player2Id: string): Promise<LeagueTeam> {
        const league = await this.findOne(id);
        const team = this.leagueTeamRepository.create({
            leagueId: id,
            player1Id,
            player2Id,
            teamName: `Team ${league.teams.length + 1}`
        });
        return this.leagueTeamRepository.save(team);
    }

    async generateGroups(id: string, numberOfGroups: number): Promise<LeagueTeam[]> {
        const league = await this.findOne(id);
        if (league.teams.length < numberOfGroups * 2) {
            throw new Error('Not enough teams for the requested number of groups (min 2 per group)');
        }

        const teams = [...league.teams];
        // Fisher-Yates Shuffle
        for (let i = teams.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [teams[i], teams[j]] = [teams[j], teams[i]];
        }

        // Assign groups (A, B, C...)
        const groupNames = Array.from({ length: numberOfGroups }, (_, i) => String.fromCharCode(65 + i)); // A, B, C...

        teams.forEach((team, index) => {
            const groupIndex = index % numberOfGroups;
            team.group = groupNames[groupIndex];
        });

        // Save config with generated groups
        league.config = { ...league.config, groups: groupNames };
        await this.leagueRepository.save(league);

        return this.leagueTeamRepository.save(teams);
    }

    async updateMatchResult(matchId: string, sets: any[], winnerId: string): Promise<LeagueMatch> {
        const match = await this.leagueMatchRepository.findOne({
            where: { id: matchId },
            relations: ['league']
        });
        if (!match) throw new NotFoundException('Match not found');

        if (match.league && match.league.status === LeagueStatus.COMPLETED) {
            throw new BadRequestException('Cannot update match result for a completed league');
        }

        match.sets = sets;
        match.winnerId = winnerId;
        match.status = MatchStatus.COMPLETED;

        const savedMatch = await this.leagueMatchRepository.save(match);

        // Recalculate standings for this league
        await this.calculateStandings(match.leagueId);

        // Check for playoff generation
        if (match.league.type === 'groups_playoff') {
            await this.checkAndGeneratePlayoffs(match.leagueId);
        } else if (match.league.type === 'round_robin_playoff') {
            await this.checkAndGenerateRoundRobinPlayoffs(match.leagueId);
        }

        // Check for automatic completion
        await this.checkAutomaticCompletion(match.leagueId);

        return savedMatch;
    }

    private async checkAndGeneratePlayoffs(leagueId: string) {
        const league = await this.findOne(leagueId);

        // If playoffs exist, check for progression (QF -> SF -> F)
        const hasPlayoffs = league.matches.some(m => m.group && m.group.startsWith('Playoff'));
        if (hasPlayoffs) {
            await this.checkPlayoffProgression(league);
            return;
        }

        // Check if group stage is finished
        const groupMatches = league.matches.filter(m => !m.group?.startsWith('Playoff'));
        if (groupMatches.length === 0) return; // No matches yet

        const allCompleted = groupMatches.every(m => m.status === MatchStatus.COMPLETED);
        if (!allCompleted) return;

        // Generate Playoffs
        await this.generateInitialPlayoffFixtures(league);
    }

    private async checkPlayoffProgression(league: League) {
        const tiers = ['', '_Gold', '_Silver', '_Bronze'];

        for (const tier of tiers) {
            // 1. Check Semis -> Final
            const sfGroup = `Playoff${tier}_SF`;
            const fGroup = `Playoff${tier}_F`;

            const sfMatches = league.matches.filter(m => m.group === sfGroup);
            const fMatches = league.matches.filter(m => m.group === fGroup);

            if (sfMatches.length > 0 && fMatches.length === 0) {
                const allSfDone = sfMatches.every(m => m.status === MatchStatus.COMPLETED);
                if (allSfDone) {
                    sfMatches.sort((a, b) => a.id.localeCompare(b.id));

                    const w1 = sfMatches[0].winnerId;
                    const w2 = sfMatches[1].winnerId;

                    if (w1 && w2) {
                        await this.leagueMatchRepository.save(
                            this.createPlayoffMatch(league.id, w1, w2, fGroup, 1) // Round 1 of Finals
                        );
                    }
                }
                continue;
            }

            // 2. Check QF -> Semis
            const qfGroup = `Playoff${tier}_QF`;
            const qfMatches = league.matches.filter(m => m.group === qfGroup);
            const sfMatchesForTier = league.matches.filter(m => m.group === sfGroup);

            if (qfMatches.length > 0 && sfMatchesForTier.length === 0) {
                const allQfDone = qfMatches.every(m => m.status === MatchStatus.COMPLETED);
                if (allQfDone) {
                    qfMatches.sort((a, b) => a.id.localeCompare(b.id));

                    const winners = qfMatches.map(m => m.winnerId);
                    if (winners.length === 4 && winners.every(w => !!w)) {
                        await this.leagueMatchRepository.save([
                            this.createPlayoffMatch(league.id, winners[0], winners[1], sfGroup, 1),
                            this.createPlayoffMatch(league.id, winners[2], winners[3], sfGroup, 1)
                        ]);
                    }
                }
            }
        }
    }

    private async generateInitialPlayoffFixtures(league: League) {
        const teams = league.teams;

        const groups: Record<string, LeagueTeam[]> = {};
        teams.forEach(t => {
            if (t.group) {
                if (!groups[t.group]) groups[t.group] = [];
                groups[t.group].push(t);
            }
        });

        Object.keys(groups).forEach(g => {
            groups[g].sort((a, b) => {
                if (a.points !== b.points) return b.points - a.points;
                const diffA = (a.setsWon - a.setsLost);
                const diffB = (b.setsWon - b.setsLost);
                if (diffA !== diffB) return diffB - diffA;
                return (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost);
            });
        });

        const groupNames = Object.keys(groups).sort();
        const numGroups = groupNames.length;
        const matches: LeagueMatch[] = [];

        const multiTier = league.config.enableMultiTierPlayoffs;
        const advance = league.config.teamsAdvancePerGroup || 2;

        if (numGroups === 2) {
            const gA = groups[groupNames[0]];
            const gB = groups[groupNames[1]];

            // Standard Playoff
            if (!multiTier) {
                if (gA.length >= advance && gB.length >= advance) {
                    if (advance === 2) {
                        matches.push(this.createPlayoffMatch(league.id, gA[0].id, gB[1].id, 'Playoff_SF', 1));
                        matches.push(this.createPlayoffMatch(league.id, gB[0].id, gA[1].id, 'Playoff_SF', 1));
                    } else if (advance === 4) {
                        matches.push(this.createPlayoffMatch(league.id, gA[0].id, gB[3].id, 'Playoff_QF', 1));
                        matches.push(this.createPlayoffMatch(league.id, gB[1].id, gA[2].id, 'Playoff_QF', 1));
                        matches.push(this.createPlayoffMatch(league.id, gB[0].id, gA[3].id, 'Playoff_QF', 1));
                        matches.push(this.createPlayoffMatch(league.id, gA[1].id, gB[2].id, 'Playoff_QF', 1));
                    }
                }
            } else {
                // Multi Tier Playoffs (Gold, Silver, Bronze)
                // Gold: 1st & 2nd
                if (gA.length >= 2 && gB.length >= 2) {
                    matches.push(this.createPlayoffMatch(league.id, gA[0].id, gB[1].id, 'Playoff_Gold_SF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gB[0].id, gA[1].id, 'Playoff_Gold_SF', 1));
                }

                // Silver: 3rd & 4th
                if (gA.length >= 4 && gB.length >= 4) {
                    matches.push(this.createPlayoffMatch(league.id, gA[2].id, gB[3].id, 'Playoff_Silver_SF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gB[2].id, gA[3].id, 'Playoff_Silver_SF', 1));
                }

                // Bronze: 5th & 6th
                if (gA.length >= 6 && gB.length >= 6) {
                    matches.push(this.createPlayoffMatch(league.id, gA[4].id, gB[5].id, 'Playoff_Bronze_SF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gB[4].id, gA[5].id, 'Playoff_Bronze_SF', 1));
                } else if (gA.length >= 5 && gB.length >= 5) {
                    // Direct Final if only 5 teams
                    matches.push(this.createPlayoffMatch(league.id, gA[4].id, gB[4].id, 'Playoff_Bronze_F', 1));
                }
            }
        }
        else if (numGroups === 4) {
            const gA = groups[groupNames[0]];
            const gB = groups[groupNames[1]];
            const gC = groups[groupNames[2]];
            const gD = groups[groupNames[3]];

            if (!multiTier) {
                if (advance === 2 && gA.length >= 2 && gB.length >= 2 && gC.length >= 2 && gD.length >= 2) {
                    matches.push(this.createPlayoffMatch(league.id, gA[0].id, gB[1].id, 'Playoff_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gC[0].id, gD[1].id, 'Playoff_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gB[0].id, gA[1].id, 'Playoff_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gD[0].id, gC[1].id, 'Playoff_QF', 1));
                }
            } else {
                // Multi Tier 4 Groups
                // Gold (Top 2) -> QF
                if (gA.length >= 2 && gB.length >= 2 && gC.length >= 2 && gD.length >= 2) {
                    matches.push(this.createPlayoffMatch(league.id, gA[0].id, gB[1].id, 'Playoff_Gold_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gC[0].id, gD[1].id, 'Playoff_Gold_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gB[0].id, gA[1].id, 'Playoff_Gold_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gD[0].id, gC[1].id, 'Playoff_Gold_QF', 1));
                }

                // Silver (3rd & 4th) -> Silver QF
                if (gA.length >= 4 && gB.length >= 4 && gC.length >= 4 && gD.length >= 4) {
                    matches.push(this.createPlayoffMatch(league.id, gA[2].id, gB[3].id, 'Playoff_Silver_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gC[2].id, gD[3].id, 'Playoff_Silver_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gB[2].id, gA[3].id, 'Playoff_Silver_QF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gD[2].id, gC[3].id, 'Playoff_Silver_QF', 1));
                }

                // Bronze (5th) -> Bronze SF
                if (gA.length >= 5 && gB.length >= 5 && gC.length >= 5 && gD.length >= 5) {
                    matches.push(this.createPlayoffMatch(league.id, gA[4].id, gB[4].id, 'Playoff_Bronze_SF', 1));
                    matches.push(this.createPlayoffMatch(league.id, gC[4].id, gD[4].id, 'Playoff_Bronze_SF', 1));
                }
            }
        }

        if (matches.length > 0) {
            await this.leagueMatchRepository.save(matches);
        }
    }

    private createPlayoffMatch(leagueId: string, t1Id: string, t2Id: string, group: string, round: number): LeagueMatch {
        return this.leagueMatchRepository.create({
            leagueId,
            team1Id: t1Id,
            team2Id: t2Id,
            group,
            round,
            status: MatchStatus.PENDING
        });
    }

    async generateFixtures(id: string): Promise<LeagueMatch[]> {
        const league = await this.findOne(id);

        if (league.teams.length < 2) {
            throw new BadRequestException('Not enough teams to generate fixtures');
        }

        const matches: LeagueMatch[] = [];

        if (league.type === 'round_robin' || league.type === 'round_robin_playoff') {
            const configRounds = league.config.rounds || 1;
            for (let r = 0; r < configRounds; r++) {
                this.generateRoundRobinMatches(league.teams, matches, id, undefined, r);
            }
        } else if (league.type === 'groups_playoff') {
            const groups = league.config.groups || [];
            if (groups.length === 0) {
                const teamGroups = new Set(league.teams.map(t => t.group).filter(g => !!g));

                // Auto-generate groups if not assigned
                if (teamGroups.size === 0) {
                    await this.generateGroups(id, league.config.numberOfGroups || 2);
                    // Refresh league with new groups
                    const updatedLeague = await this.findOne(id);
                    // Recursively call generateFixtures now that groups exist
                    return this.generateFixtures(id);
                }

                teamGroups.forEach(group => {
                    const groupTeams = league.teams.filter(t => t.group === group);
                    this.generateRoundRobinMatches(groupTeams, matches, id, group);
                });
            } else {
                groups.forEach(group => {
                    const groupTeams = league.teams.filter(t => t.group === group);
                    this.generateRoundRobinMatches(groupTeams, matches, id, group);
                });
            }
        }

        return this.leagueMatchRepository.save(matches);
    }

    private generateRoundRobinMatches(teams: LeagueTeam[], matches: LeagueMatch[], leagueId: string, group?: string, roundCycle: number = 0) {
        const numTeams = teams.length;
        if (numTeams < 2) return;

        // Berger Table / Circle Method
        const ghost = numTeams % 2 !== 0;
        const workingTeams = ghost ? [...teams, null] : [...teams];
        const totalRounds = workingTeams.length - 1;
        const matchesPerRound = workingTeams.length / 2;
        const roundOffset = roundCycle * totalRounds; // Offset round numbers for multi-cycle

        for (let round = 0; round < totalRounds; round++) {
            for (let match = 0; match < matchesPerRound; match++) {
                const home = workingTeams[match];
                const away = workingTeams[workingTeams.length - 1 - match];

                if (home && away) {
                    // In even cycles, swap home/away for variety
                    const t1 = roundCycle % 2 === 0 ? home : away;
                    const t2 = roundCycle % 2 === 0 ? away : home;
                    matches.push(this.leagueMatchRepository.create({
                        leagueId: leagueId,
                        team1Id: t1.id,
                        team2Id: t2.id,
                        round: roundOffset + round + 1,
                        group: group, // Optional group assignment
                        status: MatchStatus.PENDING
                    }));
                }
            }
            // Rotate
            const fixed = workingTeams[0];
            const tail = workingTeams.slice(1);
            tail.unshift(tail.pop()!); // This line assumes tail is not empty.
            workingTeams.splice(0, workingTeams.length, fixed, ...tail);
        }
    }

    async calculateStandings(leagueId: string): Promise<void> {
        const league = await this.findOne(leagueId);
        let matches = await this.leagueMatchRepository.find({
            where: { leagueId, status: MatchStatus.COMPLETED },
            relations: ['winner']
        });

        // For groups_playoff and round_robin_playoff, only count regular-phase matches for standings
        // Playoff matches (Playoff_QF, Playoff_SF, Playoff_F, etc.) should NOT inflate standings
        if (league.type === 'groups_playoff' || league.type === 'round_robin_playoff') {
            matches = matches.filter(m => !m.group || !m.group.startsWith('Playoff'));
        }

        // For round_robin, exclude tie-breaker matches from regular standings
        // (TieBreaker matches are special and resolved separately)
        matches = matches.filter(m => m.group !== 'TieBreaker');

        // Reset stats for all teams
        for (const team of league.teams) {
            team.matchesPlayed = 0;
            team.matchesWon = 0;
            team.matchesLost = 0;
            team.points = 0;
            team.setsWon = 0;
            team.setsLost = 0;
            team.gamesWon = 0;
            team.gamesLost = 0;
        }

        // Calculate based on matches
        for (const match of matches) {
            const team1 = league.teams.find(t => t.id === match.team1Id);
            const team2 = league.teams.find(t => t.id === match.team2Id);

            if (!team1 || !team2) continue;

            team1.matchesPlayed++;
            team2.matchesPlayed++;

            // Points config (default: Win=3, Loss=0)
            const pointsForWin = league.config.pointsForWin ?? 3;
            const pointsForLoss = league.config.pointsForLoss ?? 0;

            if (match.winnerId === team1.id) {
                team1.matchesWon++;
                team1.points += pointsForWin;
                team2.matchesLost++;
                team2.points += pointsForLoss;
            } else if (match.winnerId === team2.id) {
                team2.matchesWon++;
                team2.points += pointsForWin;
                team1.matchesLost++;
                team1.points += pointsForLoss;
            }

            // Sets and Games
            // Determine how many competitive sets to count
            // If skipExhibitionSets is enabled and a team won 2-0, the 3rd set is exhibition
            const skipExhibition = league.config.skipExhibitionSets ?? false;
            let competitiveSets = match.sets || [];

            if (skipExhibition && competitiveSets.length === 3) {
                // Check if the winner won the first 2 sets (2-0 after 2 sets)
                let t1WinsFirst2 = 0;
                let t2WinsFirst2 = 0;
                for (let i = 0; i < 2; i++) {
                    const s = competitiveSets[i];
                    const g1 = s.team1Games ?? s.pairAGames ?? 0;
                    const g2 = s.team2Games ?? s.pairBGames ?? 0;
                    if (g1 > g2) t1WinsFirst2++;
                    else if (g2 > g1) t2WinsFirst2++;
                }
                // If someone already won 2-0, the 3rd set is exhibition — skip it
                if (t1WinsFirst2 === 2 || t2WinsFirst2 === 2) {
                    competitiveSets = competitiveSets.slice(0, 2);
                }
            }

            competitiveSets.forEach(set => {
                // Handle frontend nomenclature
                const t1Games = set.team1Games ?? set.pairAGames ?? 0;
                const t2Games = set.team2Games ?? set.pairBGames ?? 0;

                team1.gamesWon += t1Games;
                team1.gamesLost += t2Games;
                team2.gamesWon += t2Games;
                team2.gamesLost += t1Games;

                if (t1Games > t2Games) {
                    team1.setsWon++;
                    team2.setsLost++;
                } else if (t2Games > t1Games) {
                    team2.setsWon++;
                    team1.setsLost++;
                }
            }); // end competitiveSets.forEach
        }

        await this.leagueTeamRepository.save(league.teams);
    }

    async getStandings(leagueId: string): Promise<LeagueTeam[]> {
        await this.calculateStandings(leagueId); // Ensure fresh stats
        const league = await this.findOne(leagueId);

        // Load completed non-playoff matches for head-to-head tiebreaker
        const completedMatches = await this.leagueMatchRepository.find({
            where: { leagueId, status: MatchStatus.COMPLETED }
        });
        const regularMatches = completedMatches.filter(m => 
            !m.group?.startsWith('Playoff') && m.group !== 'TieBreaker'
        );

        return league.teams.sort((a, b) => {
            // 1st criterion: Points
            if (a.points !== b.points) return b.points - a.points;

            // 2nd criterion: Game difference
            const gamesDiffA = a.gamesWon - a.gamesLost;
            const gamesDiffB = b.gamesWon - b.gamesLost;
            if (gamesDiffA !== gamesDiffB) return gamesDiffB - gamesDiffA;

            // 3rd criterion: Head-to-head result
            const h2h = this.getHeadToHeadResult(a.id, b.id, regularMatches);
            if (h2h !== 0) return h2h;

            // 4th criterion: Set difference (fallback)
            if ((a.setsWon - a.setsLost) !== (b.setsWon - b.setsLost)) {
                return (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost);
            }

            return 0;
        });
    }

    /**
     * Head-to-head tiebreaker: returns negative if teamA won, positive if teamB won, 0 if no result
     */
    private getHeadToHeadResult(teamAId: string, teamBId: string, matches: LeagueMatch[]): number {
        // Find direct matches between these two teams
        const directMatches = matches.filter(m =>
            (m.team1Id === teamAId && m.team2Id === teamBId) ||
            (m.team1Id === teamBId && m.team2Id === teamAId)
        );

        if (directMatches.length === 0) return 0;

        let teamAWins = 0;
        let teamBWins = 0;

        for (const match of directMatches) {
            if (match.winnerId === teamAId) teamAWins++;
            else if (match.winnerId === teamBId) teamBWins++;
        }

        if (teamAWins > teamBWins) return -1; // A is better → sort A before B
        if (teamBWins > teamAWins) return 1;  // B is better → sort B before A
        return 0;
    }

    async suggestNextMatch(leagueId: string): Promise<LeagueMatch> {
        const league = await this.findOne(leagueId);

        // Get all pending matches
        const pendingMatches = league.matches.filter(m => m.status === MatchStatus.PENDING);

        if (pendingMatches.length === 0) {
            throw new NotFoundException('No pending matches found');
        }

        // Calculate current standings to use for balancing
        const standings = await this.getStandings(leagueId);

        // Score each match by competitiveness (closer points = higher score)
        const scoredMatches = pendingMatches.map(match => {
            const team1 = standings.find(t => t.id === match.team1Id);
            const team2 = standings.find(t => t.id === match.team2Id);

            if (!team1 || !team2) return { match, score: 0 };

            // Lower difference in points = more competitive = higher score
            const pointsDiff = Math.abs(team1.points - team2.points);
            const score = 100 - pointsDiff; // Higher score for closer matches

            return { match, score };
        });

        // Sort by score (most competitive first) and return the top match
        scoredMatches.sort((a, b) => b.score - a.score);

        return scoredMatches[0].match;
    }

    async completeLeague(id: string): Promise<League> {
        const league = await this.findOne(id);
        if (league.status === LeagueStatus.COMPLETED) return league;

        league.status = LeagueStatus.COMPLETED;
        // Set end date if not set
        if (!league.endDate) {
            league.endDate = new Date();
        }
        const saved = await this.leagueRepository.save(league);

        // Trigger point recalculation for all participants
        const playerIds = new Set<string>();
        league.teams.forEach(t => {
            if (t.player1Id) playerIds.add(t.player1Id);
            if (t.player2Id) playerIds.add(t.player2Id);
        });

        if (playerIds.size > 0) {
            await this.playersService.recalculateTotalPoints(Array.from(playerIds));
        }

        return saved;
    }

    private async checkAutomaticCompletion(leagueId: string) {
        const league = await this.findOne(leagueId);
        if (league.status === LeagueStatus.COMPLETED) return;

        let shouldComplete = false;

        if (league.type === 'round_robin') {
            // Check if all matches are completed
            const allCompleted = league.matches.every(m => m.status === MatchStatus.COMPLETED);
            if (allCompleted && league.matches.length > 0) {
                // Before auto-completing, check if there are unresolved ties for top 3
                const ties = await this.checkStandingsTies(leagueId);
                if (ties.length === 0) {
                    shouldComplete = true;
                }
            }
        } else if (league.type === 'groups_playoff') {
            const finals = league.matches.filter(m => m.group && m.group.endsWith('_F'));
            if (finals.length > 0) {
                const allFinalsDone = finals.every(m => m.status === MatchStatus.COMPLETED);
                if (allFinalsDone) shouldComplete = true;
            }
        } else if (league.type === 'round_robin_playoff') {
            // Complete when all playoff finals AND 3rd place matches are done
            const playoffMatches = league.matches.filter(m => m.group && m.group.startsWith('Playoff'));
            if (playoffMatches.length > 0) {
                const allPlayoffsDone = playoffMatches.every(m => m.status === MatchStatus.COMPLETED);
                if (allPlayoffsDone) shouldComplete = true;
            }
        }

        if (shouldComplete) {
            await this.completeLeague(leagueId);
        }
    }

    async checkStandingsTies(leagueId: string): Promise<LeagueTeam[]> {
        const standings = await this.getStandings(leagueId);
        if (standings.length < 2) return [];

        const isTied = (t1: LeagueTeam, t2: LeagueTeam) => {
            if (!t1 || !t2) return false;
            const diffA = t1.setsWon - t1.setsLost;
            const diffB = t2.setsWon - t2.setsLost;
            const gamesDiffA = t1.gamesWon - t1.gamesLost;
            const gamesDiffB = t2.gamesWon - t2.gamesLost;

            return t1.points === t2.points && diffA === diffB && gamesDiffA === gamesDiffB;
        };

        const tiedTeams = new Set<LeagueTeam>();

        // Check ties involving positions 1, 2, 3
        // Position 0 vs 1 (Gold vs Silver)
        if (isTied(standings[0], standings[1])) {
            tiedTeams.add(standings[0]);
            tiedTeams.add(standings[1]);
        }

        // Position 1 vs 2 (Silver vs Bronze)
        if (standings.length >= 3 && isTied(standings[1], standings[2])) {
            tiedTeams.add(standings[1]);
            tiedTeams.add(standings[2]);
        }

        // Position 2 vs 3 (Bronze vs 4th place - ensures bronze is decisive)
        if (standings.length >= 4 && isTied(standings[2], standings[3])) {
            tiedTeams.add(standings[2]);
            tiedTeams.add(standings[3]);
        }

        // Check if any of these teams already have a tie-breaker match pending or completed
        // If they validly played a tie-breaker, we might not want to re-trigger unless manually forced.
        // For now, we return the tied teams and let the UI decide to trigger.

        return Array.from(tiedTeams);
    }

    async generateTieBreakerMatches(leagueId: string): Promise<LeagueMatch[]> {
        const tiedTeams = await this.checkStandingsTies(leagueId);
        if (tiedTeams.length < 2) {
            throw new Error('No ties detected for the top positions.');
        }

        const matches: LeagueMatch[] = [];

        // If 2 teams, direct match
        if (tiedTeams.length === 2) {
            matches.push(this.leagueMatchRepository.create({
                leagueId,
                team1Id: tiedTeams[0].id,
                team2Id: tiedTeams[1].id,
                group: 'TieBreaker',
                round: 99, // Special round
                status: MatchStatus.PENDING
            }));
        } else {
            // 3+ teams, mini round robin
            this.generateRoundRobinMatches(tiedTeams, matches, leagueId, 'TieBreaker');
        }

        return this.leagueMatchRepository.save(matches);
    }

    // ==========================================
    // ROUND ROBIN + PLAYOFF (New format)
    // ==========================================

    /**
     * Check if all regular-phase matches are done, then generate playoffs from standings.
     * Format:
     *   - Gold: Top 4 → SF (1v4, 2v3) → Final + 3rd place
     *   - Silver: Next 4 (5-8) → SF (5v8, 6v7) → Final + 3rd place
     *   - Bottom pairs → Relegated
     */
    private async checkAndGenerateRoundRobinPlayoffs(leagueId: string) {
        const league = await this.findOne(leagueId);

        // If playoffs already exist, check progression
        const hasPlayoffs = league.matches.some(m => m.group && m.group.startsWith('Playoff'));
        if (hasPlayoffs) {
            await this.checkRoundRobinPlayoffProgression(league);
            return;
        }

        // Check if all regular-phase matches are completed
        const regularMatches = league.matches.filter(m =>
            !m.group || (!m.group.startsWith('Playoff') && m.group !== 'TieBreaker')
        );
        if (regularMatches.length === 0) return;

        const allCompleted = regularMatches.every(m => m.status === MatchStatus.COMPLETED);
        if (!allCompleted) return;

        // All regular matches done → generate playoffs from standings
        await this.generateRoundRobinPlayoffFixtures(league);
    }

    private async generateRoundRobinPlayoffFixtures(league: League) {
        const standings = await this.getStandings(league.id);
        const matches: LeagueMatch[] = [];

        const goldCount = league.config.goldPlayoffCount ?? 4;
        const silverCount = league.config.silverPlayoffCount ?? 4;

        // --- GOLD PLAYOFF (Top 4) ---
        // SF: 1st vs 4th, 2nd vs 3rd
        if (standings.length >= goldCount && goldCount >= 4) {
            matches.push(this.createPlayoffMatch(
                league.id, standings[0].id, standings[3].id, 'Playoff_Gold_SF', 1
            ));
            matches.push(this.createPlayoffMatch(
                league.id, standings[1].id, standings[2].id, 'Playoff_Gold_SF', 1
            ));
        } else if (standings.length >= 2) {
            // Less than 4 teams for Gold: direct final between top 2
            matches.push(this.createPlayoffMatch(
                league.id, standings[0].id, standings[1].id, 'Playoff_Gold_F', 1
            ));
        }

        // --- SILVER PLAYOFF (5th-8th) ---
        const silverStart = goldCount;
        const silverEnd = silverStart + silverCount;
        if (standings.length >= silverEnd && silverCount >= 4) {
            // SF: 5th vs 8th, 6th vs 7th
            matches.push(this.createPlayoffMatch(
                league.id, standings[silverStart].id, standings[silverEnd - 1].id, 'Playoff_Silver_SF', 1
            ));
            matches.push(this.createPlayoffMatch(
                league.id, standings[silverStart + 1].id, standings[silverEnd - 2].id, 'Playoff_Silver_SF', 1
            ));
        } else if (standings.length >= silverStart + 2) {
            // Direct final if only 2 teams for Silver
            matches.push(this.createPlayoffMatch(
                league.id, standings[silverStart].id, standings[silverStart + 1].id, 'Playoff_Silver_F', 1
            ));
        }

        if (matches.length > 0) {
            await this.leagueMatchRepository.save(matches);
        }
    }

    /**
     * Handle playoff progression for round_robin_playoff:
     * SF → Final + 3rd place match (losers of SF play for 3rd/4th)
     */
    private async checkRoundRobinPlayoffProgression(league: League) {
        const tiers = ['_Gold', '_Silver'];

        for (const tier of tiers) {
            const sfGroup = `Playoff${tier}_SF`;
            const fGroup = `Playoff${tier}_F`;
            const thirdGroup = `Playoff${tier}_3rd`; // 3rd place match

            const sfMatches = league.matches.filter(m => m.group === sfGroup);
            const fMatches = league.matches.filter(m => m.group === fGroup);
            const thirdMatches = league.matches.filter(m => m.group === thirdGroup);

            // If SF are done but Final + 3rd place don't exist yet
            if (sfMatches.length >= 2 && fMatches.length === 0 && thirdMatches.length === 0) {
                const allSfDone = sfMatches.every(m => m.status === MatchStatus.COMPLETED);
                if (!allSfDone) continue;

                sfMatches.sort((a, b) => a.id.localeCompare(b.id));

                const w1 = sfMatches[0].winnerId;
                const w2 = sfMatches[1].winnerId;
                const l1 = sfMatches[0].team1Id === w1 ? sfMatches[0].team2Id : sfMatches[0].team1Id;
                const l2 = sfMatches[1].team1Id === w2 ? sfMatches[1].team2Id : sfMatches[1].team1Id;

                if (w1 && w2 && l1 && l2) {
                    const newMatches: LeagueMatch[] = [];
                    // Final: Winner SF1 vs Winner SF2
                    newMatches.push(this.createPlayoffMatch(league.id, w1, w2, fGroup, 1));
                    // 3rd place: Loser SF1 vs Loser SF2
                    newMatches.push(this.createPlayoffMatch(league.id, l1, l2, thirdGroup, 1));

                    await this.leagueMatchRepository.save(newMatches);
                }
            }
        }
    }
}
