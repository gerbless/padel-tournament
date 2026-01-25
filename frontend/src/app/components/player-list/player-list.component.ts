import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlayerService, Player } from '../../services/player.service';

@Component({
    selector: 'app-player-list',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './player-list.component.html',
    styleUrls: ['./player-list.component.css']
})
export class PlayerListComponent implements OnInit {
    players: Player[] = [];
    loading = true;
    playerForm: FormGroup;

    constructor(
        private playerService: PlayerService,
        private fb: FormBuilder
    ) {
        this.playerForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]]
        });
    }

    ngOnInit() {
        this.loadPlayers();
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
            const { name } = this.playerForm.value;
            this.playerService.createPlayer(name).subscribe({
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
}
