import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    private sidebarCollapsedSubject = new BehaviorSubject<boolean>(false);
    sidebarCollapsed$ = this.sidebarCollapsedSubject.asObservable();

    toggleSidebar() {
        this.sidebarCollapsedSubject.next(!this.sidebarCollapsedSubject.value);
    }

    setSidebarState(collapsed: boolean) {
        this.sidebarCollapsedSubject.next(collapsed);
    }
}
