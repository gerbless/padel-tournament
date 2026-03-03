import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmClass?: 'btn-danger' | 'btn-primary' | 'btn-warning';
}

export interface ConfirmEvent {
    id: number;
    options: ConfirmOptions;
    resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
    private counter = 0;
    private confirmSubject = new Subject<ConfirmEvent>();
    confirm$ = this.confirmSubject.asObservable();

    /**
     * Show a confirmation modal and return a promise that resolves
     * to true (confirmed) or false (cancelled).
     */
    confirm(options: ConfirmOptions | string): Promise<boolean> {
        const opts: ConfirmOptions = typeof options === 'string'
            ? { message: options }
            : options;

        return new Promise<boolean>((resolve) => {
            this.confirmSubject.next({
                id: ++this.counter,
                options: {
                    title: opts.title || 'Confirmar',
                    message: opts.message,
                    confirmText: opts.confirmText || 'Confirmar',
                    cancelText: opts.cancelText || 'Cancelar',
                    confirmClass: opts.confirmClass || 'btn-danger',
                },
                resolve,
            });
        });
    }
}
