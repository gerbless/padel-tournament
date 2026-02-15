import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import {
    League,
    CreateLeagueRequest,
    UpdateMatchResultRequest,
    Match,
    Pair,
    Group,
    MatchResult
} from '../../../models/league.model';
import { environment } from '../../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class LeagueService {
    private apiUrl = `${environment.apiUrl}/leagues`;
    private leaguesSubject = new BehaviorSubject<League[]>([]);
    public leagues$ = this.leaguesSubject.asObservable();

    constructor(private http: HttpClient) { }

    // CRUD Operations
    getLeagues(clubId?: string): Observable<League[]> {
        const params: any = {};
        if (clubId) params.clubId = clubId;
        return this.http.get<any>(this.apiUrl, { params }).pipe(
            map(res => Array.isArray(res) ? res : res.data),
            tap(leagues => this.leaguesSubject.next(leagues))
        );
    }

    getLeagueById(id: string): Observable<League> {
        return this.http.get<League>(`${this.apiUrl}/${id}`);
    }

    createLeague(data: CreateLeagueRequest): Observable<League> {
        return this.http.post<League>(this.apiUrl, data).pipe(
            tap(() => this.getLeagues().subscribe())
        );
    }

    updateLeague(id: string, data: Partial<League>): Observable<League> {
        return this.http.put<League>(`${this.apiUrl}/${id}`, data).pipe(
            tap(() => this.getLeagues().subscribe())
        );
    }

    completeLeague(id: string): Observable<League> {
        return this.http.post<League>(`${this.apiUrl}/${id}/complete`, {});
    }

    generateTieBreaker(id: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/${id}/tie-breaker`, {});
    }

    deleteLeague(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
            tap(() => this.getLeagues().subscribe())
        );
    }

    // Match management
    updateMatchResult(leagueId: string, matchId: string, result: MatchResult): Observable<Match> {
        return this.http.patch<Match>(
            `${this.apiUrl}/${leagueId}/matches/${matchId}/result`,
            result
        );
    }

    // Schedule generation
    generateSchedule(leagueId: string): Observable<Match[]> {
        return this.http.post<Match[]>(`${this.apiUrl}/${leagueId}/generate-schedule`, {});
    }

    // Match suggestions
    suggestNextMatch(leagueId: string): Observable<Match> {
        return this.http.get<Match>(`${this.apiUrl}/${leagueId}/suggest-next-match`);
    }

    // Local utility functions for client-side validation/preview

    /**
     * Generate all possible pair combinations (Round Robin)
     * For n pairs, generates n*(n-1)/2 matches per round
     */
    generateRoundRobinMatches(pairs: Pair[], rounds: number): Match[] {
        const matches: Match[] = [];
        let matchId = 0;

        for (let round = 1; round <= rounds; round++) {
            for (let i = 0; i < pairs.length; i++) {
                for (let j = i + 1; j < pairs.length; j++) {
                    matches.push({
                        id: `temp-${matchId++}`,
                        leagueId: '',
                        round,
                        pairA: pairs[i],
                        pairB: pairs[j],
                        status: 'scheduled',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
            }
        }

        return this.balanceMatches(matches);
    }

    /**
     * Balance matches by strength (weak vs strong pairs)
     * Sorts matches within each round to promote competitive balance
     */
    private balanceMatches(matches: Match[]): Match[] {
        const rounds = new Map<number, Match[]>();

        // Group by round
        matches.forEach(match => {
            if (!rounds.has(match.round)) {
                rounds.set(match.round, []);
            }
            rounds.get(match.round)!.push(match);
        });

        // Sort each round: pair weakest with strongest
        rounds.forEach((roundMatches, roundNum) => {
            roundMatches.sort((a, b) => {
                const strengthDiffA = Math.abs(a.pairA.points - a.pairB.points);
                const strengthDiffB = Math.abs(b.pairA.points - b.pairB.points);
                return strengthDiffB - strengthDiffA; // Descending: biggest diff first
            });
        });

        // Flatten back to array
        return Array.from(rounds.values()).flat();
    }

    /**
     * Generate groups and matches for Groups + Playoffs format
     */
    generateGroupsAndMatches(pairs: Pair[], numberOfGroups: number): { groups: Group[], matches: Match[] } {
        // Shuffle pairs for random distribution
        const shuffled = this.shuffle([...pairs]);

        const groups: Group[] = [];
        const pairsPerGroup = Math.ceil(shuffled.length / numberOfGroups);

        // Create groups
        for (let i = 0; i < numberOfGroups; i++) {
            const groupPairs = shuffled.slice(i * pairsPerGroup, (i + 1) * pairsPerGroup);
            groups.push({
                id: `group-${i}`,
                name: `Grupo ${String.fromCharCode(65 + i)}`, // A, B, C, ...
                pairs: groupPairs,
                matches: []
            });
        }

        // Generate round-robin matches within each group
        const matches: Match[] = [];
        let matchId = 0;

        groups.forEach(group => {
            const groupMatches: Match[] = [];

            for (let i = 0; i < group.pairs.length; i++) {
                for (let j = i + 1; j < group.pairs.length; j++) {
                    const match: Match = {
                        id: `temp-${matchId++}`,
                        leagueId: '',
                        round: 1,
                        pairA: group.pairs[i],
                        pairB: group.pairs[j],
                        status: 'scheduled',
                        groupId: group.id,
                        phase: 'group',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    groupMatches.push(match);
                    matches.push(match);
                }
            }

            group.matches = groupMatches;
        });

        return { groups, matches };
    }

    /**
     * Generate playoff bracket from group winners
     */
    generatePlayoffBracket(groups: Group[], teamsPerGroup: number): Match[] {
        const qualifiers: Pair[] = [];

        // Get top N pairs from each group
        groups.forEach(group => {
            const sorted = [...group.pairs].sort((a, b) => b.points - a.points);
            qualifiers.push(...sorted.slice(0, teamsPerGroup));
        });

        // Generate bracket (quarters, semis, final)
        const matches: Match[] = [];
        let matchId = 0;

        // Quarterfinals (if 8 teams)
        if (qualifiers.length === 8) {
            for (let i = 0; i < 4; i++) {
                matches.push({
                    id: `playoff-qf-${matchId++}`,
                    leagueId: '',
                    round: 1,
                    pairA: qualifiers[i],
                    pairB: qualifiers[7 - i],
                    status: 'scheduled',
                    phase: 'quarterfinal',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }

        // Semifinals (placeholder, will be filled after QF)
        const semiCount = qualifiers.length === 8 ? 2 : Math.min(qualifiers.length / 2, 2);
        for (let i = 0; i < semiCount; i++) {
            matches.push({
                id: `playoff-sf-${matchId++}`,
                leagueId: '',
                round: 2,
                pairA: qualifiers[0], // Placeholder
                pairB: qualifiers[1], // Placeholder
                status: 'scheduled',
                phase: 'semifinal',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        // Final
        matches.push({
            id: `playoff-final-${matchId++}`,
            leagueId: '',
            round: 3,
            pairA: qualifiers[0], // Placeholder
            pairB: qualifiers[1], // Placeholder
            status: 'scheduled',
            phase: 'final',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return matches;
    }

    /**
     * Fisher-Yates shuffle algorithm
     */
    private shuffle<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Validate match score (best of 3 sets, 6 games, tie-break rules)
     */
    validateMatchResult(result: MatchResult, config: any): { valid: boolean, error?: string } {
        if (!result.sets || result.sets.length === 0) {
            return { valid: false, error: 'Debe ingresar al menos un set' };
        }

        if (result.sets.length > 3) {
            return { valid: false, error: 'Máximo 3 sets permitidos' };
        }

        // Count sets won by each pair
        let pairAWins = 0;
        let pairBWins = 0;

        for (let i = 0; i < result.sets.length; i++) {
            const set = result.sets[i];

            // Validate set score
            if (set.pairAGames === set.pairBGames) {
                return { valid: false, error: `Set ${i + 1}: No puede haber empate en games` };
            }

            // Check for valid set scores
            const maxGames = Math.max(set.pairAGames, set.pairBGames);
            const minGames = Math.min(set.pairAGames, set.pairBGames);

            if (maxGames < 6) {
                return { valid: false, error: `Set ${i + 1}: Se requieren al menos 6 games para ganar` };
            }

            if (maxGames === 6 && minGames === 6) {
                // Tie-break required at 6-6
                if (!set.tiebreak) {
                    return { valid: false, error: `Set ${i + 1}: Falta resultado del tie-break (6-6)` };
                }
            } else if (maxGames === 7 && minGames < 5) {
                return { valid: false, error: `Set ${i + 1}: Score inválido` };
            } else if (maxGames > 7) {
                return { valid: false, error: `Set ${i + 1}: Máximo 7 games por set` };
            }

            // Count winner
            if (set.pairAGames > set.pairBGames) {
                pairAWins++;
            } else {
                pairBWins++;
            }
        }

        // Check if match should be finished
        if (Math.max(pairAWins, pairBWins) < 2) {
            return { valid: false, error: 'Se requieren al menos 2 sets ganados' };
        }

        return { valid: true };
    }
}
