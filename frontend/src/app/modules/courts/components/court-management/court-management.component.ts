import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CourtService } from '../../../../services/court.service';
import { Court, CourtPriceBlock } from '../../../../models/court.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../services/confirm.service';
import { AuthService } from '../../../../services/auth.service';
import { ClubService } from '../../../../services/club.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-court-management',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './court-management.component.html',
    styleUrls: ['./court-management.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtManagementComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    selectedClubId = '';
    selectedClubName = '';
    courts: Court[] = [];
    loading = true;
    isLoggedIn = false;
    canEdit = false;
    canAdmin = false;
    expandedPrices = new Set<string>();

    // Add/Edit Court modal
    showCourtModal = false;
    editingCourt: Court | null = null;
    courtForm = { name: '', courtNumber: 1, surfaceType: '', isActive: true };
    copyFromCourtId = '';

    // Price Block modal
    showPriceModal = false;
    editingPriceBlock: CourtPriceBlock | null = null;
    priceCourtId = '';
    applyPriceToAll = false;
    applyEditToAll = false;
    matchingBlocksCount = 0;
    priceForm: CourtPriceBlock = {
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '10:00',
        priceFullCourt: 0,
        pricePerPlayer: 0
    };

    // Pricing toggle
    enablePricing = false;

    // Action guards
    savingCourt = false;
    deletingCourtId: string | null = null;
    savingPrice = false;
    deletingPriceId: string | null = null;

    dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    constructor(
        private courtService: CourtService,
        private http: HttpClient,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private toast: ToastService,
        private confirmService: ConfirmService,
        private authService: AuthService,
        private clubService: ClubService
    ) { }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        this.clubService.selectedClub$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(club => {
            if (club) {
                this.selectedClubId = club.id;
                this.selectedClubName = club.name;
                this.enablePricing = (club as any).enableCourtPricing || false;
                this.canEdit = this.authService.hasClubRole(club.id, 'editor');
                this.canAdmin = this.authService.hasClubRole(club.id, 'admin');
                this.loadCourts();
            } else {
                this.selectedClubId = '';
                this.selectedClubName = '';
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
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
        this.cdr.markForCheck();
        this.http.patch(`${environment.apiUrl}/clubs/${this.selectedClubId}`, {
            enableCourtPricing: this.enablePricing
        }).subscribe({
            next: () => {
                this.toast.success(this.enablePricing ? 'Control de precios activado' : 'Control de precios desactivado');
                // Update the stored club so other views pick up the change
                const currentClub = this.clubService.getSelectedClub();
                if (currentClub) {
                    this.clubService.selectClub({ ...currentClub, enableCourtPricing: this.enablePricing } as any);
                }
            },
            error: () => {
                this.enablePricing = !this.enablePricing;
                this.cdr.markForCheck();
                this.toast.error('Error al actualizar configuración');
            }
        });
    }

    // Court CRUD
    get courtsWithPriceBlocks(): Court[] {
        return this.courts.filter(c => c.priceBlocks && c.priceBlocks.length > 0);
    }

    openAddCourt() {
        this.editingCourt = null;
        this.copyFromCourtId = '';
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
        if (this.savingCourt) return;
        this.savingCourt = true;
        this.cdr.markForCheck();
        if (this.editingCourt) {
            this.courtService.updateCourt(this.editingCourt.id, this.courtForm).subscribe({
                next: () => {
                    this.savingCourt = false;
                    this.showCourtModal = false;
                    this.loadCourts();
                    this.toast.success('Cancha actualizada');
                },
                error: () => { this.savingCourt = false; this.toast.error('Error al actualizar cancha'); this.cdr.markForCheck(); }
            });
        } else {
            this.courtService.createCourt({
                ...this.courtForm,
                clubId: this.selectedClubId
            } as any).subscribe({
                next: (newCourt: Court) => {
                    this.savingCourt = false;
                    this.showCourtModal = false;
                    if (this.copyFromCourtId && newCourt.id) {
                        this.courtService.copyPriceBlocks(newCourt.id, this.copyFromCourtId).subscribe({
                            next: (blocks) => {
                                this.loadCourts();
                                this.toast.success(`Cancha creada con ${blocks.length} bloques de precio copiados`);
                            },
                            error: () => {
                                this.loadCourts();
                                this.toast.warning('Cancha creada, pero hubo un error al copiar los precios');
                            }
                        });
                    } else {
                        this.loadCourts();
                        this.toast.success('Cancha creada');
                    }
                },
                error: () => { this.savingCourt = false; this.toast.error('Error al crear cancha'); this.cdr.markForCheck(); }
            });
        }
    }

    async deleteCourt(court: Court) {
        if (this.deletingCourtId) return;
        const ok = await this.confirmService.confirm({
            title: 'Eliminar Cancha',
            message: `¿Eliminar <strong>${court.name}</strong>? Esto eliminará todas las reservas asociadas.`,
            confirmText: 'Eliminar'
        });
        if (!ok) return;
        this.deletingCourtId = court.id;
        this.cdr.markForCheck();
        this.courtService.deleteCourt(court.id).subscribe({
            next: () => {
                this.deletingCourtId = null;
                this.loadCourts();
                this.toast.success('Cancha eliminada');
            },
            error: () => { this.deletingCourtId = null; this.toast.error('Error al eliminar cancha'); this.cdr.markForCheck(); }
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
        this.applyEditToAll = false;

        // Count matching blocks across other courts
        this.matchingBlocksCount = 0;
        const sortedDays = [...block.daysOfWeek].sort().join(',');
        for (const court of this.courts) {
            if (court.id === block.courtId) continue;
            const matches = (court.priceBlocks || []).filter(b =>
                b.startTime === block.startTime &&
                b.endTime === block.endTime &&
                [...b.daysOfWeek].sort().join(',') === sortedDays
            );
            this.matchingBlocksCount += matches.length;
        }

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
        if (this.savingPrice) return;
        this.savingPrice = true;
        this.cdr.markForCheck();
        if (this.editingPriceBlock && this.editingPriceBlock.id) {
            if (this.applyEditToAll && this.matchingBlocksCount > 0) {
                const matchCriteria = {
                    startTime: this.editingPriceBlock.startTime,
                    endTime: this.editingPriceBlock.endTime,
                    daysOfWeek: this.editingPriceBlock.daysOfWeek,
                };
                const newValues: any = {
                    daysOfWeek: this.priceForm.daysOfWeek,
                    startTime: this.priceForm.startTime,
                    endTime: this.priceForm.endTime,
                    priceFullCourt: this.priceForm.priceFullCourt,
                    pricePerPlayer: this.priceForm.pricePerPlayer,
                };
                this.courtService.bulkUpdatePriceBlocks(this.selectedClubId, matchCriteria, newValues).subscribe({
                    next: (result) => {
                        this.savingPrice = false;
                        this.showPriceModal = false;
                        this.loadCourts();
                        this.toast.success(`${result.updated} bloques actualizados en todas las canchas`);
                    },
                    error: () => { this.savingPrice = false; this.toast.error('Error al actualizar precios'); this.cdr.markForCheck(); }
                });
            } else {
                this.courtService.updatePriceBlock(this.editingPriceBlock.id, this.priceForm).subscribe({
                    next: () => {
                        this.savingPrice = false;
                        this.showPriceModal = false;
                        this.loadCourts();
                        this.toast.success('Bloque de precio actualizado');
                    },
                    error: () => { this.savingPrice = false; this.toast.error('Error al actualizar precio'); this.cdr.markForCheck(); }
                });
            }
        } else if (this.applyPriceToAll) {
            this.courtService.createPriceBlockForAllCourts(this.selectedClubId, this.priceForm).subscribe({
                next: (blocks) => {
                    this.savingPrice = false;
                    this.showPriceModal = false;
                    this.loadCourts();
                    this.toast.success(`Precio aplicado a ${blocks.length} canchas`);
                },
                error: () => { this.savingPrice = false; this.toast.error('Error al crear precios'); this.cdr.markForCheck(); }
            });
        } else {
            this.courtService.createPriceBlock(this.priceCourtId, this.priceForm).subscribe({
                next: () => {
                    this.savingPrice = false;
                    this.showPriceModal = false;
                    this.loadCourts();
                    this.toast.success('Bloque de precio creado');
                },
                error: () => { this.savingPrice = false; this.toast.error('Error al crear precio'); this.cdr.markForCheck(); }
            });
        }
    }

    async deletePrice(block: CourtPriceBlock) {
        if (!block.id || this.deletingPriceId) return;
        const ok = await this.confirmService.confirm({
            title: 'Eliminar Precio',
            message: '¿Eliminar este bloque de precio?',
            confirmText: 'Eliminar'
        });
        if (!ok) return;
        this.deletingPriceId = block.id;
        this.cdr.markForCheck();
        this.courtService.deletePriceBlock(block.id).subscribe({
            next: () => {
                this.deletingPriceId = null;
                this.loadCourts();
                this.toast.success('Bloque de precio eliminado');
            },
            error: () => { this.deletingPriceId = null; this.toast.error('Error al eliminar precio'); this.cdr.markForCheck(); }
        });
    }

    // Navigation
    openCalendar(court: Court) {
        this.router.navigate(['/courts', court.id, 'calendar']);
    }

    openDailyView() {
        this.router.navigate(['/courts', 'daily'], { queryParams: { clubId: this.selectedClubId } });
    }

    openBilling() {
        this.router.navigate(['/courts', 'billing']);
    }

    openBlocks() {
        this.router.navigate(['/courts', 'blocks']);
    }

    formatDays(days: number[]): string {
        return days.map(d => this.dayLabels[d]).join(', ');
    }

    formatPrice(price: number): string {
        if (!price) return '0$';
        return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(price) + '$';
    }
}
