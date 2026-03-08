import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ClubService } from '../services/club.service';

/**
 * Adds X-Club-Id header to every outgoing HTTP request.
 * The backend TenantMiddleware reads this to set the PostgreSQL search_path
 * to the club's schema so queries automatically target the correct data.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
    const clubService = inject(ClubService);
    const club = clubService.getSelectedClub();

    if (club?.id) {
        req = req.clone({
            setHeaders: {
                'X-Club-Id': club.id,
            },
        });
    }

    return next(req);
};
