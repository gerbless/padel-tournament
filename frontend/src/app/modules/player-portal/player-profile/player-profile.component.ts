import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';
import { ClubService } from '../../../services/club.service';
import { CategoryService } from '../../categories/services/category.service';

interface ProfileData {
    id: string;
    name: string;
    email: string;
    identification: string;
    phone: string;
    position: string;
    category: { id: string; name: string } | null;
    clubs: { id: string; name: string }[];
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    showPhone: boolean;
}

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

    player: ProfileData | null = null;

    // Form fields
    form = {
        name: '',
        email: '',
        identification: '',
        phone: '',
        position: '',
        categoryId: '',
        clubIds: [] as string[],
    };

    // Reference data
    allClubs: { id: string; name: string }[] = [];
    allCategories: { id: string; name: string }[] = [];

    // Verification states
    sendingEmail = false;
    sendingOtp = false;
    verifyingPhone = false;
    phoneOtpSent = false;
    phoneCode = '';

    constructor(
        private http: HttpClient,
        private toast: ToastService,
        private clubService: ClubService,
        private categoryService: CategoryService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadAll();
    }

    loadAll() {
        this.loading = true;
        this.cdr.markForCheck();

        forkJoin({
            profile: this.http.get<ProfileData>(`${environment.apiUrl}/players/me`),
            clubs: this.clubService.getClubs(),
            categories: this.categoryService.findAll(),
        }).subscribe({
            next: ({ profile, clubs, categories }) => {
                this.player = profile;
                this.allClubs = clubs.map(c => ({ id: c.id, name: c.name }));
                this.allCategories = categories
                    .filter(c => c.id)
                    .map(c => ({ id: c.id!, name: c.name }));
                this.resetForm();
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

    resetForm() {
        if (!this.player) return;
        this.form = {
            name: this.player.name || '',
            email: this.player.email || '',
            identification: this.player.identification || '',
            phone: this.player.phone || '',
            position: this.player.position || '',
            categoryId: this.player.category?.id || '',
            clubIds: this.player.clubs?.map(c => c.id) || [],
        };
    }

    toggleEdit() {
        this.editMode = !this.editMode;
        if (!this.editMode) {
            this.resetForm();
        }
        this.cdr.markForCheck();
    }

    toggleClub(clubId: string) {
        const idx = this.form.clubIds.indexOf(clubId);
        if (idx >= 0) {
            this.form.clubIds.splice(idx, 1);
        } else {
            this.form.clubIds.push(clubId);
        }
        this.cdr.markForCheck();
    }

    isClubSelected(clubId: string): boolean {
        return this.form.clubIds.includes(clubId);
    }

    saveProfile() {
        this.saving = true;
        this.cdr.markForCheck();

        const body: any = {};
        if (this.form.name !== (this.player?.name || '')) body.name = this.form.name;
        if (this.form.email !== (this.player?.email || '')) body.email = this.form.email;
        if (this.form.identification !== (this.player?.identification || '')) body.identification = this.form.identification;
        if (this.form.phone !== (this.player?.phone || '')) body.phone = this.form.phone;
        if (this.form.position !== (this.player?.position || '')) body.position = this.form.position || undefined;
        if (this.form.categoryId !== (this.player?.category?.id || '')) body.categoryId = this.form.categoryId || null;

        // Always send clubIds so associations update
        body.clubIds = this.form.clubIds;

        this.http.patch<ProfileData>(`${environment.apiUrl}/players/me`, body).subscribe({
            next: (updated) => {
                this.player = updated;
                this.resetForm();
                this.saving = false;
                this.editMode = false;

                const emailChanged = body.email !== undefined;
                if (emailChanged) {
                    this.toast.success('Perfil actualizado. Se envió un email de verificación a tu nuevo correo.');
                } else {
                    this.toast.success('Perfil actualizado');
                }
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.saving = false;
                this.toast.error(err.error?.message || 'Error al actualizar perfil');
                this.cdr.markForCheck();
            }
        });
    }

    // ── Email Verification ──

    resendEmailVerification() {
        this.sendingEmail = true;
        this.cdr.markForCheck();

        this.http.post<any>(`${environment.apiUrl}/players/me/resend-email-verification`, {}).subscribe({
            next: (res) => {
                this.sendingEmail = false;
                this.toast.success(res.message || 'Email de verificación enviado');
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.sendingEmail = false;
                this.toast.error(err.error?.message || 'Error al enviar email de verificación');
                this.cdr.markForCheck();
            }
        });
    }

    // ── Phone Verification ──

    sendPhoneOtp() {
        const phone = this.player?.phone || this.form.phone;
        if (!phone) {
            this.toast.error('Ingresa un número de teléfono primero');
            return;
        }
        this.sendingOtp = true;
        this.cdr.markForCheck();

        this.http.post<any>(`${environment.apiUrl}/players/me/send-phone-otp`, { phone }).subscribe({
            next: () => {
                this.sendingOtp = false;
                this.phoneOtpSent = true;
                this.toast.success('Código de verificación enviado por WhatsApp');
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.sendingOtp = false;
                this.toast.error(err.error?.message || 'Error al enviar código');
                this.cdr.markForCheck();
            }
        });
    }

    verifyPhoneCode() {
        const phone = this.player?.phone || this.form.phone;
        if (!phone || !this.phoneCode) return;

        this.verifyingPhone = true;
        this.cdr.markForCheck();

        this.http.post<any>(`${environment.apiUrl}/players/me/verify-phone`, { phone, code: this.phoneCode }).subscribe({
            next: (res) => {
                this.verifyingPhone = false;
                this.phoneOtpSent = false;
                this.phoneCode = '';
                if (res.verified && this.player) {
                    this.player.isPhoneVerified = true;
                }
                this.toast.success('Teléfono verificado correctamente');
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.verifyingPhone = false;
                this.toast.error(err.error?.message || 'Código incorrecto');
                this.cdr.markForCheck();
            }
        });
    }

    getPositionLabel(pos: string): string {
        switch (pos) {
            case 'drive': return 'Drive';
            case 'reves': return 'Revés';
            case 'mixto': return 'Mixto';
            default: return 'Sin definir';
        }
    }
}
