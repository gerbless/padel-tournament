
import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    username = '';
    password = '';
    error = '';
    loading = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    login() {
        this.loading = true;
        this.error = '';

        this.authService.login(this.username, this.password).subscribe({
            next: () => {
                this.loading = false;
                this.cdr.markForCheck();
                this.router.navigate(['/leagues']);
            },
            error: (err) => {
                console.error(err);
                this.loading = false;
                this.error = 'Credenciales inválidas o error en el servidor';
                this.cdr.markForCheck();
            }
        });
    }
}
