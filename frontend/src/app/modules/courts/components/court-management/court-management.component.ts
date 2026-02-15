import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CourtService } from '../../../../services/court.service';
import { Court, CourtPriceBlock } from '../../../../models/court.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../services/toast.service';
import { AuthService } from '../../../../services/auth.service';

interface Club {
    id: string;
    name: string;
    enableCourtPricing?: boolean;
}

@Component({
    selector: 'app-court-management',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './court-management.component.html',
    styleUrls: ['./court-management.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtManagementComponent implements OnInit {
    clubs: Club[] = [];
    selectedClubId = '';
    selectedClub: Club | null = null;
    courts: Court[] = [];
    loading = true;
    isLoggedIn = false;
    canEdit = false;
    canAdmin = false;

    // Add/Edit Court modal
    showCourtModal = false;
    editingCourt: Court | null = null;
    courtForm = { name: '', courtNumber: 1, surfaceType: '', isActive: true };

    // Price Block modal
    showPriceModal = false;
    editingPriceBlock: CourtPriceBlock | null = null;
    priceCourtId = '';
    applyPriceToAll = false;
    priceForm: CourtPriceBlock = {
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '10:00',
        priceFullCourt: 0,
        pricePerPlayer: 0
    };

    // Pricing toggle
    enablePricing = false;

    dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    constructor(
        private courtService: CourtService,
        private http: HttpClient,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private toast: ToastService,
        private authService: AuthService
    ) { }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        this.loadClubs();
    }

    loadClubs() {
        this.http.get<Club[]>(`${environment.apiUrl}/clubs`).subscribe({
            next: (clubs) => {
                this.clubs = clubs;
                if (clubs.length === 1) {
                    this.selectedClubId = clubs[0].id;
                    this.selectedClub = clubs[0];
                    this.enablePricing = clubs[0].enableCourtPricing || false;
                    this.canEdit = this.authService.hasClubRole(clubs[0].id, 'editor');
                    this.canAdmin = this.authService.hasClubRole(clubs[0].id, 'admin');
                    this.loadCourts();
                } else {
                    this.loading = false;
                    this.cdr.markForCheck();
                }
            },
            error: () => {
                this.loading = false;
                this.toast.error('Error al cargar clubs');
                this.cdr.markForCheck();
            }
        });
    }

    onClubChange() {
        this.selectedClub = this.clubs.find(c => c.id === this.selectedClubId) || null;
        this.enablePricing = this.selectedClub?.enableCourtPricing || false;
        this.canEdit = this.selectedClubId ? this.authService.hasClubRole(this.selectedClubId, 'editor') : false;
        this.canAdmin = this.selectedClubId ? this.authService.hasClubRole(this.selectedClubId, 'admin') : false;
        if (this.selectedClubId) {
            this.loadCourts();
        }
    }

    loadCourts() {
        this.loading = true;
        this.courtService.getCourtsByClub(this.selectedClubId).subscribe({
            next: (courts) => {
                this.courts = courts;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.toast.error('Error al cargar canchas');
                this.cdr.markForCheck();
            }
        });
    }

    togglePricing() {
        this.enablePricing = !this.enablePricing;
        this.http.patch(`${environment.apiUrl}/clubs/${this.selectedClubId}`, {
            enableCourtPricing: this.enablePricing
        }).subscribe({
            next: () => this.toast.success(this.enablePricing ? 'Control de precios activado' : 'Control de precios desactivado'),
            error: () => this.toast.error('Error al actualizar configuración')
        });
    }

    // Court CRUD
    openAddCourt() {
        this.editingCourt = null;
        this.courtForm = {
            name: `Cancha ${this.courts.length + 1}`,
            courtNumber: this.courts.length + 1,
            surfaceType: 'Cristal',
            isActive: true
        };
        this.showCourtModal = true;
    }

    openEditCourt(court: Court) {
        this.editingCourt = court;
        this.courtForm = {
            name: court.name,
            courtNumber: court.courtNumber,
            surfaceType: court.surfaceType || '',
            isActive: court.isActive
        };
        this.showCourtModal = true;
    }

    saveCourt() {
        if (this.editingCourt) {
            this.courtService.updateCourt(this.editingCourt.id, this.courtForm).subscribe({
                next: () => {
                    this.showCourtModal = false;
                    this.loadCourts();
                    this.toast.success('Cancha actualizada');
                },
                error: () => this.toast.error('Error al actualizar cancha')
            });
        } else {
            this.courtService.createCourt({
                ...this.courtForm,
                clubId: this.selectedClubId
            } as any).subscribe({
                next: () => {
                    this.showCourtModal = false;
                    this.loadCourts();
                    this.toast.success('Cancha creada');
                },
                error: () => this.toast.error('Error al crear cancha')
            });
        }
    }

    deleteCourt(court: Court) {
        if (!confirm(`¿Eliminar ${court.name}? Esto eliminará todas las reservas asociadas.`)) return;
        this.courtService.deleteCourt(court.id).subscribe({
            next: () => {
                this.loadCourts();
                this.toast.success('Cancha eliminada');
            },
            error: () => this.toast.error('Error al eliminar cancha')
        });
    }

    // Price Blocks
    openAddPrice(courtId: string) {
        this.priceCourtId = courtId;
        this.applyPriceToAll = false;
        this.editingPriceBlock = null;
        this.priceForm = {
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:00',
            endTime: '10:00',
            priceFullCourt: 0,
            pricePerPlayer: 0
        };
        this.showPriceModal = true;
    }

    openAddPriceGlobal() {
        this.priceCourtId = '';
        this.applyPriceToAll = true;
        this.editingPriceBlock = null;
        this.priceForm = {
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:00',
            endTime: '10:00',
            priceFullCourt: 0,
            pricePerPlayer: 0
        };
        this.showPriceModal = true;
    }

    openEditPrice(block: CourtPriceBlock) {
        this.priceCourtId = block.courtId || '';
        this.editingPriceBlock = block;
        this.priceForm = { ...block };
        this.showPriceModal = true;
    }

    toggleDay(day: number) {
        const idx = this.priceForm.daysOfWeek.indexOf(day);
        if (idx > -1) {
            this.priceForm.daysOfWeek.splice(idx, 1);
        } else {
            this.priceForm.daysOfWeek.push(day);
            this.priceForm.daysOfWeek.sort();
        }
    }

    isDaySelected(day: number): boolean {
        return this.priceForm.daysOfWeek.includes(day);
    }

    onFullCourtPriceChange() {
        this.priceForm.pricePerPlayer = Math.round(this.priceForm.priceFullCourt / 4);
    }

    savePrice() {
        if (this.editingPriceBlock && this.editingPriceBlock.id) {
            this.courtService.updatePriceBlock(this.editingPriceBlock.id, this.priceForm).subscribe({
                next: () => {
                    this.showPriceModal = false;
                    this.loadCourts();
                    this.toast.success('Bloque de precio actualizado');
                },
                error: () => this.toast.error('Error al actualizar precio')
            });
        } else if (this.applyPriceToAll) {
            this.courtService.createPriceBlockForAllCourts(this.selectedClubId, this.priceForm).subscribe({
                next: (blocks) => {
                    this.showPriceModal = false;
                    this.loadCourts();
                    this.toast.success(`Precio aplicado a ${blocks.length} canchas`);
                },
                error: () => this.toast.error('Error al crear precios')
            });
        } else {
            this.courtService.createPriceBlock(this.priceCourtId, this.priceForm).subscribe({
                next: () => {
                    this.showPriceModal = false;
                    this.loadCourts();
                    this.toast.success('Bloque de precio creado');
                },
                error: () => this.toast.error('Error al crear precio')
            });
        }
    }

    deletePrice(block: CourtPriceBlock) {
        if (!block.id || !confirm('¿Eliminar este bloque de precio?')) return;
        this.courtService.deletePriceBlock(block.id).subscribe({
            next: () => {
                this.loadCourts();
                this.toast.success('Bloque de precio eliminado');
            },
            error: () => this.toast.error('Error al eliminar precio')
        });
    }

    // Navigation
    openCalendar(court: Court) {
        this.router.navigate(['/courts', court.id, 'calendar']);
    }

    openDailyView() {
        this.router.navigate(['/courts', 'daily'], { queryParams: { clubId: this.selectedClubId } });
    }

    formatDays(days: number[]): string {
        return days.map(d => this.dayLabels[d]).join(', ');
    }

    formatPrice(price: number): string {
        if (!price) return '0$';
        return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(price) + '$';
    }
}
