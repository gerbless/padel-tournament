import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StatsDashboardComponent } from './components/stats-dashboard/stats-dashboard.component';

@Component({
    selector: 'app-personal-tracker',
    standalone: true,
    imports: [CommonModule, RouterModule, StatsDashboardComponent],
    templateUrl: './personal-tracker.component.html',
    styleUrls: ['./personal-tracker.component.css']
})
export class PersonalTrackerComponent {
}
