import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
    duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
    private counter = 0;
    private toastSubject = new Subject<Toast>();
    toast$ = this.toastSubject.asObservable();

    success(message: string, duration = 3000): void {
        this.show(message, 'success', duration);
    }

    error(message: string, duration = 5000): void {
        this.show(message, 'error', duration);
    }

    warning(message: string, duration = 4000): void {
        this.show(message, 'warning', duration);
    }

    info(message: string, duration = 3000): void {
        this.show(message, 'info', duration);
    }

    private show(message: string, type: ToastType, duration: number): void {
        this.toastSubject.next({ id: ++this.counter, message, type, duration });
    }
}
