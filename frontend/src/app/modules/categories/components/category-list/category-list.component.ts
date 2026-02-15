import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { ClubService } from '../../../../services/club.service';

@Component({
    selector: 'app-category-list',
    templateUrl: './category-list.component.html',
    styleUrls: ['./category-list.component.css'],
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryListComponent implements OnInit {
    categories: Category[] = [];
    categoryForm: FormGroup;
    editingId: string | null = null;
    isLoggedIn = false;
    canEdit = false;
    canAdmin = false;

    constructor(
        private categoryService: CategoryService,
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private toast: ToastService,
        private authService: AuthService,
        private clubService: ClubService
    ) {
        this.categoryForm = this.fb.group({
            name: ['', Validators.required],
            level: [1, [Validators.required, Validators.min(1)]],
            minPoints: [0, [Validators.required, Validators.min(0)]],
            maxPoints: [1000, [Validators.required, Validators.min(0)]]
        });
    }

    ngOnInit(): void {
        this.isLoggedIn = this.authService.isAuthenticated();
        const club = this.clubService.getSelectedClub();
        if (club) {
            this.canEdit = this.authService.hasClubRole(club.id, 'editor');
            this.canAdmin = this.authService.hasClubRole(club.id, 'admin');
        }
        this.loadCategories();
    }

    loadCategories() {
        this.categoryService.findAll().subscribe((cats: Category[]) => {
            this.categories = cats;
            this.cdr.markForCheck();
        });
    }

    onSubmit() {
        if (this.categoryForm.valid) {
            const categoryData = this.categoryForm.value;

            if (this.editingId) {
                this.categoryService.update(this.editingId, categoryData).subscribe({
                    next: () => { this.loadCategories(); this.resetForm(); this.toast.success('Categoría actualizada'); },
                    error: () => this.toast.error('Error al actualizar la categoría')
                });
            } else {
                this.categoryService.create(categoryData).subscribe({
                    next: () => { this.loadCategories(); this.resetForm(); this.toast.success('Categoría creada'); },
                    error: () => this.toast.error('Error al crear la categoría')
                });
            }
        }
    }

    edit(category: Category) {
        this.editingId = category.id!;
        this.categoryForm.patchValue(category);
    }

    delete(id: string) {
        if (confirm('¿Seguro que deseas eliminar esta categoría?')) {
            this.categoryService.delete(id).subscribe({
                next: () => { this.loadCategories(); this.toast.success('Categoría eliminada'); },
                error: () => this.toast.error('Error al eliminar la categoría')
            });
        }
    }

    resetForm() {
        this.editingId = null;
        this.categoryForm.reset({ level: 1, minPoints: 0, maxPoints: 1000 });
    }
}
