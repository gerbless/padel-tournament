import { Component, EventEmitter, Input, Output, forwardRef, OnInit, OnChanges, SimpleChanges, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { PlayerService, Player } from '../../services/player.service';


@Component({
  selector: 'app-player-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PlayerSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="player-select-wrapper" (clickOutside)="closeDropdown()">
      <!-- Input Wrapper -->
      <div class="input-wrapper">
        <input 
          #inputField
          type="text" 
          class="form-control" 
          [placeholder]="placeholder"
          [(ngModel)]="searchTerm"
          (input)="onSearchInput()"
          (focus)="onFocus()"
          (blur)="onBlur()"
          [disabled]="disabled"
          autocomplete="off">
        
        <div class="icon" *ngIf="loading">⏳</div>
        <div class="icon clear-btn" *ngIf="!loading && searchTerm" (click)="clearSelection()">×</div>
      </div>

      <!-- Dropdown -->
      <div class="dropdown-menu" *ngIf="showDropdown">
        <!-- New Player Option -->
        <div class="dropdown-item create-new" *ngIf="shouldShowCreateOption()" (mousedown)="openCreateModal()">
          <span class="plus">+</span> Crear "<strong>{{ searchTerm }}</strong>"
        </div>

        <!-- No Results -->
        <div class="dropdown-item no-results" *ngIf="filteredPlayers.length === 0 && !shouldShowCreateOption()">
          No se encontraron jugadores
        </div>

        <!-- Player List -->
        <div class="player-list">
             <div *ngFor="let player of filteredPlayers" 
                 class="dropdown-item player-item" 
                 (mousedown)="selectPlayer(player)">
              <div class="player-avatar">{{ getInitials(player.name) }}</div>
              <div class="player-info">
                <div class="player-name">{{ player.name }}</div>
                <div class="player-meta">
                  <span class="club-badge" *ngIf="isClubMember(player)">Miembro del Club</span>
                  <span class="category-badge" *ngIf="player.category">{{ player.category.name }}</span>
                  <span class="position-badge" *ngIf="player.position">{{ getPositionLabel(player.position) }}</span>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
  `,
  styles: [`
    .player-select-wrapper {
      position: relative;
      width: 100%;
    }

    .input-wrapper {
      position: relative;
    }

    .form-control {
      width: 100%;
      padding: 0.75rem;
      padding-right: 2.5rem; /* Space for icon */
      background: var(--bg-primary, #111827);
      border: 1px solid var(--border, #374151);
      color: var(--text-primary, white);
      border-radius: 6px;
      transition: all 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: var(--primary, #10b981);
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
    }

    .icon {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-secondary, #9ca3af);
    }

    .clear-btn {
      cursor: pointer;
      font-size: 1.2rem;
      font-weight: bold;
    }

    .clear-btn:hover {
      color: var(--text-primary, white);
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      width: 100%;
      max-height: 250px;
      overflow-y: auto;
      background: var(--bg-secondary, #1f2937);
      border: 1px solid var(--border, #374151);
      border-radius: 6px;
      margin-top: 4px;
      z-index: 1000; /* High local z-index */
      box-shadow: 0 10px 15px rgba(0,0,0,0.3);
    }

    .dropdown-item {
      padding: 0.75rem 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      transition: background 0.1s;
    }

    .dropdown-item:last-child {
      border-bottom: none;
    }

    .dropdown-item:hover {
      background: rgba(255,255,255,0.05);
    }

    .create-new {
      color: var(--primary, #10b981);
      background: rgba(16, 185, 129, 0.1);
      font-weight: 500;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .create-new:hover {
      background: rgba(16, 185, 129, 0.2);
    }

    .plus {
      font-size: 1.2rem;
      font-weight: bold;
      margin-right: 0.5rem;
    }

    .player-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--primary, #10b981);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.8rem;
    }

    .player-info {
      flex: 1;
    }

    .player-name {
      color: var(--text-primary, white);
      font-weight: 500;
    }

    .player-meta {
      display: flex;
      gap: 0.5rem;
      margin-top: 2px;
    }

    .club-badge {
      background: rgba(16, 185, 129, 0.2);
      color: var(--primary, #10b981);
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .category-badge {
      background: rgba(255,255,255,0.1);
      color: var(--text-secondary, #d1d5db);
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .position-badge {
      background: rgba(59, 130, 246, 0.2);
      color: var(--info, #3b82f6);
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 4px;
    }
    
    .no-results {
      color: var(--text-secondary, #9ca3af);
      font-style: italic;
      cursor: default;
    }
  `]
})
export class PlayerSelectComponent implements OnInit, ControlValueAccessor {
  @Input() placeholder = 'Seleccionar jugador...';
  @Input() currentClubId: string | null = null;
  @Input() excludeNames: string[] = []; // Filter out players by name (since form uses names)
  @Output() requestCreatePlayer = new EventEmitter<string>();

  private _allPlayers: Player[] = [];
  filteredPlayers: Player[] = [];

  searchTerm = '';
  showDropdown = false;
  loading = false;
  disabled = false;

  // ControlValueAccessor
  onChange: any = () => { };
  onTouched: any = () => { };

  constructor(private playerService: PlayerService) { }

  ngOnInit() {
    this.loadPlayers();
  }

  loadPlayers() {
    this.loading = true;
    this.playerService.findAll().subscribe({
      next: (players) => {
        this._allPlayers = players;
        this.filterPlayers();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading players', err);
        this.loading = false;
      }
    });
  }

  // --- Search & Filter Logic ---

  onSearchInput() {
    this.showDropdown = true;
    this.filterPlayers();

    // Propagate changes as text if typed (allowing free text)
    // BUT we prefer selecting an object. 
    // If the requirement is strict name binding, we can emit the text.
    // Ideally, we clear the model if it's not a valid selection, 
    // but legacy form might expect string.
    this.onChange(this.searchTerm);
  }

  onFocus() {
    this.showDropdown = true;
    this.filterPlayers();
  }

  onBlur() {
    // Delay hiding to allow click events to register
    setTimeout(() => {
      this.showDropdown = false;
      this.onTouched();
    }, 200);
  }

  filterPlayers() {
    let result = this._allPlayers;

    // 1. Filter by Exclude List
    if (this.excludeNames && this.excludeNames.length > 0) {
      result = result.filter(p => !this.excludeNames.includes(p.name));
    }

    // 2. Filter by Search Term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(term));
    }

    // 3. Sort: Club Members First
    if (this.currentClubId) {
      result.sort((a, b) => {
        const aInClub = this.isClubMember(a);
        const bInClub = this.isClubMember(b);
        if (aInClub && !bInClub) return -1;
        if (!aInClub && bInClub) return 1;
        return 0; // Maintain original order otherwise
      });
    }

    this.filteredPlayers = result;
  }

  isClubMember(player: Player): boolean {
    if (!this.currentClubId || !player.clubs) return false;
    return player.clubs.some(c => c.id === this.currentClubId);
  }

  shouldShowCreateOption(): boolean {
    // Show create if:
    // 1. We have a search term
    // 2. It doesn't exactly match any existing player
    if (!this.searchTerm) return false;

    // Check exact match (case insensitive)
    const exactMatch = this._allPlayers.find(
      p => p.name.toLowerCase() === this.searchTerm.toLowerCase()
    );

    return !exactMatch;
  }

  // --- Selection Logic ---

  selectPlayer(player: Player) {
    this.searchTerm = player.name;
    this.showDropdown = false;
    this.onChange(player.name);
  }

  clearSelection() {
    this.searchTerm = '';
    this.filterPlayers();
    this.onChange('');
  }

  // --- Create Modal Logic ---

  openCreateModal() {
    this.requestCreatePlayer.emit(this.searchTerm);
    this.showDropdown = false;
  }

  onPlayerCreated(player: Player) {
    // Add to local list immediately
    this._allPlayers.push(player);
    // Select it
    this.selectPlayer(player);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  getPositionLabel(position?: 'reves' | 'drive' | 'mixto'): string {
    if (!position) return '';
    const labels = {
      'reves': 'Revés',
      'drive': 'Drive',
      'mixto': 'Mixto'
    };
    return labels[position] || position;
  }

  // --- ControlValueAccessor Implementation ---

  writeValue(value: any): void {
    if (value !== undefined && value !== null) {
      this.searchTerm = value;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  closeDropdown() {
    // handled by blur usually, but logic here just in case
  }
}
