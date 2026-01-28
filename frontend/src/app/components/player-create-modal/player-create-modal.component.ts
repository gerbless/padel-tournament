import { Component, EventEmitter, Input, Output, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PlayerService, Player } from '../../services/player.service';
import { CategoryService } from '../../modules/categories/services/category.service';
import { ClubService } from '../../services/club.service';
import { Club } from '../../models/club.model';

@Component({
    selector: 'app-player-create-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    template: `
    <div class="modal-overlay" (click)="cancel()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Crear Nuevo Jugador</h3>
          <button type="button" class="close-btn" (click)="cancel()">×</button>
        </div>
        
        <form [formGroup]="playerForm" (ngSubmit)="submit()">
          <div class="modal-body">
            <!-- Name -->
            <div class="form-group">
              <label>Nombre Completo</label>
              <input type="text" formControlName="name" class="form-control" placeholder="Ej: Juan Pérez">
              <div *ngIf="playerForm.get('name')?.invalid && playerForm.get('name')?.touched" class="error-msg">
                El nombre es requerido
              </div>
            </div>

            <!-- Identification Type & Input -->
            <div class="form-group">
              <label>Identificación <span class="optional">(Opcional)</span></label>
              
              <!-- Type Selector -->
              <div class="id-type-selector">
                <label class="radio-label">
                  <input type="radio" name="idType" [checked]="identificationType === 'RUT'" (change)="setIdentificationType('RUT')">
                  RUT
                </label>
                <label class="radio-label">
                  <input type="radio" name="idType" [checked]="identificationType === 'PASPORT'" (change)="setIdentificationType('PASPORT')">
                  Pasaporte
                </label>
              </div>

              <input type="text" 
                     formControlName="identification" 
                     class="form-control" 
                     [placeholder]="identificationType === 'RUT' ? 'Ej: 12.345.678-9' : 'Solo números'"
                     (input)="onIdentificationInput($event)">
              
              <div class="info-msg" *ngIf="identificationType === 'PASPORT'">
                * Solo números permitidos para pasaporte
              </div>
            </div>

            <!-- Email -->
            <div class="form-group">
              <label>Email <span class="optional">(Opcional)</span></label>
              <input type="email" formControlName="email" class="form-control" placeholder="Ej: correo@ejemplo.com">
              <div *ngIf="playerForm.get('email')?.invalid && playerForm.get('email')?.touched" class="error-msg">
                Email inválido
              </div>
            </div>

            <!-- Category -->
            <div class="form-group">
              <label>Categoría</label>
              <select formControlName="categoryId" class="form-control">
                <option value="">Selecciona una categoría (opcional)</option>
                <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
              </select>
            </div>

            <!-- Position -->
            <div class="form-group">
              <label>Posición</label>
              <select formControlName="position" class="form-control">
                <option value="">Selecciona una posición (opcional)</option>
                <option value="drive">Drive</option>
                <option value="reves">Revés</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>

            <!-- Clubs (Combobox with Checkboxes) -->
            <div class="form-group">
              <label>Clubes</label>
              <div class="multi-select-dropdown" (clickOutside)="closeClubDropdown()">
                <div class="select-trigger" (click)="toggleClubDropdown()">
                  <span *ngIf="getSelectedClubNames().length === 0">Seleccionar clubes...</span>
                  <span *ngIf="getSelectedClubNames().length > 0" class="selected-text">
                    {{ getSelectedClubText() }}
                  </span>
                  <span class="arrow">▼</span>
                </div>
                
                <div class="dropdown-options" *ngIf="showClubDropdown">
                  <div class="option-item" *ngFor="let club of sortedClubs" (click)="toggleClub($event, club.id)">
                    <input type="checkbox" [checked]="isClubSelected(club.id)" readonly>
                    <span>{{ club.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="cancel()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="playerForm.invalid || creating">
              {{ creating ? 'Creando...' : 'Guardar Jugador' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
    styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647; /* Absolute max to override everything */
      backdrop-filter: blur(2px);
    }
    
    .modal-content {
      background: var(--bg-secondary, #1f2937);
      color: var(--text-primary, white);
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      border: 1px solid var(--border, #374151);
      position: relative; /* Context for absolute dropdowns */
    }
    
    .modal-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border, #374151);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0,0,0,0.2);
    }
    
    .modal-body {
      padding: 1.5rem;
      overflow-y: visible; /* Allow dropdowns to spill out if needed, but usually contained */
    }
    
    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border, #374151);
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      background: rgba(0,0,0,0.2);
    }
    
    /* Form Elements */
    .form-group { margin-bottom: 1rem; }
    .form-group label {
      display: block; margin-bottom: 0.5rem;
      font-size: 0.9rem; color: var(--text-secondary, #d1d5db);
    }
    .optional {
        font-size: 0.75rem; color: #6b7280; font-weight: normal; margin-left: 0.25rem;
    }
    .form-control {
      width: 100%; padding: 0.75rem;
      border-radius: 6px; border: 1px solid var(--border, #374151);
      background: var(--bg-primary, #111827); color: white;
    }
    
    /* Multi Select Dropdown */
    .multi-select-dropdown {
      position: relative;
      width: 100%;
    }
    
    .select-trigger {
      width: 100%;
      padding: 0.75rem;
      background: var(--bg-primary, #111827);
      border: 1px solid var(--border, #374151);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 42px;
    }
    
    .selected-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90%;
    }
    
    .arrow { font-size: 0.8rem; color: #9ca3af; }
    
    .dropdown-options {
      position: absolute;
      top: 100%;
      left: 0;
      width: 100%;
      max-height: 200px;
      overflow-y: auto;
      background: var(--bg-secondary, #1f2937);
      border: 1px solid var(--border, #374151);
      border-top: none;
      border-radius: 0 0 6px 6px;
      z-index: 50;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    
    .option-item {
      padding: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      transition: background 0.1s;
    }
    
    .option-item:hover {
      background: rgba(255,255,255,0.05);
    }
    
    .option-item input[type="checkbox"] {
      pointer-events: none; /* Let the row click handle it */
      width: 16px; height: 16px;
    }

    /* Buttons */
    .close-btn { background: none; border: none; color: #9ca3af; font-size: 1.5rem; cursor: pointer; }
    .btn { padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500; cursor: pointer; border: none; }
    .btn-secondary { background: #374151; color: white; }
    .btn-primary { background: #10b981; color: white; }
    .btn:disabled { opacity: 0.7; cursor: not-allowed; }
    .error-msg { color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem; }
    
    /* Radio Selector */
    .id-type-selector {
        display: flex; gap: 1rem; margin-bottom: 0.5rem;
    }
    .radio-label {
        display: flex; align-items: center; gap: 0.3rem; 
        font-size: 0.9rem; cursor: pointer;
        color: var(--text-secondary, #d1d5db);
    }
    .info-msg {
        font-size: 0.75rem; color: #fbbf24; margin-top: 0.25rem;
    }
  `]
})
export class PlayerCreateModalComponent implements OnInit {
    @Input() initialName: string = '';
    @Input() predefinedClubId: string | null = null;
    @Output() close = new EventEmitter<void>();
    @Output() playerCreated = new EventEmitter<Player>();

    playerForm: FormGroup;
    categories: any[] = [];
    clubs: Club[] = [];
    sortedClubs: Club[] = []; // For rendering with current club first

    creating = false;
    showClubDropdown = false;

    // Identification Logic
    identificationType: 'RUT' | 'PASPORT' = 'RUT';

    constructor(
        private fb: FormBuilder,
        private playerService: PlayerService,
        private categoryService: CategoryService,
        private clubService: ClubService
    ) {
        this.playerForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            identification: [''],
            email: ['', [Validators.email]],
            categoryId: [''],
            position: [''],
            clubIds: [[]]
        });
    }

    setIdentificationType(type: 'RUT' | 'PASPORT') {
        this.identificationType = type;

        // Re-validate/format current value when switching
        const currentVal = this.playerForm.get('identification')?.value || '';
        if (currentVal) {
            this.applyFormatting(currentVal);
        }
    }

    onIdentificationInput(event: any) {
        const input = event.target;
        const value = input.value;
        this.applyFormatting(value);
    }

    applyFormatting(value: string) {
        let formatted = '';
        if (this.identificationType === 'RUT') {
            formatted = this.formatRut(value);
        } else {
            formatted = this.formatPassport(value);
        }

        // Update control value without emitting event to prevent loop
        this.playerForm.get('identification')?.setValue(formatted, { emitEvent: false });
    }

    formatRut(val: string): string {
        // Remove invalid chars (keep numbers and k/K)
        let value = val.replace(/[^0-9kK]/g, '');

        if (value.length <= 1) return value; // Just one char

        // Separate Body and DV
        const dv = value.slice(-1);
        let body = value.slice(0, -1);

        // Format Body: 12345678 -> 12.345.678
        if (body.length > 0) {
            body = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        }

        return `${body}-${dv}`;
    }

    formatPassport(val: string): string {
        // Only allow numbers as per requirement
        return val.replace(/[^0-9]/g, '');
    }

    ngOnInit() {
        this.playerForm.patchValue({ name: this.initialName });
        this.loadMetadata();
    }

    loadMetadata() {
        this.categoryService.findAll().subscribe(cats => this.categories = cats);
        this.clubService.getClubs().subscribe(clubs => {
            this.clubs = clubs;

            // Pre-select current club
            if (this.predefinedClubId) {
                // Ensure type match (string)
                const targetId = String(this.predefinedClubId);
                const exists = this.clubs.some(c => String(c.id) === targetId);
                if (exists) {
                    this.addClub(targetId);
                }
            }

            this.sortClubs();
        });
    }

    sortClubs() {
        // Sort clubs so the predefined one (current one) is first
        if (!this.predefinedClubId) {
            this.sortedClubs = [...this.clubs];
            return;
        }

        this.sortedClubs = [...this.clubs].sort((a, b) => {
            if (a.id === this.predefinedClubId) return -1;
            if (b.id === this.predefinedClubId) return 1;
            return 0; // Keep original order otherwise
        });
    }

    // --- Multi Select Logic ---

    toggleClubDropdown() {
        this.showClubDropdown = !this.showClubDropdown;
    }

    closeClubDropdown() {
        this.showClubDropdown = false;
    }

    isClubSelected(clubId: string): boolean {
        const selected = this.playerForm.get('clubIds')?.value || [];
        return selected.includes(clubId);
    }

    toggleClub(event: Event, clubId: string) {
        event.stopPropagation(); // Prevent closing dropdown
        event.preventDefault(); // Prevent default checkbox behavior since we handle it manually

        if (this.isClubSelected(clubId)) {
            this.removeClub(clubId);
        } else {
            this.addClub(clubId);
        }
    }

    addClub(clubId: string) {
        const current = this.playerForm.get('clubIds')?.value || [];
        if (!current.includes(clubId)) {
            this.playerForm.patchValue({ clubIds: [...current, clubId] });
        }
    }

    removeClub(clubId: string) {
        const current = this.playerForm.get('clubIds')?.value || [];
        this.playerForm.patchValue({
            clubIds: current.filter((id: string) => id !== clubId)
        });
    }

    getSelectedClubNames(): string[] {
        const selectedIds = this.playerForm.get('clubIds')?.value || [];
        return this.clubs
            .filter(c => selectedIds.includes(c.id))
            .map(c => c.name);
    }

    getSelectedClubText(): string {
        const names = this.getSelectedClubNames();
        if (names.length === 0) return '';
        if (names.length <= 2) return names.join(', ');
        return `${names[0]}, ${names[1]} (+${names.length - 2})`;
    }

    // --- Actions ---

    cancel() {
        this.close.emit();
    }

    submit() {
        if (this.playerForm.invalid) return;

        this.creating = true;
        const { name, categoryId, position, clubIds, identification, email } = this.playerForm.value;

        this.playerService.createPlayer(
            name,
            categoryId || undefined,
            position || undefined,
            clubIds,
            identification || undefined,
            email || undefined
        ).subscribe({
            next: (player) => {
                this.creating = false;
                this.playerCreated.emit(player);
                this.close.emit();
            },
            error: (err) => {
                console.error('Error creating player', err);
                this.creating = false;
                alert('Error al crear el jugador');
            }
        });
    }

    @HostListener('document:click', ['$event'])
    onClick(event: MouseEvent) {
        // Simple way to handle click outside for the dropdown
        // Check if click target is NOT inside the 'multi-select-dropdown'
        const target = event.target as HTMLElement;
        const dropdown = target.closest('.multi-select-dropdown');

        if (!dropdown && this.showClubDropdown) {
            this.closeClubDropdown();
        }
    }
}
