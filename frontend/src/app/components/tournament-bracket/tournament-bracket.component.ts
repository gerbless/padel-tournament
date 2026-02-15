import {
    Component, Input, AfterViewInit, ElementRef, ViewChild,
    OnChanges, SimpleChanges, ChangeDetectionStrategy, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as go from 'gojs';
import { Tournament, Match, Standing } from '../../services/tournament.service';

@Component({
    selector: 'app-tournament-bracket',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="bracket-wrapper">
            <div class="bracket-toolbar">
                <button class="zoom-btn" (click)="zoomIn()" title="Acercar">➕</button>
                <button class="zoom-btn" (click)="zoomOut()" title="Alejar">➖</button>
                <button class="zoom-btn" (click)="zoomToFit()" title="Ajustar a pantalla">🔲</button>
            </div>
            <div #diagramDiv class="bracket-diagram"></div>
            <div class="bracket-legend">
                <span class="legend-item"><span class="legend-dot champion"></span> Finalizado</span>
                <span class="legend-item"><span class="legend-dot winner"></span> Jugado</span>
                <span class="legend-item"><span class="legend-dot qualifier"></span> En curso</span>
                <span class="legend-item"><span class="legend-dot pending"></span> Pendiente</span>
                <span class="legend-item" style="margin-left: 0.5rem; color: #22c55e;">■ Ganador</span>
                <span class="legend-item" style="color: #ef4444;">■ Perdedor</span>
                <span class="legend-hint">Scroll = Zoom · Arrastra = Mover</span>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
        .bracket-wrapper {
            background: #0d1117;
            border-radius: 0.75rem;
            border: 1px solid rgba(255,255,255,0.08);
            overflow: hidden;
            position: relative;
        }
        .bracket-toolbar {
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
            z-index: 10;
            display: flex;
            gap: 0.375rem;
        }
        .zoom-btn {
            width: 36px;
            height: 36px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(22, 27, 34, 0.9);
            color: #e5e7eb;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            backdrop-filter: blur(8px);
        }
        .zoom-btn:hover {
            background: rgba(16, 185, 129, 0.2);
            border-color: #10b981;
        }
        .bracket-diagram {
            width: 100%;
            height: 75vh;
            min-height: 650px;
        }
        .bracket-legend {
            display: flex;
            gap: 1.25rem;
            padding: 0.75rem 1.25rem;
            border-top: 1px solid rgba(255,255,255,0.06);
            flex-wrap: wrap;
            justify-content: center;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            font-size: 0.75rem;
            color: #9ca3af;
        }
        .legend-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }
        .legend-dot.champion { background: #10b981; }
        .legend-dot.winner   { background: #22c55e; }
        .legend-dot.qualifier{ background: #3b82f6; }
        .legend-dot.pending  { background: #6b7280; }
        .legend-dot.loser    { background: #ef4444; }
        .legend-hint {
            font-size: 0.7rem;
            color: #6b7280;
            font-style: italic;
            margin-left: auto;
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentBracketComponent implements AfterViewInit, OnChanges, OnDestroy {
    @ViewChild('diagramDiv') diagramDiv!: ElementRef;
    @Input() tournament!: Tournament;
    @Input() standings: Standing[] = [];

    private diagram: go.Diagram | null = null;

    ngAfterViewInit() {
        this.initDiagram();
        this.updateBracket();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (this.diagram && (changes['tournament'] || changes['standings'])) {
            this.updateBracket();
        }
    }

    ngOnDestroy() {
        if (this.diagram) {
            this.diagram.div = null;
            this.diagram = null;
        }
    }

    // ────── Zoom controls ──────

    zoomIn() {
        if (!this.diagram) return;
        this.diagram.autoScale = go.AutoScale.None;
        this.diagram.scale *= 1.3;
    }

    zoomOut() {
        if (!this.diagram) return;
        this.diagram.autoScale = go.AutoScale.None;
        this.diagram.scale *= 0.7;
    }

    zoomToFit() {
        if (!this.diagram) return;
        this.diagram.autoScale = go.AutoScale.Uniform;
        this.diagram.zoomToFit();
    }

    // ────── GoJS Initialization ──────

    private statusColor(status: string): string {
        switch (status) {
            case 'champion': return '#10b981';
            case 'winner': return '#22c55e';
            case 'loser': return '#ef4444';
            case 'qualifier': return '#3b82f6';
            case 'pending': default: return '#6b7280';
        }
    }

    private initDiagram() {
        this.diagram = new go.Diagram(this.diagramDiv.nativeElement, {
            layout: new go.TreeLayout({
                angle: 90,
                layerSpacing: 70,
                nodeSpacing: 40,
                arrangement: go.TreeArrangement.Horizontal,
                compaction: go.TreeCompaction.None,
            }),
            isReadOnly: true,
            allowSelect: false,
            allowZoom: true,
            allowHorizontalScroll: true,
            allowVerticalScroll: true,
            scrollMode: go.ScrollMode.Infinite,
            'animationManager.isEnabled': true,
            'animationManager.duration': 500,
            padding: new go.Margin(40, 30, 20, 30),
            autoScale: go.AutoScale.Uniform,
            contentAlignment: go.Spot.Top,
            'toolManager.mouseWheelBehavior': go.WheelMode.Zoom,
        });

        // Disable autoScale on manual mouse-wheel zoom
        this.diagram.addDiagramListener('ViewportBoundsChanged', (e) => {
            if (e.diagram.autoScale !== go.AutoScale.None) {
                // only disable once user interacts
            }
        });
        this.diagramDiv.nativeElement.addEventListener('wheel', () => {
            if (this.diagram) this.diagram.autoScale = go.AutoScale.None;
        }, { passive: true });

        const statusColor = this.statusColor.bind(this);

        // ── Node template — each node = one match ──
        this.diagram.nodeTemplate = new go.Node('Auto', {
            isShadowed: true,
            shadowOffset: new go.Point(1, 3),
            shadowColor: 'rgba(0,0,0,0.5)',
            shadowBlur: 10,
        }).add(
            // Outer shape
            new go.Shape('RoundedRectangle', {
                fill: '#161b22',
                strokeWidth: 2,
                parameter1: 8,
            }).bind('stroke', 'status', (s: string) => statusColor(s)),

            new go.Panel('Horizontal', {
                margin: new go.Margin(0, 0, 0, 0),
            }).add(
                // Left accent bar
                new go.Shape('Rectangle', {
                    width: 5,
                    stretch: go.Stretch.Vertical,
                    strokeWidth: 0,
                }).bind('fill', 'status', (s: string) => statusColor(s)),

                new go.Panel('Vertical', {
                    margin: new go.Margin(10, 14, 10, 10),
                    defaultAlignment: go.Spot.Left,
                }).add(
                    // Round / phase label
                    new go.TextBlock({
                        font: 'bold 9px "Inter", "Segoe UI", sans-serif',
                        margin: new go.Margin(0, 0, 4, 0),
                    })
                        .bind('text', 'roundLabel')
                        .bind('stroke', 'status', (s: string) => statusColor(s)),

                    // Team 1 name
                    new go.TextBlock({
                        font: 'bold 12px "Inter", "Segoe UI", sans-serif',
                        stroke: '#e5e7eb',
                        maxSize: new go.Size(240, NaN),
                        wrap: go.Wrap.Fit,
                    }).bind('text', 'team1')
                        .bind('stroke', 'team1Status', (s: string) => s === 'winner' ? '#22c55e' : s === 'loser' ? '#ef4444' : '#e5e7eb'),

                    // VS separator
                    new go.TextBlock({
                        text: 'VS',
                        font: 'bold 10px "Inter", "Segoe UI", sans-serif',
                        stroke: '#6b7280',
                        margin: new go.Margin(3, 0, 3, 0),
                    }),

                    // Team 2 name
                    new go.TextBlock({
                        font: 'bold 12px "Inter", "Segoe UI", sans-serif',
                        stroke: '#e5e7eb',
                        maxSize: new go.Size(240, NaN),
                        wrap: go.Wrap.Fit,
                    }).bind('text', 'team2')
                        .bind('stroke', 'team2Status', (s: string) => s === 'winner' ? '#22c55e' : s === 'loser' ? '#ef4444' : '#e5e7eb'),

                    // Score
                    new go.TextBlock({
                        font: 'bold 13px "Inter", "Segoe UI", sans-serif',
                        margin: new go.Margin(5, 0, 0, 0),
                    })
                        .bind('text', 'score')
                        .bind('stroke', 'status', (s: string) => statusColor(s))
                        .bind('visible', 'score', (s: string) => !!s),

                    // Court info
                    new go.TextBlock({
                        font: '9px "Inter", "Segoe UI", sans-serif',
                        stroke: '#6b7280',
                        margin: new go.Margin(3, 0, 0, 0),
                    })
                        .bind('text', 'courtInfo')
                        .bind('visible', 'courtInfo', (s: string) => !!s),
                ),
            ),
        );

        // ── Link template ──
        this.diagram.linkTemplate = new go.Link({
            routing: go.Routing.Orthogonal,
            corner: 6,
            selectable: false,
        }).add(
            new go.Shape({
                strokeWidth: 2,
                stroke: '#30363d',
            }),
        );
    }

    // ────── Data building ──────

    private updateBracket() {
        if (!this.diagram || !this.tournament) return;
        const nodes = this.buildBracketData();
        this.diagram.model = new go.TreeModel(nodes);
    }

    private buildBracketData(): any[] {
        const elimMatches = this.tournament.matches.filter(m => m.phase === 'elimination');

        if (elimMatches.length > 0) {
            return this.buildEliminationBracket(elimMatches);
        }

        // No elimination yet — show round-robin matches as bracket
        return this.buildMatchBracket();
    }

    // ── Bracket from actual elimination matches ──

    private buildEliminationBracket(elimMatches: Match[]): any[] {
        const nodes: any[] = [];
        const semis = elimMatches.filter(m => m.round === 1).sort((a, b) => (a.courtNumber || 0) - (b.courtNumber || 0));
        const finals = elimMatches.filter(m => m.round === 2);

        // ─ Champion root ─
        if (finals.length > 0 && finals[0].winnerId) {
            const f = finals[0];
            nodes.push(this.matchNode('champion', undefined, f, 'CAMPEÓN — 🏆 FINAL'));
        } else if (finals.length > 0) {
            const f = finals[0];
            nodes.push(this.matchNode('final', undefined, f, 'FINAL'));
        } else {
            // No final match yet — show placeholder
            const w1 = semis[0]?.winnerId ? this.teamName(semis[0].winnerId) : '?';
            const w2 = semis[1]?.winnerId ? this.teamName(semis[1].winnerId) : '?';
            nodes.push({
                key: 'final', team1: w1, team2: w2,
                team1Status: 'neutral', team2Status: 'neutral',
                score: '', courtInfo: '', status: 'pending',
                roundLabel: 'FINAL (por definir)',
            });
        }

        const parentKey = finals.length > 0 ? (finals[0].winnerId ? 'champion' : 'final') : 'final';

        // ─ Semifinals ─
        for (let i = 0; i < semis.length; i++) {
            nodes.push(this.matchNode(`semi-${i}`, parentKey, semis[i], `SEMIFINAL ${i + 1}`));
        }

        return nodes;
    }

    // ── Bracket from round-robin (each node = a match) ──

    private buildMatchBracket(): any[] {
        const nodes: any[] = [];
        const groupMatches = this.tournament.matches.filter(m => m.phase === 'group');
        const totalGroupMatches = groupMatches.length;
        const completedGroupMatches = groupMatches.filter(m => m.sets && m.sets.length > 0).length;
        const progressPct = totalGroupMatches > 0 ? Math.round((completedGroupMatches / totalGroupMatches) * 100) : 0;
        const allDone = completedGroupMatches === totalGroupMatches && totalGroupMatches > 0;
        const noneStarted = completedGroupMatches === 0;

        // Get unique rounds sorted
        const rounds = [...new Set(groupMatches.map(m => m.round || 0))].sort((a, b) => a - b);

        if (rounds.length === 0) {
            nodes.push({
                key: 'empty', team1: 'Sin partidos', team2: 'programados',
                team1Status: 'neutral', team2Status: 'neutral',
                score: '', courtInfo: '', status: 'pending', roundLabel: '',
            });
            return nodes;
        }

        // Root: progress summary
        const rootStatus = allDone ? 'champion' : noneStarted ? 'pending' : 'qualifier';
        const rootLabel = allDone ? 'CLASIFICACIÓN FINAL' : noneStarted ? 'TORNEO POR INICIAR' : `EN CURSO — ${progressPct}%`;
        const st = this.standings;
        const rootTeam1 = allDone && st.length > 0
            ? `🏆 1° ${st[0].player1Name} & ${st[0].player2Name}`
            : noneStarted
                ? `${totalGroupMatches} partidos`
                : `${completedGroupMatches}/${totalGroupMatches} jugados`;
        const rootTeam2 = allDone && st.length > 1
            ? `🥈 2° ${st[1].player1Name} & ${st[1].player2Name}`
            : '';

        nodes.push({
            key: 'root', team1: rootTeam1, team2: rootTeam2,
            team1Status: 'neutral', team2Status: 'neutral',
            score: '', courtInfo: '', status: rootStatus, roundLabel: rootLabel,
        });

        // Create a node per round
        for (const r of rounds) {
            const roundMatches = groupMatches
                .filter(m => m.round === r)
                .sort((a, b) => (a.courtNumber || 0) - (b.courtNumber || 0));

            const completed = roundMatches.filter(m => m.sets && m.sets.length > 0).length;
            const total = roundMatches.length;
            const roundDone = completed === total;
            const roundStatus = roundDone && total > 0 ? 'winner' : completed > 0 ? 'qualifier' : 'pending';
            const roundInfo = roundDone ? `✅ ${total} partidos completados` : `${completed}/${total} completados`;

            nodes.push({
                key: `round-${r}`, parent: 'root',
                team1: `Ronda ${r}`, team2: roundInfo,
                team1Status: 'neutral', team2Status: 'neutral',
                score: '', courtInfo: '', status: roundStatus,
                roundLabel: `RONDA ${r}`,
            });

            // Each match in this round
            for (const m of roundMatches) {
                nodes.push(this.matchNode(`m-${m.id}`, `round-${r}`, m,
                    `R${r} · Cancha ${m.courtNumber || '?'}${m.groupNumber ? ` · Grupo ${m.groupNumber}` : ''}`
                ));
            }
        }

        return nodes;
    }

    // ── Build a match node ──

    private matchNode(key: string, parent: string | undefined, match: Match, label: string): any {
        const t1Name = this.teamName(match.team1Id);
        const t2Name = this.teamName(match.team2Id);
        const hasResult = match.sets && match.sets.length > 0;
        const score = hasResult
            ? match.sets!.map(s => `${s.team1Games}-${s.team2Games}`).join(', ')
            : '';

        let status = 'pending';
        let t1Status = 'neutral';
        let t2Status = 'neutral';

        if (hasResult) {
            if (match.winnerId === match.team1Id) {
                status = 'winner'; t1Status = 'winner'; t2Status = 'loser';
            } else if (match.winnerId === match.team2Id) {
                status = 'winner'; t1Status = 'loser'; t2Status = 'winner';
            } else {
                status = 'qualifier'; t1Status = 'neutral'; t2Status = 'neutral'; // draw
            }
        }

        const courtInfo = match.courtNumber ? `Cancha ${match.courtNumber}` : '';

        const node: any = {
            key, team1: t1Name, team2: t2Name,
            team1Status: t1Status, team2Status: t2Status,
            score, courtInfo, status, roundLabel: label,
        };
        if (parent) node.parent = parent;
        return node;
    }

    // ────── Helpers ──────

    private teamName(teamId: string): string {
        const team = this.tournament.teams.find(t => t.id === teamId);
        if (!team) return '?';
        return `${team.player1?.name} & ${team.player2?.name}`;
    }
}
