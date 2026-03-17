import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PlayerService, Player, PaginatedPlayers } from '../../services/player.service';
import { CategoryService } from '../../modules/categories/services/category.service';
import { ClubService } from '../../services/club.service';
import { Club } from '../../models/club.model';
import { PlayerCreateModalComponent } from '../player-create-modal/player-create-modal.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-player-list',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, PlayerCreateModalComponent],
    templateUrl: './player-list.component.html',
    styleUrls: ['./player-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerListComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    loading = true;
    categories: any[] = [];
    clubs: Club[] = [];
    isLoggedIn = false;
    canEdit = false;
    canAdmin = false;

    // Pagination
    page = 1;
    limit = 10;
    total = 0;
    totalPages = 0;

    // Search
    search = '';
    private searchSubject = new Subject<string>();
    private searchSub!: Subscription;

    // Club filter
    clubFilter: 'mine' | 'all' = 'mine';
    currentClubId = '';
    currentClubName = '';

    // Modal state
    showCreateModal = false;
    editingPlayer: Player | null = null;

    // Delete confirmation
    playerToDelete: Player | null = null;
    deleting = false;

    constructor(
        private playerService: PlayerService,
        private categoryService: CategoryService,
        private clubService: ClubService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private toast: ToastService
    ) { }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        const club = this.clubService.getSelectedClub();
        if (club) {
            this.currentClubId = club.id;
            this.currentClubName = club.name;
            this.canEdit = this.authService.hasClubRole(club.id, 'editor');
            this.canAdmin = this.authService.hasClubRole(club.id, 'admin');
        }

        this.searchSub = this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged()
        ).subscribe(() => {
            this.page = 1;
            this.loadPlayers();
        });

        this.loadPlayers();
        this.loadCategories();
        this.loadClubs();
    }

    ngOnDestroy() {
        this.searchSub?.unsubscribe();
    }

    loadClubs() {
        this.clubService.getClubs().subscribe(clubs => {
            this.clubs = clubs;
            this.cdr.markForCheck();
        });
    }

    loadCategories() {
        this.categoryService.findAll().subscribe(cats => {
            this.categories = cats;
            this.cdr.markForCheck();
        });
    }

    loadPlayers() {
        this.loading = true;
        this.cdr.markForCheck();

        const clubId = this.clubFilter === 'mine' ? this.currentClubId : undefined;

        this.playerService.findAllPaginated({
            clubId,
            page: this.page,
            limit: this.limit,
            search: this.search || undefined,
        }).subscribe({
            next: (res: PaginatedPlayers) => {
                this.players = res.data;
                this.total = res.total;
                this.totalPages = res.totalPages;
                this.page = res.page;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.toast.error('Error al cargar jugadores');
                this.cdr.markForCheck();
            }
        });
    }

    onSearchChange(term: string) {
        this.search = term;
        this.searchSubject.next(term);
    }

    setClubFilter(filter: 'mine' | 'all') {
        if (this.clubFilter === filter) return;
        this.clubFilter = filter;
        this.page = 1;
        this.loadPlayers();
    }

    setLimit(newLimit: number) {
        this.limit = newLimit;
        this.page = 1;
        this.loadPlayers();
    }

    goToPage(p: number) {
        if (p < 1 || p > this.totalPages || p === this.page) return;
        this.page = p;
        this.loadPlayers();
    }

    get visiblePages(): number[] {
        const pages: number[] = [];
        const start = Math.max(1, this.page - 2);
        const end = Math.min(this.totalPages, this.page + 2);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    }

    // ── Create / Edit Modal ──

    openCreateModal() {
        this.editingPlayer = null;
        this.showCreateModal = true;
    }

    openEditModal(player: Player) {
        this.editingPlayer = player;
        this.showCreateModal = true;
    }

    onModalClosed() {
        this.showCreateModal = false;
        this.editingPlayer = null;
    }

    onPlayerSaved() {
        this.showCreateModal = false;
        this.editingPlayer = null;
        this.loadPlayers();
    }

    // ── Delete ──

    deletePlayer(player: Player) {
        this.playerToDelete = player;
    }

    cancelDelete() {
        this.playerToDelete = null;
    }

    confirmDelete() {
        if (!this.playerToDelete || this.deleting) return;
        const player = this.playerToDelete;
        this.deleting = true;
        this.cdr.markForCheck();
        this.playerService.deletePlayer(player.id).subscribe({
            next: () => {
                this.deleting = false;
                this.playerToDelete = null;
                this.loadPlayers();
                this.toast.success('Jugador eliminado');
                this.cdr.markForCheck();
            },
            error: (error: any) => {
                this.deleting = false;
                this.toast.error('No se puede eliminar: ' + (error.error?.message || 'Tiene torneos jugados'));
                this.playerToDelete = null;
                this.cdr.markForCheck();
            }
        });
    }

    // ── Helpers ──

    getPositionLabel(position?: string): string {
        const labels: any = { 'reves': 'Revés', 'drive': 'Drive', 'mixto': 'Mixto' };
        return labels[position || ''] || '-';
    }

    getPositionColor(position?: string): string {
        const colors: any = { 'reves': '#3b82f6', 'drive': '#10b981', 'mixto': '#8b5cf6' };
        return colors[position || ''] || '#6b7280';
    }
}
