import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Court, CourtPriceBlock, Reservation, RevenueReport, MonthlyRevenue } from '../models/court.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CourtService {
    private apiUrl = `${environment.apiUrl}/courts`;

    constructor(private http: HttpClient) { }

    // Courts
    getCourtsByClub(clubId: string): Observable<Court[]> {
        return this.http.get<Court[]>(`${this.apiUrl}/club/${clubId}`);
    }

    getCourt(id: string): Observable<Court> {
        return this.http.get<Court>(`${this.apiUrl}/${id}`);
    }

    createCourt(data: Partial<Court>): Observable<Court> {
        return this.http.post<Court>(this.apiUrl, data);
    }

    updateCourt(id: string, data: Partial<Court>): Observable<Court> {
        return this.http.patch<Court>(`${this.apiUrl}/${id}`, data);
    }

    deleteCourt(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    // Price Blocks
    getPriceBlocks(courtId: string): Observable<CourtPriceBlock[]> {
        return this.http.get<CourtPriceBlock[]>(`${this.apiUrl}/${courtId}/price-blocks`);
    }

    createPriceBlock(courtId: string, data: Partial<CourtPriceBlock>): Observable<CourtPriceBlock> {
        return this.http.post<CourtPriceBlock>(`${this.apiUrl}/${courtId}/price-blocks`, data);
    }

    createPriceBlockForAllCourts(clubId: string, data: Partial<CourtPriceBlock>): Observable<CourtPriceBlock[]> {
        return this.http.post<CourtPriceBlock[]>(`${this.apiUrl}/club/${clubId}/price-blocks/batch`, data);
    }

    updatePriceBlock(id: string, data: Partial<CourtPriceBlock>): Observable<CourtPriceBlock> {
        return this.http.patch<CourtPriceBlock>(`${this.apiUrl}/price-blocks/${id}`, data);
    }

    deletePriceBlock(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/price-blocks/${id}`);
    }

    getPrice(courtId: string, date: string, startTime: string): Observable<CourtPriceBlock> {
        return this.http.get<CourtPriceBlock>(`${this.apiUrl}/${courtId}/price`, {
            params: { date, startTime }
        });
    }

    // Reservations
    getReservations(courtId: string, startDate: string, endDate: string): Observable<Reservation[]> {
        return this.http.get<Reservation[]>(`${this.apiUrl}/${courtId}/reservations`, {
            params: { startDate, endDate }
        });
    }

    getReservationsByClub(clubId: string, startDate: string, endDate: string): Observable<Reservation[]> {
        return this.http.get<Reservation[]>(`${this.apiUrl}/club/${clubId}/reservations`, {
            params: { startDate, endDate }
        });
    }

    createReservation(data: Partial<Reservation>): Observable<Reservation> {
        return this.http.post<Reservation>(`${this.apiUrl}/reservations`, data);
    }

    updateReservation(id: string, data: Partial<Reservation>): Observable<Reservation> {
        return this.http.patch<Reservation>(`${this.apiUrl}/reservations/${id}`, data);
    }

    cancelReservation(id: string): Observable<Reservation> {
        return this.http.delete<Reservation>(`${this.apiUrl}/reservations/${id}`);
    }

    // Revenue
    getRevenue(clubId: string, year: number, month?: number): Observable<RevenueReport> {
        const params: any = { year };
        if (month) params.month = month;
        return this.http.get<RevenueReport>(`${this.apiUrl}/club/${clubId}/revenue`, { params });
    }

    getMonthlyRevenue(clubId: string, year: number): Observable<MonthlyRevenue[]> {
        return this.http.get<MonthlyRevenue[]>(`${this.apiUrl}/club/${clubId}/revenue/monthly`, {
            params: { year }
        });
    }
}
