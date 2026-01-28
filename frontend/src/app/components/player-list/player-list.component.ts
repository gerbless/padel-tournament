import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlayerService, Player } from '../../services/player.service';
import { CategoryService } from '../../modules/categories/services/category.service';
import { ClubService } from '../../services/club.service';
import { FormsModule } from '@angular/forms';
import { Club } from '../../models/club.model';

@Component({
    selector: 'app-player-list',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule],
    templateUrl: './player-list.component.html',
    styleUrls: ['./player-list.component.css']
})
export class PlayerListComponent implements OnInit {
    players: Player[] = [];
    loading = true;
    playerForm: FormGroup;
    categories: any[] = [];
    clubs: Club[] = []; // Available clubs

    // Inline editing state
    editingPlayerId: string | null = null;
    editingCategory: string = '';
    editingPosition: string = '';
    editingClubIds: string[] = []; // For editing clubs
    saving = false;

    // Club Selection State
    clubSearchText: string = '';
    activeDropdownPlayerId: string | null = null; // For Inline Editing
    activeDropdownMode: 'FORM' | 'EDIT' | null = null;

    constructor(
        private playerService: PlayerService,
        private categoryService: CategoryService,
        private clubService: ClubService,
        private fb: FormBuilder
    ) {
        this.playerForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            categoryId: [''],
            position: [''],
            clubIds: [[]] // Multi-select for clubs
        });
    }

    ngOnInit() {
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

    toggleFormDropdown() {
        if (this.activeDropdownMode === 'FORM') {
            this.closeDropdown();
        } else {
            this.activeDropdownMode = 'FORM';
            this.activeDropdownPlayerId = null;
            this.clubSearchText = '';
        }
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

    get selectedClubNames(): string {
        const selectedIds = this.playerForm.get('clubIds')?.value || [];
        if (selectedIds.length === 0) return 'Seleccionar clubes';

        const names = this.clubs
            .filter(c => selectedIds.includes(c.id))
            .map(c => c.name);

        return names.join(', ');
    }

    // Reuse filter for both dropdowns
    get filteredClubs(): Club[] {
        if (!this.clubSearchText) {
            return this.clubs;
        }
        const search = this.clubSearchText.toLowerCase();
        return this.clubs.filter(c => c.name.toLowerCase().includes(search));
    }

    // Unified toggle selection based on mode
    toggleClubSelection(clubId: string) {
        if (this.activeDropdownMode === 'FORM') {
            const currentIds = this.playerForm.get('clubIds')?.value || [];
            const index = currentIds.indexOf(clubId);
            let newIds;
            if (index > -1) {
                newIds = currentIds.filter((id: string) => id !== clubId);
            } else {
                newIds = [...currentIds, clubId];
            }
            this.playerForm.patchValue({ clubIds: newIds });
        } else if (this.activeDropdownMode === 'EDIT' && this.activeDropdownPlayerId) {
            const index = this.editingClubIds.indexOf(clubId);
            if (index > -1) {
                this.editingClubIds = this.editingClubIds.filter(id => id !== clubId);
            } else {
                this.editingClubIds = [...this.editingClubIds, clubId];
            }
        }
    }

    isClubSelected(clubId: string): boolean {
        if (this.activeDropdownMode === 'FORM') {
            const currentIds = this.playerForm.get('clubIds')?.value || [];
            return currentIds.includes(clubId);
        } else if (this.activeDropdownMode === 'EDIT') {
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
            error: (error) => {
                console.error('Error loading players:', error);
                this.loading = false;
            }
        });
    }

    onSubmit() {
        if (this.playerForm.valid) {
            const { name, categoryId, position, clubIds } = this.playerForm.value;

            this.playerService.createPlayer(
                name,
                categoryId || undefined,
                position || undefined,
                clubIds || []
            ).subscribe({
                next: () => {
                    this.playerForm.reset();
                    this.loadPlayers();
                },
                error: (error) => {
                    console.error('Error creating player:', error);
                    alert('Error al crear el jugador');
                }
            });
        }
    }

    deletePlayer(player: Player) {
        if (!confirm(`¿Estás seguro de eliminar a ${player.name}?`)) {
            return;
        }

        this.playerService.deletePlayer(player.id).subscribe({
            next: () => {
                this.loadPlayers();
            },
            error: (error) => {
                console.error('Error deleting player:', error);
                alert('No se puede eliminar el jugador: ' + (error.error?.message || 'Tiene torneos jugados'));
            }
        });
    }

    startEditing(player: Player) {
        this.editingPlayerId = player.id;
        this.editingCategory = player.category?.id || '';
        this.editingPosition = player.position || '';
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
    this.editingClubIds = [];
}

getSelectedClubNamesForEdit(): string {
    if (this.editingClubIds.length === 0) return 'Seleccionar clubes';
    const names = this.clubs
        .filter(c => this.editingClubIds.includes(c.id))
        .map(c => c.name);
    return names.join(', ');
}

getPositionLabel(position ?: string): string {
    if (!position) return '-';
    const labels: any = {
        'reves': 'Revés',
        'drive': 'Drive',
        'mixto': 'Mixto'
    };
    return labels[position] || position;
}

getPositionColor(position ?: string): string {
    const colors: any = {
        'reves': '#3b82f6',  // Blue
        'drive': '#10b981',  // Green
        'mixto': '#8b5cf6'   // Purple
    };
    return colors[position || ''] || '#6b7280';
}
}
