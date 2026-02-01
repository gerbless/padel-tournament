import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlayerService, Player } from '../../services/player.service';
import { CategoryService } from '../../modules/categories/services/category.service';
import { ClubService } from '../../services/club.service';
import { Club } from '../../models/club.model';
import { PlayerCreateModalComponent } from '../player-create-modal/player-create-modal.component';

import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-player-list',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule, PlayerCreateModalComponent],
    templateUrl: './player-list.component.html',
    styleUrls: ['./player-list.component.css']
})
export class PlayerListComponent implements OnInit {
    players: Player[] = [];
    loading = true;
    categories: any[] = [];
    clubs: Club[] = []; // Available clubs
    isLoggedIn = false;

    // Inline editing state
    editingPlayerId: string | null = null;
    editingCategory: string = '';
    editingPosition: string = '';
    editingIdentification: string = '';
    editingEmail: string = '';
    editingClubIds: string[] = []; // For editing clubs
    saving = false;

    // Club Selection State
    clubSearchText: string = '';
    activeDropdownPlayerId: string | null = null; // For Inline Editing
    activeDropdownMode: 'FORM' | 'EDIT' | null = null;

    // Modal State
    showCreateModal = false;

    constructor(
        private playerService: PlayerService,
        private categoryService: CategoryService,
        private clubService: ClubService,
        private authService: AuthService
    ) { }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        this.loadPlayers();
        this.loadCategories();
        this.loadClubs();
    }

    loadClubs() {
        this.clubService.getClubs().subscribe(clubs => {
            this.clubs = clubs;
        });
    }

    // Open/Close Global Modal
    closeDropdown() {
        this.activeDropdownMode = null;
        this.activeDropdownPlayerId = null;
        this.clubSearchText = '';
    }

    toggleEditDropdown(playerId: string) {
        if (this.activeDropdownMode === 'EDIT' && this.activeDropdownPlayerId === playerId) {
            this.closeDropdown();
        } else {
            this.activeDropdownMode = 'EDIT';
            this.activeDropdownPlayerId = playerId;
            this.clubSearchText = '';
        }
    }

    get filteredClubs(): Club[] {
        if (!this.clubSearchText) {
            return this.clubs;
        }
        const search = this.clubSearchText.toLowerCase();
        return this.clubs.filter(c => c.name.toLowerCase().includes(search));
    }

    // Unified toggle selection based on mode
    toggleClubSelection(clubId: string) {
        if (this.activeDropdownMode === 'EDIT' && this.activeDropdownPlayerId) {
            const index = this.editingClubIds.indexOf(clubId);
            if (index > -1) {
                this.editingClubIds = this.editingClubIds.filter(id => id !== clubId);
            } else {
                this.editingClubIds = [...this.editingClubIds, clubId];
            }
        }
    }

    isClubSelected(clubId: string): boolean {
        if (this.activeDropdownMode === 'EDIT') {
            return this.editingClubIds.includes(clubId);
        }
        return false;
    }

    loadCategories() {
        this.categoryService.findAll().subscribe(cats => {
            this.categories = cats;
        });
    }

    loadPlayers() {
        this.loading = true;
        this.playerService.findAll().subscribe({
            next: (players) => {
                this.players = players;
                this.loading = false;
            },
            error: (error: any) => {
                console.error('Error loading players:', error);
                this.loading = false;
            }
        });
    }

    openCreateModal() {
        this.showCreateModal = true;
    }

    onPlayerCreated() {
        this.showCreateModal = false;
        this.loadPlayers();
    }

    playerToDelete: Player | null = null;

    deletePlayer(player: Player) {
        this.playerToDelete = player;
    }

    cancelDelete() {
        this.playerToDelete = null;
    }

    confirmDelete() {
        if (!this.playerToDelete) return;

        const player = this.playerToDelete;

        this.playerService.deletePlayer(player.id).subscribe({
            next: () => {
                this.loadPlayers();
                this.playerToDelete = null;
            },
            error: (error: any) => {
                console.error('Error deleting player:', error);
                alert('No se puede eliminar el jugador: ' + (error.error?.message || 'Tiene torneos jugados'));
                this.playerToDelete = null;
            }
        });
    }

    startEditing(player: Player) {
        this.editingPlayerId = player.id;
        this.editingCategory = player.category?.id || '';
        this.editingPosition = player.position || '';
        this.editingIdentification = player.identification || '';
        this.editingEmail = player.email || '';
        this.editingClubIds = player.clubs?.map(c => c.id) || [];
    }

    saveEdit(player: Player) {
        this.saving = true;
        const updates: any = {};

        if (this.editingCategory !== (player.category?.id || '')) {
            updates.categoryId = this.editingCategory || null;
        }

        if (this.editingPosition !== (player.position || '')) {
            updates.position = this.editingPosition || null;
        }

        if (this.editingIdentification !== (player.identification || '')) {
            updates.identification = this.editingIdentification || null;
        }

        if (this.editingEmail !== (player.email || '')) {
            updates.email = this.editingEmail || null;
        }

        // Check if clubs changed
        const currentClubIds = player.clubs?.map(c => c.id) || [];
        const newClubIds = this.editingClubIds;
        const isClubChanged = currentClubIds.length !== newClubIds.length ||
            !currentClubIds.every(id => newClubIds.includes(id));

        if (isClubChanged) {
            updates.clubIds = this.editingClubIds;
        }

        this.playerService.updatePlayer(player.id, updates).subscribe({
            next: () => {
                this.saving = false;
                this.editingPlayerId = null;
                this.loadPlayers();
            },
            error: (error) => {
                console.error('Error updating player:', error);
                alert('Error al actualizar el jugador');
                this.saving = false;
            }
        });
    }

    cancelEdit() {
        this.editingPlayerId = null;
        this.editingCategory = '';
        this.editingPosition = '';
        this.editingIdentification = '';
        this.editingEmail = '';
        this.editingClubIds = [];
    }

    getSelectedClubNamesForEdit(): string {
        if (this.editingClubIds.length === 0) return 'Seleccionar clubes';
        const names = this.clubs
            .filter(c => this.editingClubIds.includes(c.id))
            .map(c => c.name);
        return names.join(', ');
    }

    getPositionLabel(position?: string): string {
        if (!position) return '-';
        const labels: any = {
            'reves': 'Revés',
            'drive': 'Drive',
            'mixto': 'Mixto'
        };
        return labels[position] || position;
    }

    getPositionColor(position?: string): string {
        const colors: any = {
            'reves': '#3b82f6',  // Blue
            'drive': '#10b981',  // Green
            'mixto': '#8b5cf6'   // Purple
        };
        return colors[position || ''] || '#6b7280';
    }
}
