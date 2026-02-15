import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const router = inject(Router);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            let userMessage = 'Ha ocurrido un error inesperado.';

            switch (error.status) {
                case 0:
                    userMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
                    break;
                case 401:
                    userMessage = 'Sesión expirada. Inicia sesión nuevamente.';
                    router.navigate(['/login']);
                    break;
                case 403:
                    userMessage = 'No tienes permisos para realizar esta acción.';
                    break;
                case 404:
                    userMessage = 'El recurso solicitado no fue encontrado.';
                    break;
                case 409:
                    userMessage = error.error?.message || 'Conflicto: el recurso ya existe.';
                    break;
                case 422:
                    userMessage = error.error?.message || 'Los datos enviados no son válidos.';
                    break;
                case 500:
                    userMessage = 'Error interno del servidor. Intenta de nuevo más tarde.';
                    break;
            }

            console.error(`[HTTP ${error.status}] ${req.method} ${req.url}:`, error.message);

            // Attach user-friendly message to the error for components to use
            const enrichedError = { ...error, userMessage };
            return throwError(() => enrichedError);
        })
    );
};
