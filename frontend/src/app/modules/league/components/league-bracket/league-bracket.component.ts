import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { League, Match, Pair } from '../../../../models/league.model';

interface BracketNode {
    matchId: string;
    round: number;
    position: number;
    pairA: Pair | null;
    pairB: Pair | null;
    scoreA: string;
    scoreB: string;
    winnerId: string | null;
    status: string;
    label: string;
    group: string;
    isPlayoff: boolean;
}

interface BracketRound {
    label: string;
    sublabel?: string;
    nodes: BracketNode[];
    isPlayoff: boolean;
}

interface BracketSection {
    title: string;
    titleIcon: string;
    cssClass: string;
    rounds: BracketRound[];
    champion: Pair | null;
}

@Component({
    selector: 'app-league-bracket',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './league-bracket.component.html',
    styleUrls: ['./league-bracket.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeagueBracketComponent implements OnChanges {
    @Input() league!: League;

    sections: BracketSection[] = [];
    totalMatches = 0;
    completedMatches = 0;

    constructor(private cdr: ChangeDetectorRef) {}

    ngOnChanges(changes: SimpleChanges) {
        if (changes['league'] && this.league) {
            this.buildBracket();
            this.cdr.markForCheck();
        }
    }

    private buildBracket() {
        this.sections = [];
        if (!this.league?.matches?.length) return;

        this.totalMatches = this.league.matches.length;
        this.completedMatches = this.league.matches.filter(m => m.status === 'completed').length;

        // Separate match types
        const regularMatches = this.league.matches.filter(m =>
            !m.group || (!m.group.includes('Playoff') && m.group !== 'TieBreaker'));
        const playoffMatches = this.league.matches.filter(m => m.group && m.group.includes('Playoff'));
        const tieBreakerMatches = this.league.matches.filter(m => m.group === 'TieBreaker');

        // 1) FASE REGULAR
        if (regularMatches.length > 0) {
            const regularSection = this.buildRegularSection(regularMatches);
            if (regularSection.rounds.length > 0) {
                this.sections.push(regularSection);
            }
        }

        // 2) TIE BREAKERS
        if (tieBreakerMatches.length > 0) {
            this.sections.push(this.buildTieBreakerSection(tieBreakerMatches));
        }

        // 3) PLAYOFFS
        if (playoffMatches.length > 0) {
            const hasGold = playoffMatches.some(m => m.group?.includes('_Gold_'));
            const hasSilver = playoffMatches.some(m => m.group?.includes('_Silver_'));
            const hasBronze = playoffMatches.some(m => m.group?.includes('_Bronze_'));

            if (hasGold || hasSilver || hasBronze) {
                if (hasGold) {
                    this.sections.push(this.buildPlayoffSection('Copa Oro', '🥇', 'gold',
                        playoffMatches.filter(m => m.group?.includes('_Gold_'))));
                }
                if (hasSilver) {
                    this.sections.push(this.buildPlayoffSection('Copa Plata', '🥈', 'silver',
                        playoffMatches.filter(m => m.group?.includes('_Silver_'))));
                }
                if (hasBronze) {
                    this.sections.push(this.buildPlayoffSection('Copa Bronce', '🥉', 'bronze',
                        playoffMatches.filter(m => m.group?.includes('_Bronze_'))));
                }
            } else {
                this.sections.push(this.buildPlayoffSection('Playoffs', '🏆', 'single', playoffMatches));
            }
        }
    }

    // ── Regular Phase ─────────────────────────────────────
    private buildRegularSection(matches: Match[]): BracketSection {
        const rounds: BracketRound[] = [];
        const hasGroups = this.league.type === 'groups_playoff';

        // Group by round number
        const roundMap = new Map<number, Match[]>();
        matches.forEach(m => {
            const r = Number(m.round) || 1;
            if (!roundMap.has(r)) roundMap.set(r, []);
            roundMap.get(r)!.push(m);
        });

        const sortedRounds = Array.from(roundMap.keys()).sort((a, b) => a - b);

        for (const roundNum of sortedRounds) {
            const roundMatches = roundMap.get(roundNum)!;
            const completedInRound = roundMatches.filter(m => m.status === 'completed').length;

            let sublabel = `${completedInRound}/${roundMatches.length} jugados`;
            if (hasGroups) {
                const groups = new Set(
                    roundMatches.map(m => (m as any).group || (m as any).groupId || '').filter((g: string) => g && !g.includes('Playoff'))
                );
                if (groups.size > 0) {
                    sublabel = Array.from(groups).sort().map(g => `Grupo ${g}`).join(' · ');
                }
            }

            rounds.push({
                label: `Ronda ${roundNum}`,
                sublabel,
                nodes: roundMatches.map((m, i) => this.matchToNode(m, roundNum, i,
                    this.getRegularLabel(m, i, hasGroups), false)),
                isPlayoff: false
            });
        }

        return {
            title: hasGroups ? 'Fase de Grupos' : 'Fase Regular',
            titleIcon: '📋',
            cssClass: 'regular',
            rounds,
            champion: null
        };
    }

    private getRegularLabel(match: Match, index: number, hasGroups: boolean): string {
        if (hasGroups) {
            const group = (match as any).group || (match as any).groupId || '';
            if (group && !group.includes('Playoff')) return `Grupo ${group}`;
        }
        return `P${index + 1}`;
    }

    // ── Tie Breaker ───────────────────────────────────────
    private buildTieBreakerSection(matches: Match[]): BracketSection {
        return {
            title: 'Desempate',
            titleIcon: '⚖️',
            cssClass: 'tiebreaker',
            rounds: [{
                label: 'Desempate',
                nodes: matches.map((m, i) => this.matchToNode(m, 1, i, `Desempate ${i + 1}`, false)),
                isPlayoff: false
            }],
            champion: null
        };
    }

    // ── Playoff Phase ─────────────────────────────────────
    private buildPlayoffSection(title: string, titleIcon: string, cssClass: string, matches: Match[]): BracketSection {
        const qfMatches = matches.filter(m => m.group?.includes('QF')).sort((a, b) => a.round - b.round);
        const sfMatches = matches.filter(m => m.group?.includes('SF')).sort((a, b) => a.round - b.round);
        const finalMatch = matches.find(m =>
            m.group?.includes('_F') && !m.group?.includes('SF') && !m.group?.includes('QF') && !m.group?.includes('3rd'));
        const thirdPlaceMatch = matches.find(m => m.group?.includes('3rd'));

        const rounds: BracketRound[] = [];

        if (qfMatches.length > 0) {
            rounds.push({
                label: 'Cuartos de Final',
                nodes: qfMatches.map((m, i) => this.matchToNode(m, 1, i, `CF ${i + 1}`, true)),
                isPlayoff: true
            });
        }

        if (sfMatches.length > 0) {
            const roundNum = qfMatches.length > 0 ? 2 : 1;
            rounds.push({
                label: 'Semifinal',
                nodes: sfMatches.map((m, i) => this.matchToNode(m, roundNum, i, `SF ${i + 1}`, true)),
                isPlayoff: true
            });
        }

        if (finalMatch) {
            const roundNum = (qfMatches.length > 0 ? 2 : 0) + (sfMatches.length > 0 ? 1 : 0) + 1;
            const finalRound: BracketRound = {
                label: 'Final',
                nodes: [this.matchToNode(finalMatch, roundNum, 0, 'Final', true)],
                isPlayoff: true
            };
            if (thirdPlaceMatch) {
                finalRound.nodes.push(this.matchToNode(thirdPlaceMatch, roundNum, 1, '3er Puesto', true));
            }
            rounds.push(finalRound);
        } else if (thirdPlaceMatch) {
            rounds.push({
                label: 'Tercer Puesto',
                nodes: [this.matchToNode(thirdPlaceMatch, 1, 0, '3er Puesto', true)],
                isPlayoff: true
            });
        }

        let champion: Pair | null = null;
        if (finalMatch?.status === 'completed' && finalMatch.result?.winnerPairId) {
            const wId = finalMatch.result.winnerPairId;
            champion = (finalMatch.pairA?.id === wId ? finalMatch.pairA
                : finalMatch.pairB?.id === wId ? finalMatch.pairB : null) as Pair | null;
        }

        return { title, titleIcon, cssClass, rounds, champion };
    }

    // ── Node builder ──────────────────────────────────────
    private matchToNode(match: Match, round: number, position: number, label: string, isPlayoff: boolean): BracketNode {
        return {
            matchId: match.id,
            round,
            position,
            pairA: match.pairA || null,
            pairB: match.pairB || null,
            scoreA: this.formatScore(match, 'A'),
            scoreB: this.formatScore(match, 'B'),
            winnerId: match.result?.winnerPairId || null,
            status: match.status,
            label,
            group: match.group || '',
            isPlayoff
        };
    }

    private formatScore(match: Match, side: 'A' | 'B'): string {
        if (!match.result?.sets?.length) return '';
        return match.result.sets.map(s =>
            side === 'A' ? s.pairAGames.toString() : s.pairBGames.toString()
        ).join(' - ');
    }

    // ── Template helpers ──────────────────────────────────
    getPairName(pair: Pair | null): string {
        if (!pair) return 'Por definir';
        const p1 = (pair as any).playerA || (pair as any).player1;
        const p2 = (pair as any).playerB || (pair as any).player2;
        if (p1 && p2) return `${this.shortName(p1)} / ${this.shortName(p2)}`;
        return 'Por definir';
    }

    private shortName(player: any): string {
        if (!player?.name) return '?';
        const parts = player.name.split(' ');
        if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
        return parts[0];
    }

    isWinner(node: BracketNode, side: 'A' | 'B'): boolean {
        if (!node.winnerId) return false;
        const pair = side === 'A' ? node.pairA : node.pairB;
        return pair?.id === node.winnerId;
    }

    isLoser(node: BracketNode, side: 'A' | 'B'): boolean {
        if (!node.winnerId) return false;
        return !this.isWinner(node, side);
    }

    getNodeSpacing(section: BracketSection, roundIndex: number): number {
        if (!section.rounds[0]?.isPlayoff) return 0;
        if (roundIndex === 0) return 0;
        return Math.pow(2, roundIndex) - 1;
    }

    get progressPercent(): number {
        if (this.totalMatches === 0) return 0;
        return Math.round((this.completedMatches / this.totalMatches) * 100);
    }
}
