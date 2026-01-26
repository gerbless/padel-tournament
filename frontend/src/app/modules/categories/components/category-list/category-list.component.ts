import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';

@Component({
    selector: 'app-category-list',
    templateUrl: './category-list.component.html',
    styleUrls: ['./category-list.component.css'],
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule]
})
export class CategoryListComponent implements OnInit {
    categories: Category[] = [];
    categoryForm: FormGroup;
    editingId: string | null = null;

    constructor(
        private categoryService: CategoryService,
        private fb: FormBuilder
    ) {
        this.categoryForm = this.fb.group({
            name: ['', Validators.required],
            level: [1, [Validators.required, Validators.min(1)]],
            minPoints: [0, [Validators.required, Validators.min(0)]],
            maxPoints: [1000, [Validators.required, Validators.min(0)]]
        });
    }

    ngOnInit(): void {
        this.loadCategories();
    }

    loadCategories() {
        this.categoryService.findAll().subscribe((cats: Category[]) => {
            this.categories = cats;
        });
    }

    onSubmit() {
        if (this.categoryForm.valid) {
            const categoryData = this.categoryForm.value;

            if (this.editingId) {
                this.categoryService.update(this.editingId, categoryData).subscribe(() => {
                    this.loadCategories();
                    this.resetForm();
                });
            } else {
                this.categoryService.create(categoryData).subscribe(() => {
                    this.loadCategories();
                    this.resetForm();
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
            this.categoryService.delete(id).subscribe(() => this.loadCategories());
        }
    }

    resetForm() {
        this.editingId = null;
        this.categoryForm.reset({ level: 1, minPoints: 0, maxPoints: 1000 });
    }
}
