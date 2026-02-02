import { Routes } from '@angular/router';
import { PersonalTrackerComponent } from './personal-tracker.component';
import { MatchFormComponent } from './components/match-form/match-form.component';

export const PERSONAL_TRACKER_ROUTES: Routes = [
    {
        path: '',
        component: PersonalTrackerComponent
    },
    {
        path: 'new',
        component: MatchFormComponent
    }
];
