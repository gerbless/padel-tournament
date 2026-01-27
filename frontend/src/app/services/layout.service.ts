import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    private sidebarCollapsedSubject = new BehaviorSubject<boolean>(false);
    sidebarCollapsed$ = this.sidebarCollapsedSubject.asObservable();

    private mobileMenuOpenSubject = new BehaviorSubject<boolean>(false);
    mobileMenuOpen$ = this.mobileMenuOpenSubject.asObservable();

    toggleSidebar() {
        this.sidebarCollapsedSubject.next(!this.sidebarCollapsedSubject.value);
    }

    setSidebarState(collapsed: boolean) {
        this.sidebarCollapsedSubject.next(collapsed);
    }

    toggleMobileMenu() {
        this.mobileMenuOpenSubject.next(!this.mobileMenuOpenSubject.value);
    }

    closeMobileMenu() {
        this.mobileMenuOpenSubject.next(false);
    }
}
