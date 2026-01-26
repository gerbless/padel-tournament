import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlayerService, Player } from '../../services/player.service';
import { CategoryService } from '../../modules/categories/services/category.service';
import { FormsModule } from '@angular/forms';

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

    // Inline editing state
    editingPlayerId: string | null = null;
    editingCategory: string = '';
    editingPosition: string = '';
    saving = false;

    constructor(
        private playerService: PlayerService,
        private categoryService: CategoryService,
        private fb: FormBuilder
    ) {
        this.playerForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            categoryId: [''],
            position: ['']
        });
    }

    ngOnInit() {
        this.loadPlayers();
        this.loadCategories();
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
            const { name, categoryId, position } = this.playerForm.value;

            this.playerService.createPlayer(
                name,
                categoryId || undefined,
                position || undefined
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
