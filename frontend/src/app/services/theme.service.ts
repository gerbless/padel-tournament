import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    darkMode = signal(false);

    constructor() {
        // Load saved theme preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            this.darkMode.set(true);
        } else if (savedTheme === null) {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.darkMode.set(prefersDark);
        }
        this.applyTheme();
    }

    toggleTheme() {
        this.darkMode.update(value => !value);
        this.applyTheme();
    }

    private applyTheme() {
        const theme = this.darkMode() ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }
}
