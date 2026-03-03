import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';

@Component({
    selector: 'app-player-profile',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './player-profile.component.html',
    styleUrls: ['./player-profile.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerProfileComponent implements OnInit {
    loading = true;
    saving = false;
    editMode = false;

    player: any = null;
    form = {
        name: '',
        email: '',
        identification: '',
        position: '',
    };

    constructor(
        private http: HttpClient,
        private toast: ToastService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadProfile();
    }

    loadProfile() {
        this.loading = true;
        this.cdr.markForCheck();

        this.http.get<any>(`${environment.apiUrl}/players/me`).subscribe({
            next: (player) => {
                this.player = player;
                this.form = {
                    name: player.name || '',
                    email: player.email || '',
                    identification: player.identification || '',
                    position: player.position || '',
                };
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.toast.error('Error al cargar perfil');
                this.cdr.markForCheck();
            }
        });
    }

    toggleEdit() {
        this.editMode = !this.editMode;
        if (!this.editMode && this.player) {
            // Reset form on cancel
            this.form = {
                name: this.player.name || '',
                email: this.player.email || '',
                identification: this.player.identification || '',
                position: this.player.position || '',
            };
        }
        this.cdr.markForCheck();
    }

    saveProfile() {
        this.saving = true;
        this.cdr.markForCheck();

        const body: any = {};
        if (this.form.name !== this.player.name) body.name = this.form.name;
        if (this.form.email !== this.player.email) body.email = this.form.email;
        if (this.form.identification !== this.player.identification) body.identification = this.form.identification;
        if (this.form.position !== (this.player.position || '')) body.position = this.form.position || undefined;

        this.http.patch<any>(`${environment.apiUrl}/players/me`, body).subscribe({
            next: (updated) => {
                this.player = updated;
                this.saving = false;
                this.editMode = false;
                this.toast.success('Perfil actualizado');
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.saving = false;
                this.toast.error(err.error?.message || 'Error al actualizar perfil');
                this.cdr.markForCheck();
            }
        });
    }
}
