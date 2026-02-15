import { Component, EventEmitter, Input, Output, HostListener, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PlayerService, Player } from '../../services/player.service';
import { CategoryService } from '../../modules/categories/services/category.service';
import { ClubService } from '../../services/club.service';
import { Club } from '../../models/club.model';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-player-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-overlay" (click)="cancel()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Crear Nuevo Jugador</h3>
          <button type="button" class="close-btn" (click)="cancel()">×</button>
        </div>
        
        <form [formGroup]="playerForm" (ngSubmit)="submit()">
          <div class="modal-body">
            
            <div class="form-grid">
                <!-- Name -->
                <div class="form-group col-span-full">
                  <label>Nombre Completo</label>
                  <input type="text" formControlName="name" class="form-control" placeholder="Nombre del jugador">
                  <div *ngIf="playerForm.get('name')?.invalid && playerForm.get('name')?.touched" class="error-msg">
                    Requerido
                  </div>
                </div>

                <!-- Identification -->
                <div class="form-group col-span-full">
                  <label>Identificación</label>
                  <div class="input-with-radios">
                    <div class="id-type-selector-compact">
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
                           [placeholder]="identificationType === 'RUT' ? '12.345.678-9' : 'Solo números'"
                           (input)="onIdentificationInput($event)">
                  </div>
                  
                  <div class="info-msg" *ngIf="identificationType === 'PASPORT'">
                    * Solo nros
                  </div>
                </div>

                <!-- Email -->
                <div class="form-group col-span-full">
                  <label>Email <span class="optional">(Op)</span></label>
                  <input type="email" formControlName="email" class="form-control" placeholder="email@ejemplo.com">
                  <div *ngIf="playerForm.get('email')?.invalid && playerForm.get('email')?.touched" class="error-msg">
                    Inválido
                  </div>
                </div>

                <!-- Position -->
                <div class="form-group">
                  <label>Posición</label>
                  <select formControlName="position" class="form-control">
                    <option value="">(Sin posición)</option>
                    <option value="drive">Drive</option>
                    <option value="reves">Revés</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>

                <!-- Category -->
                <div class="form-group">
                  <label>Categoría</label>
                  <select formControlName="categoryId" class="form-control">
                    <option value="">(Sin categoría)</option>
                    <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
                  </select>
                </div>

                <!-- Clubs (Combobox with Checkboxes) -->
                <div class="form-group col-span-full">
                  <label>Clubes</label>
                  <div class="multi-select-dropdown" (clickOutside)="closeClubDropdown()">
                    <div #clubTrigger class="select-trigger" (click)="toggleClubDropdown(clubTrigger)">
                      <span *ngIf="getSelectedClubNames().length === 0">Seleccionar clubes...</span>
                      <span *ngIf="getSelectedClubNames().length > 0" class="selected-text">
                        {{ getSelectedClubText() }}
                      </span>
                      <span class="arrow">▼</span>
                    </div>
                    
                    <div class="dropdown-options fixed-dropdown" *ngIf="showClubDropdown" 
                         [style.top.px]="dropdownTop" 
                         [style.left.px]="dropdownLeft" 
                         [style.width.px]="dropdownWidth">
                      <div class="option-item" *ngFor="let club of sortedClubs" (click)="toggleClub($event, club.id)">
                        <input type="checkbox" [checked]="isClubSelected(club.id)" readonly>
                        <span>{{ club.name }}</span>
                      </div>
                    </div>
                  </div>
                </div>
            </div> <!-- End Grid -->
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="cancel()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="playerForm.invalid || creating">
              {{ creating ? 'Guardando...' : 'Guardar' }}
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
      z-index: 2147483647;
      backdrop-filter: blur(2px);
      padding: 1rem; /* Prevent edge touching on small screens */
    }
    
    .modal-content {
      background: var(--bg-secondary, #1f2937);
      color: var(--text-primary, white);
      border-radius: 12px;
      width: 100%;
      max-width: 600px; /* Wider to support grid */
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      border: 1px solid var(--border, #374151);
      position: relative;
      display: flex;
      flex-direction: column;
      max-height: 95vh; /* Ensure it fits in viewport */
    }
    
    .modal-header {
      padding: 0.75rem 1.25rem; /* Compact padding */
      border-bottom: 1px solid var(--border, #374151);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0,0,0,0.2);
      flex-shrink: 0;
    }
    
    .modal-body {
      padding: 1rem 1.25rem; /* Compact padding */
      overflow-y: auto; /* Scrollable body */
      -webkit-overflow-scrolling: touch;
    }

    /* Grid Layout */
    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 1rem;
        row-gap: 0.5rem;
    }

    .col-span-full {
        grid-column: 1 / -1;
    }
    
    .modal-footer {
      padding: 0.75rem 1.25rem; /* Compact padding */
      border-top: 1px solid var(--border, #374151);
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      background: rgba(0,0,0,0.2);
      flex-shrink: 0;
    }
    
    /* Form Elements */
    .form-group { margin-bottom: 0.5rem; } /* Reduced margin */
    .form-group label {
      display: block; margin-bottom: 0.25rem;
      font-size: 0.85rem; color: var(--text-secondary, #d1d5db);
      font-weight: 500;
    }
    .optional {
        font-size: 0.75rem; color: #6b7280; font-weight: normal; margin-left: 0.25rem;
    }
    .form-control {
      width: 100%; padding: 0.5rem 0.75rem; /* Compact input */
      border-radius: 6px; border: 1px solid var(--border, #374151);
      background: var(--bg-primary, #111827); color: white;
      font-size: 0.95rem;
      min-height: 38px;
    }
    
    /* Multi Select Dropdown */
    .multi-select-dropdown {
      position: relative;
      width: 100%;
    }
    
    .select-trigger {
      width: 100%;
      padding: 0.5rem 0.75rem; /* Compact trigger */
      background: var(--bg-primary, #111827);
      border: 1px solid var(--border, #374151);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 38px;
      font-size: 0.95rem;
    }
    
    .selected-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90%;
    }
    
    .arrow { font-size: 0.8rem; color: #9ca3af; }
    
    .dropdown-options {
      /* Base styles (will be overridden by fixed-dropdown if applied) */
      background: var(--bg-secondary, #1f2937);
      border: 1px solid var(--border, #374151);
      border-radius: 6px;
      z-index: 50;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }

    .fixed-dropdown {
        position: fixed; /* Popped out of flow */
        max-height: 200px;
        overflow-y: auto;
        z-index: 99999 !important; /* Super high to cover footer/modals */
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    
    .option-item {
      padding: 0.6rem 0.75rem;
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
      pointer-events: none;
      width: 16px; height: 16px;
    }

    /* Buttons */
    .close-btn { background: none; border: none; color: #9ca3af; font-size: 1.5rem; cursor: pointer; padding: 0; line-height: 1; }
    .btn { padding: 0.5rem 1rem; border-radius: 6px; font-weight: 500; cursor: pointer; border: none; font-size: 0.95rem; }
    .btn-secondary { background: #374151; color: white; }
    .btn-primary { background: #10b981; color: white; }
    .btn:disabled { opacity: 0.7; cursor: not-allowed; }
    .error-msg { color: #ef4444; font-size: 0.75rem; margin-top: 0.2rem; }
    
    /* Radio Selector */
    .id-type-selector-compact {
        display: flex; gap: 0.75rem; flex-shrink: 0;
    }
    
    .input-with-radios {
        display: flex;
        gap: 1rem;
        align-items: center;
    }
    
    .input-with-radios .form-control {
        flex-grow: 1;
    }

    .radio-label {
        display: flex; align-items: center; gap: 0.25rem; 
        font-size: 0.8rem; cursor: pointer;
        color: var(--text-secondary, #d1d5db);
    }
    .radio-label input { margin: 0; }
    .info-msg {
        font-size: 0.7rem; color: #fbbf24; margin-top: 0.2rem;
    }
    
    h3 { margin: 0; font-size: 1.1rem; }
    
    @media (max-width: 480px) {
        .form-grid {
             /* Adjust layout for very small screens if needed, but 2 col usually fits 350px+ */
             column-gap: 0.5rem;
        }
        .modal-body { padding: 0.75rem; }
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

  // Dropdown Positioning
  dropdownTop = 0;
  dropdownLeft = 0;
  dropdownWidth = 0;

  // Identification Logic
  identificationType: 'RUT' | 'PASPORT' = 'RUT';

  constructor(
    private fb: FormBuilder,
    private playerService: PlayerService,
    private categoryService: CategoryService,
    private clubService: ClubService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
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

  // ... (Ident logic methods omitted for brevity as they don't change, but I need to be careful with replace range)
  // I will skip replacing the entire constructor block to minimize risk, just insert the properties and update toggle method.
  // Wait, I can't "skip" blocks in replace_file_content if they are inside the start/end lines.
  // I'll target just the toggleClubDropdown method and add properties at top separately? 
  // Tools say "replace a single contiguous block". 
  // Since properties are at the top and method is further down, I need MULTIPLE edits or one big one.
  // Let's use MultiReplaceFileContentTool if available? Yes.
  // Using MultiReplaceFileContentTool for cleanliness.

  // Actually, I'll just use replace_file_content for the method, and assume I can add properties near the method or at the top in a separate call if needed.
  // But wait, the standard replace_file_content is safer if I can capture the whole range.
  // Let's use multi_replace.


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
    this.categoryService.findAll().subscribe(cats => {
      this.categories = cats;
      this.cdr.markForCheck();
    });
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
      this.cdr.markForCheck();
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

  toggleClubDropdown(trigger?: HTMLElement) {
    this.showClubDropdown = !this.showClubDropdown;

    if (this.showClubDropdown && trigger) {
      const rect = trigger.getBoundingClientRect();
      this.dropdownTop = rect.bottom + window.scrollY;
      this.dropdownLeft = rect.left + window.scrollX;
      this.dropdownWidth = rect.width;
    }
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
        this.toast.success('Jugador creado exitosamente');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.creating = false;
        this.toast.error('Error al crear el jugador: ' + (err.error?.message || 'Error desconocido'));
        this.cdr.markForCheck();
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
