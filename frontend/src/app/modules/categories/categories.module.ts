import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { CategoryListComponent } from './components/category-list/category-list.component';
import { PromotionDashboardComponent } from './components/promotion-dashboard/promotion-dashboard.component';

const routes: Routes = [
    { path: 'list', component: CategoryListComponent },
    { path: 'promotions', component: PromotionDashboardComponent }
];

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule.forChild(routes),
        CategoryListComponent,
        PromotionDashboardComponent
    ],
    exports: [
        CategoryListComponent,
        PromotionDashboardComponent
    ]
})
export class CategoriesModule { }
