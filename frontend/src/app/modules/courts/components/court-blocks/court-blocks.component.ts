import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CourtService } from '../../../../services/court.service';
import { Court, CourtBlock } from '../../../../models/court.model';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../services/confirm.service';
import { AuthService } from '../../../../services/auth.service';
import { ClubService } from '../../../../services/club.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-court-blocks',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './court-blocks.component.html',
    styleUrls: ['./court-blocks.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtBlocksComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    selectedClubId = '';
    selectedClubName = '';
    courts: Court[] = [];
    blocks: CourtBlock[] = [];
    loading = true;
    canAdmin = false;

    // Modal
    showModal = false;
    blockForm = {
        startDate: '',
        endDate: '',
        blockType: 'full_day' as CourtBlock['blockType'],
        customStartTime: '08:00',
        customEndTime: '12:00',
        courtScope: 'all' as 'all' | 'specific',
        selectedCourtIds: [] as string[],
        reason: ''
    };

    blockTypeOptions: { value: CourtBlock['blockType']; label: string; icon: string; desc: string }[] = [
        { value: 'full_day', label: 'Día Completo', icon: '📅', desc: '00:00 - 23:59' },
        { value: 'morning', label: 'Mañana', icon: '🌅', desc: '07:00 - 12:00' },
        { value: 'afternoon', label: 'Tarde', icon: '☀️', desc: '12:00 - 18:00' },
        { value: 'night', label: 'Noche', icon: '🌙', desc: '18:00 - 23:30' },
        { value: 'custom', label: 'Personalizado', icon: '⚙️', desc: 'Horario custom' },
    ];

    constructor(
        private courtService: CourtService,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private toast: ToastService,
        private confirmService: ConfirmService,
        private authService: AuthService,
        private clubService: ClubService
    ) {}

    ngOnInit() {
        this.clubService.selectedClub$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(club => {
            if (club) {
                this.selectedClubId = club.id;
                this.selectedClubName = club.name;
                this.canAdmin = this.authService.hasClubRole(club.id, 'admin');
                this.loadData();
            }
        });
    }

    loadData() {
        this.loading = true;
        this.cdr.markForCheck();

        this.courtService.getCourtsByClub(this.selectedClubId).subscribe({
            next: courts => {
                this.courts = courts;
                this.loadBlocks();
            },
            error: () => {
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    loadBlocks() {
        this.courtService.getCourtBlocks(this.selectedClubId).subscribe({
            next: blocks => {
                this.blocks = blocks;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    // Helpers
    blockTypeLabel(type: string): string {
        const opt = this.blockTypeOptions.find(o => o.value === type);
        return opt ? `${opt.icon} ${opt.label}` : type;
    }

    blockTimeRange(block: CourtBlock): string {
        switch (block.blockType) {
            case 'morning': return '07:00 - 12:00';
            case 'afternoon': return '12:00 - 18:00';
            case 'night': return '18:00 - 23:30';
            case 'full_day': return 'Todo el día';
            case 'custom': return `${block.customStartTime} - ${block.customEndTime}`;
            default: return '';
        }
    }

    courtNames(block: CourtBlock): string {
        if (!block.courtIds || block.courtIds.length === 0) return 'Todas las canchas';
        return block.courtIds.map(id => {
            const c = this.courts.find(ct => ct.id === id);
            return c ? c.name : 'Cancha eliminada';
        }).join(', ');
    }

    isExpired(block: CourtBlock): boolean {
        const today = new Date().toISOString().split('T')[0];
        return block.endDate < today;
    }

    isActive(block: CourtBlock): boolean {
        const today = new Date().toISOString().split('T')[0];
        return block.startDate <= today && block.endDate >= today;
    }

    isFuture(block: CourtBlock): boolean {
        const today = new Date().toISOString().split('T')[0];
        return block.startDate > today;
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    dateRange(block: CourtBlock): string {
        if (block.startDate === block.endDate) return this.formatDate(block.startDate);
        return `${this.formatDate(block.startDate)} → ${this.formatDate(block.endDate)}`;
    }

    // Modal
    openAddBlock() {
        const today = new Date().toISOString().split('T')[0];
        this.blockForm = {
            startDate: today,
            endDate: today,
            blockType: 'full_day',
            customStartTime: '08:00',
            customEndTime: '12:00',
            courtScope: 'all',
            selectedCourtIds: [],
            reason: ''
        };
        this.showModal = true;
        this.cdr.markForCheck();
    }

    closeModal() {
        this.showModal = false;
        this.cdr.markForCheck();
    }

    toggleCourt(courtId: string) {
        const idx = this.blockForm.selectedCourtIds.indexOf(courtId);
        if (idx >= 0) {
            this.blockForm.selectedCourtIds.splice(idx, 1);
        } else {
            this.blockForm.selectedCourtIds.push(courtId);
        }
        this.cdr.markForCheck();
    }

    isCourtSelected(courtId: string): boolean {
        return this.blockForm.selectedCourtIds.includes(courtId);
    }

    saveBlock() {
        if (!this.blockForm.startDate || !this.blockForm.endDate) {
            this.toast.error('Selecciona las fechas');
            return;
        }
        if (this.blockForm.endDate < this.blockForm.startDate) {
            this.toast.error('Fecha fin debe ser >= fecha inicio');
            return;
        }
        if (this.blockForm.blockType === 'custom' && (!this.blockForm.customStartTime || !this.blockForm.customEndTime)) {
            this.toast.error('Ingresa horario personalizado');
            return;
        }
        if (this.blockForm.courtScope === 'specific' && this.blockForm.selectedCourtIds.length === 0) {
            this.toast.error('Selecciona al menos una cancha');
            return;
        }

        const payload: any = {
            startDate: this.blockForm.startDate,
            endDate: this.blockForm.endDate,
            blockType: this.blockForm.blockType,
            reason: this.blockForm.reason || '',
            courtIds: this.blockForm.courtScope === 'all' ? null : this.blockForm.selectedCourtIds,
        };

        if (this.blockForm.blockType === 'custom') {
            payload.customStartTime = this.blockForm.customStartTime;
            payload.customEndTime = this.blockForm.customEndTime;
        }

        this.courtService.createCourtBlock(this.selectedClubId, payload).subscribe({
            next: () => {
                this.toast.success('Bloqueo creado');
                this.closeModal();
                this.loadBlocks();
            },
            error: () => this.toast.error('Error al crear bloqueo')
        });
    }

    async deleteBlock(block: CourtBlock) {
        const ok = await this.confirmService.confirm({
            title: '¿Eliminar bloqueo?',
            message: `Se eliminará el bloqueo "${block.reason || 'Sin motivo'}" del ${this.dateRange(block)}`
        });
        if (!ok) return;

        this.courtService.deleteCourtBlock(block.id).subscribe({
            next: () => {
                this.toast.success('Bloqueo eliminado');
                this.loadBlocks();
            },
            error: () => this.toast.error('Error al eliminar bloqueo')
        });
    }

    goBack() {
        this.router.navigate(['/courts']);
    }

    get activeBlocks(): CourtBlock[] {
        return this.blocks.filter(b => this.isActive(b) || this.isFuture(b));
    }

    get expiredBlocks(): CourtBlock[] {
        return this.blocks.filter(b => this.isExpired(b));
    }
}
