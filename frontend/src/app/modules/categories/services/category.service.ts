import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Category } from '../models/category.model';

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private apiUrl = `${environment.apiUrl}/categories`;

    constructor(private http: HttpClient) { }

    findAll(): Observable<Category[]> {
        return this.http.get<Category[]>(this.apiUrl).pipe(
            tap({
                next: (data: Category[]) => console.log('Fetched categories:', data),
                error: (err: any) => console.error('Error fetching categories:', err)
            })
        );
    }

    create(category: Category): Observable<Category> {
        return this.http.post<Category>(this.apiUrl, category);
    }

    update(id: string, category: Category): Observable<Category> {
        return this.http.patch<Category>(`${this.apiUrl}/${id}`, category);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getAnalysis(): Observable<{ promotions: any[], relegations: any[] }> {
        return this.http.get<{ promotions: any[], relegations: any[] }>(`${this.apiUrl}/analysis`);
    }
}
