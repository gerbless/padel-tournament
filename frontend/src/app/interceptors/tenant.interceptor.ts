import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ClubService } from '../services/club.service';

/**
 * Adds X-Club-Id header to every outgoing HTTP request.
 * The backend TenantMiddleware reads this to set the PostgreSQL search_path
 * to the club's schema so queries automatically target the correct data.
 *
 * If the backend responds with 404 (club no longer exists), clears the
 * stale selection and navigates back to club selection.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
    const clubService = inject(ClubService);
    const router = inject(Router);
    const club = clubService.getSelectedClub();

    if (club?.id) {
        req = req.clone({
            setHeaders: {
                'X-Club-Id': club.id,
            },
        });
    }

    return next(req).pipe(
        catchError((err) => {
            // If the backend says the club doesn't exist, clear stale selection
            if (err.status === 404 && club?.id) {
                const msg = err.error?.message ?? '';
                if (msg.includes('no existe') || msg.includes('not found')) {
                    console.warn(`Club ${club.id} no longer exists – clearing selection`);
                    clubService.clearSelectedClub();
                    router.navigate(['/']);
                }
            }
            return throwError(() => err);
        }),
    );
};
