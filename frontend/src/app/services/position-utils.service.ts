import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class PositionUtilsService {

    getPositionLabel(position?: string): string {
        if (!position) return '-';
        const labels: Record<string, string> = {
            'reves': 'Revés',
            'drive': 'Drive',
            'mixto': 'Mixto'
        };
        return labels[position] || position;
    }

    getPositionColor(position?: string): string {
        const colors: Record<string, string> = {
            'reves': '#3b82f6',  // Blue
            'drive': '#10b981',  // Green
            'mixto': '#8b5cf6'   // Purple
        };
        return colors[position || ''] || '#6b7280';
    }

    isPositionCompatible(pos1: string, pos2: string): boolean {
        if (pos1 === 'mixto' || pos2 === 'mixto') return true;
        if (pos1 === 'reves' && pos2 === 'drive') return true;
        if (pos1 === 'drive' && pos2 === 'reves') return true;
        return false;
    }
}
