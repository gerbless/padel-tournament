import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { PlayerSelectComponent } from '../player-select/player-select.component';
import { PlayerCreateModalComponent } from '../player-create-modal/player-create-modal.component';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TournamentService, DurationMode } from '../../services/tournament.service';
import { PlayerService, Player } from '../../services/player.service';
import { ClubService } from '../../services/club.service';
import { Club } from '../../models/club.model';
import { Subscription } from 'rxjs';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-tournament-create',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, PlayerSelectComponent, PlayerCreateModalComponent],
    templateUrl: './tournament-create.component.html',
    styleUrls: ['./tournament-create.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentCreateComponent implements OnInit, OnDestroy {
    // Wizard state — 6 steps
    currentStep = 1;
    readonly totalSteps = 6;

    // Form
    tournamentForm: FormGroup;
    submitting = false;

    // Players & clubs
    existingPlayers: Player[] = [];
    currentClubId: string | null = null;
    currentClubName: string = '';
    private clubSubscription?: Subscription;

    // Cached computed values
    cachedCourts = 1;
    cachedCourtNumbers: number[] = [1];
    cachedTotalGroups = 1;
    cachedGroupNumbers: number[] = [1];
    cachedTeamsByGroup: Map<number, { index: number; control: AbstractControl }[]> = new Map();

    /** User-controlled flag: whether to use groups */
    useGroups = false;

    /** User-controlled flag: automatic rounds (all-vs-all) vs custom matchesPerTeam */
    autoRounds = true;

    get durationMode(): DurationMode {
        return this.tournamentForm.get('durationMode')?.value || 'free';
    }

    get totalTeams(): number {
        return this.teams.length;
    }

    constructor(
        private fb: FormBuilder,
        private tournamentService: TournamentService,
        private playerService: PlayerService,
        private router: Router,
        private clubService: ClubService,
        private cdr: ChangeDetectorRef,
        private toast: ToastService
    ) {
        this.tournamentForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            courts: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
            matchesPerTeam: [0, [Validators.required, Validators.min(0), Validators.max(30)]],
            totalGroups: [1, [Validators.required, Validators.min(1)]],
            durationMode: ['free', Validators.required],
            durationMinutes: [90],
            config: this.fb.group({
                scoringMode: ['flexible', Validators.required],
            }),
            teams: this.fb.array([])
        });
    }

    ngOnInit() {
        this.clubSubscription = this.clubService.selectedClub$.subscribe((club: Club | null) => {
            this.currentClubId = club?.id || null;
            this.currentClubName = club?.name || 'Sin club';
            this.cdr.markForCheck();
        });
        this.loadPlayers();
        // Start with 4 empty teams
        this.ensureMinTeams();
    }

    ngOnDestroy() {
        this.clubSubscription?.unsubscribe();
    }

    loadPlayers() {
        this.playerService.findAll().subscribe({
            next: (players: Player[]) => {
                this.existingPlayers = players;
                this.cdr.markForCheck();
            },
            error: (err: any) => console.error('Error loading players:', err)
        });
    }

    get teams(): FormArray {
        return this.tournamentForm.get('teams') as FormArray;
    }

    // ===================== WIZARD NAVIGATION =====================
    nextStep() {
        if (this.isStepValid()) {
            if (this.currentStep === 4 && !this.useGroups) {
                this.cachedTotalGroups = 1;
                this.cachedGroupNumbers = [1];
                this.tournamentForm.get('totalGroups')?.setValue(1);
                // Reset all teams to group 1
                for (let i = 0; i < this.teams.length; i++) {
                    this.teams.at(i).get('groupNumber')?.setValue(1);
                }
                this.rebuildTeamsByGroupCache();
            }
            this.currentStep = Math.min(this.currentStep + 1, this.totalSteps);
            // Skip group config step (5) if user chose no groups
            if (this.currentStep === 5 && !this.useGroups) {
                this.currentStep = 6;
            }
            this.cdr.markForCheck();
        }
    }

    prevStep() {
        this.currentStep = Math.max(this.currentStep - 1, 1);
        if (this.currentStep === 5 && !this.useGroups) {
            this.currentStep = 4;
        }
        this.cdr.markForCheck();
    }

    goToStep(step: number) {
        if (step <= this.currentStep) {
            if (step === 5 && !this.useGroups) return;
            this.currentStep = step;
            this.cdr.markForCheck();
        }
    }

    isStepValid(): boolean {
        switch (this.currentStep) {
            case 1: return this.tournamentForm.get('name')?.valid || false;
            case 2: return this.teams.valid && this.teams.length >= 2;
            case 3: return true;
            case 4: return true;
            case 5: return true;
            case 6: return true;
            default: return true;
        }
    }

    getStepLabel(step: number): string {
        switch (step) {
            case 1: return 'Nombre';
            case 2: return 'Parejas';
            case 3: return 'Canchas';
            case 4: return 'Rondas';
            case 5: return 'Grupos';
            case 6: return 'Reglas';
            default: return '';
        }
    }

    isStepVisible(step: number): boolean {
        if (step === 5 && !this.useGroups) return false;
        return true;
    }

    // ===================== COURTS CHANGE =====================
    incrementCourts() {
        const current = this.tournamentForm.get('courts')?.value || 1;
        if (current < 10) {
            this.tournamentForm.get('courts')?.setValue(current + 1);
            this.onCourtsChange();
        }
    }

    decrementCourts() {
        const current = this.tournamentForm.get('courts')?.value || 1;
        if (current > 1) {
            this.tournamentForm.get('courts')?.setValue(current - 1);
            this.onCourtsChange();
        }
    }

    onCourtsChange() {
        const newCourts = this.tournamentForm.get('courts')?.value || 1;
        this.cachedCourts = newCourts;
        this.cachedCourtNumbers = Array.from({ length: newCourts }, (_, i) => i + 1);
        this.cdr.markForCheck();
    }

    // ===================== GROUPS CHANGE =====================
    toggleGroups(enable: boolean) {
        this.useGroups = enable;
        if (enable) {
            if (this.cachedTotalGroups < 2) {
                this.cachedTotalGroups = 2;
                this.cachedGroupNumbers = [1, 2];
                this.tournamentForm.get('totalGroups')?.setValue(2);
            }
        } else {
            this.cachedTotalGroups = 1;
            this.cachedGroupNumbers = [1];
            this.tournamentForm.get('totalGroups')?.setValue(1);
            // Reset all teams to group 1
            for (let i = 0; i < this.teams.length; i++) {
                this.teams.at(i).get('groupNumber')?.setValue(1);
            }
            this.rebuildTeamsByGroupCache();
        }
        this.cdr.markForCheck();
    }

    incrementGroups() {
        const current = this.cachedTotalGroups;
        if (current < 10) {
            this.cachedTotalGroups = current + 1;
            this.cachedGroupNumbers = Array.from({ length: this.cachedTotalGroups }, (_, i) => i + 1);
            this.tournamentForm.get('totalGroups')?.setValue(this.cachedTotalGroups);
            this.cdr.markForCheck();
        }
    }

    decrementGroups() {
        const current = this.cachedTotalGroups;
        if (current > 2) {
            this.cachedTotalGroups = current - 1;
            this.cachedGroupNumbers = Array.from({ length: this.cachedTotalGroups }, (_, i) => i + 1);
            this.tournamentForm.get('totalGroups')?.setValue(this.cachedTotalGroups);
            // Move teams from removed group to last valid group
            for (let i = 0; i < this.teams.length; i++) {
                const gn = this.teams.at(i).get('groupNumber')?.value || 1;
                if (gn > this.cachedTotalGroups) {
                    this.teams.at(i).get('groupNumber')?.setValue(this.cachedTotalGroups);
                }
            }
            this.rebuildTeamsByGroupCache();
            this.cdr.markForCheck();
        }
    }

    // ===================== TEAM MANAGEMENT =====================
    addTeam() {
        this.teams.push(this.fb.group({
            player1Name: ['', Validators.required],
            player2Name: ['', Validators.required],
            groupNumber: [1, [Validators.required, Validators.min(1)]]
        }));
        this.rebuildTeamsByGroupCache();
        this.cdr.markForCheck();
    }

    removeTeam(index: number) {
        if (this.teams.length > 2) {
            this.teams.removeAt(index);
            this.rebuildTeamsByGroupCache();
            this.cdr.markForCheck();
        }
    }

    ensureMinTeams() {
        while (this.teams.length < 4) {
            this.addTeam();
        }
        this.rebuildTeamsByGroupCache();
    }

    setTeamGroup(teamIndex: number, groupNumber: number) {
        const team = this.teams.at(teamIndex);
        if (team) {
            team.get('groupNumber')?.setValue(groupNumber);
            this.rebuildTeamsByGroupCache();
            this.cdr.markForCheck();
        }
    }

    private rebuildTeamsByGroupCache() {
        this.cachedTeamsByGroup = new Map();
        for (let i = 0; i < this.teams.length; i++) {
            const gn = this.teams.at(i).get('groupNumber')?.value || 1;
            if (!this.cachedTeamsByGroup.has(gn)) {
                this.cachedTeamsByGroup.set(gn, []);
            }
            this.cachedTeamsByGroup.get(gn)!.push({ index: i, control: this.teams.at(i) });
        }
    }

    getTeamsForGroup(groupNumber: number): { index: number; control: AbstractControl }[] {
        return this.cachedTeamsByGroup.get(groupNumber) || [];
    }

    // ===================== PLAYER SELECTION =====================
    getSelectedPlayerNames(currentControlName: string, currentTeamIndex: number): string[] {
        const names: string[] = [];
        this.teams.controls.forEach((group: AbstractControl, index: number) => {
            const p1 = group.get('player1Name')?.value;
            const p2 = group.get('player2Name')?.value;
            if (index !== currentTeamIndex) {
                if (p1) names.push(p1);
                if (p2) names.push(p2);
            } else {
                if (currentControlName === 'player1Name' && p2) names.push(p2);
                if (currentControlName === 'player2Name' && p1) names.push(p1);
            }
        });
        return names;
    }

    // Modal State
    showCreateModal = false;
    createModalInitialName = '';
    private activePlayerSelect: PlayerSelectComponent | null = null;

    openCreateModal(name: string, selectComponent: PlayerSelectComponent) {
        this.createModalInitialName = name;
        this.activePlayerSelect = selectComponent;
        this.showCreateModal = true;
    }

    onPlayerCreated(player: Player) {
        if (this.activePlayerSelect) {
            this.activePlayerSelect.onPlayerCreated(player);
        }
        this.loadPlayers();
        this.closeCreateModal();
    }

    closeCreateModal() {
        this.showCreateModal = false;
        this.activePlayerSelect = null;
    }

    // ===================== AUTO GENERATE TEAMS =====================
    autoGenerateTeams() {
        const requiredPlayers = this.totalTeams * 2;
        let availablePlayers = [...this.existingPlayers];

        if (this.currentClubId) {
            availablePlayers = availablePlayers.filter(p => p.clubs?.some(c => c.id === this.currentClubId));
        }

        if (availablePlayers.length < requiredPlayers) {
            this.toast.warning(`Se necesitan ${requiredPlayers} jugadores y hay ${availablePlayers.length} disponibles en el club.`);
            return;
        }

        let success = false;
        let attempts = 0;
        let finalPairs: Player[][] = [];

        while (!success && attempts < 50) {
            attempts++;
            const shuffled = availablePlayers.sort(() => 0.5 - Math.random());
            const candidates = [...shuffled];
            const currentPairs: Player[][] = [];
            let possible = true;

            for (let i = 0; i < this.totalTeams; i++) {
                const p1 = candidates.pop();
                if (!p1) { possible = false; break; }
                const p2Index = candidates.findIndex(p => this.areCompatible(p1, p));
                if (p2Index === -1) { possible = false; break; }
                const p2 = candidates.splice(p2Index, 1)[0];
                currentPairs.push([p1, p2]);
            }

            if (possible) {
                finalPairs = currentPairs;
                success = true;
            }
        }

        if (success) {
            finalPairs.forEach((pair, index) => {
                const group = this.teams.at(index);
                if (group) {
                    group.patchValue({
                        player1Name: pair[0].name,
                        player2Name: pair[1].name
                    });
                }
            });
            this.toast.success('¡Parejas generadas aleatoriamente!');
        } else {
            this.toast.error('No se pudieron generar parejas válidas. Intenta agregar más jugadores.');
        }
    }

    private areCompatible(p1: Player, p2: Player): boolean {
        const pos1 = p1.position?.toLowerCase() || 'mixto';
        const pos2 = p2.position?.toLowerCase() || 'mixto';
        if (pos1 === 'reves' && pos2 === 'reves') return false;
        if (pos1 === 'drive' && pos2 === 'drive') return false;
        return true;
    }

    // ===================== MATCHES PER TEAM =====================

    /**
     * Minimum recommended teams to keep all courts busy simultaneously.
     * Each match uses 1 court and 2 teams, so need at least 2 × courts teams.
     */
    get minTeamsForFullCourts(): number {
        return this.cachedCourts * 2;
    }

    /**
     * Suggested minimum matches per team based on courts.
     * With C courts we want at least C simultaneous matches per round.
     * Each team plays 1 match per round, so we need enough rounds
     * to fill courts. Suggested = courts (so we get at least that many rounds).
     */
    get suggestedMatchesPerTeam(): number {
        return Math.max(1, this.cachedCourts);
    }

    /** Total matches that will be generated with current matchesPerTeam and teams */
    get estimatedTotalMatches(): number {
        const mpt = this.tournamentForm.get('matchesPerTeam')?.value || 1;
        // Each round has teams/2 matches. With mpt rounds, total = mpt * (teams/2)
        // But actually: each of T teams plays mpt matches. Each match involves 2 teams.
        // So total matches = T * mpt / 2
        const teams = this.totalTeams;
        return Math.floor(teams * mpt / 2);
    }

    /** Effective matches per team: 0 means all (full round-robin) */
    get effectiveMatchesPerTeam(): number {
        if (this.autoRounds) return 0;
        return this.tournamentForm.get('matchesPerTeam')?.value || 3;
    }

    toggleAutoRounds(auto: boolean) {
        this.autoRounds = auto;
        if (auto) {
            this.tournamentForm.get('matchesPerTeam')?.setValue(0);
        } else {
            // Set a reasonable default based on courts
            const defaultVal = Math.max(1, this.suggestedMatchesPerTeam);
            this.tournamentForm.get('matchesPerTeam')?.setValue(defaultVal);
        }
        this.cdr.markForCheck();
    }

    incrementMatchesPerTeam() {
        const current = this.tournamentForm.get('matchesPerTeam')?.value || 1;
        if (current < 30) {
            this.tournamentForm.get('matchesPerTeam')?.setValue(current + 1);
        }
    }

    decrementMatchesPerTeam() {
        const current = this.tournamentForm.get('matchesPerTeam')?.value || 1;
        if (current > 1) {
            this.tournamentForm.get('matchesPerTeam')?.setValue(current - 1);
        }
    }

    // ===================== K-REGULAR GRAPH VALIDATION =====================
    /**
     * Validates k-regular graph conditions for round-robin generation.
     * For a k-regular graph on n vertices to exist:
     * 1. k < n (can't play more matches than there are rivals)
     * 2. n*k must be even (handshaking lemma)
     */
    validateKRegular(n: number, k: number): { valid: boolean; reasons: string[] } {
        if (k === 0 || n < 2) return { valid: true, reasons: [] };
        const reasons: string[] = [];
        if (k >= n) {
            reasons.push(`Cada pareja solo tiene ${n - 1} rivales, pero se piden ${k} partidos (k debe ser < n=${n}).`);
        }
        if (k < n && (n * k) % 2 !== 0) {
            reasons.push(`n×k = ${n}×${k} = ${n * k} es impar. Para un fixture equilibrado, n×k debe ser par.`);
        }
        return { valid: reasons.length === 0, reasons };
    }

    /** Overall k-regular validation based on current config */
    get kRegularErrors(): { global: { valid: boolean; reasons: string[] }; perGroup: Map<number, { n: number; valid: boolean; reasons: string[] }> } {
        const k = this.effectiveMatchesPerTeam;
        const perGroup = new Map<number, { n: number; valid: boolean; reasons: string[] }>();
        if (k === 0) {
            // Auto rounds (full round-robin) is always valid
            return { global: { valid: true, reasons: [] }, perGroup };
        }
        if (!this.useGroups) {
            const n = this.totalTeams;
            return { global: this.validateKRegular(n, k), perGroup };
        }
        // Per-group validation
        this.rebuildTeamsByGroupCache();
        let allValid = true;
        for (const gn of this.cachedGroupNumbers) {
            const n = this.getTeamsForGroup(gn).length;
            const result = this.validateKRegular(n, k);
            perGroup.set(gn, { n, ...result });
            if (!result.valid) allValid = false;
        }
        return { global: { valid: allValid, reasons: [] }, perGroup };
    }

    /** Suggest valid k values for n teams */
    getSuggestedK(n: number): number[] {
        if (n < 2) return [];
        const suggestions: number[] = [];
        for (let k = 1; k < n; k++) {
            if ((n * k) % 2 === 0) {
                suggestions.push(k);
            }
        }
        return suggestions;
    }

    // ===================== SUBMIT =====================
    onSubmit() {
        if (this.tournamentForm.invalid || this.teams.length < 2) {
            this.toast.warning('Completa todos los campos antes de crear el torneo.');
            return;
        }

        // Validate groups have at least 2 teams each
        this.rebuildTeamsByGroupCache();
        if (this.cachedTotalGroups > 1) {
            for (let g = 1; g <= this.cachedTotalGroups; g++) {
                const count = this.getTeamsForGroup(g).length;
                if (count < 2) {
                    this.toast.warning(`El grupo ${g} tiene ${count} pareja(s). Cada grupo necesita al menos 2.`);
                    return;
                }
            }
        }

        this.submitting = true;
        const formValue = this.tournamentForm.value;
        const scoringMode = formValue.config.scoringMode;

        const config = {
            strictScoring: scoringMode === 'strict',
            allowTies: scoringMode === 'flexible'
        };

        const teamsPayload = formValue.teams.map((t: any) => ({
            player1Name: t.player1Name,
            player2Name: t.player2Name,
            groupNumber: this.cachedTotalGroups === 1 ? 1 : (t.groupNumber || 1)
        }));

        const formData = {
            name: formValue.name,
            courts: formValue.courts,
            durationMode: formValue.durationMode,
            durationMinutes: formValue.durationMode === 'fixed' ? formValue.durationMinutes : undefined,
            matchesPerTeam: this.autoRounds ? 0 : formValue.matchesPerTeam,
            totalGroups: this.cachedTotalGroups,
            teams: teamsPayload,
            config: config,
            clubId: this.currentClubId || undefined
        };

        this.tournamentService.createTournament(formData).subscribe({
            next: (tournament: any) => {
                this.toast.success('¡Torneo creado exitosamente!');
                this.router.navigate(['/tournaments', tournament.id]);
            },
            error: (error: any) => {
                const msg = error.error?.message || error.message || 'Error desconocido';
                this.toast.error('Error al crear el torneo: ' + (Array.isArray(msg) ? msg.join(', ') : msg));
                this.submitting = false;
                this.cdr.markForCheck();
            }
        });
    }
}
