import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Court } from './entities/court.entity';
import { CourtPriceBlock } from './entities/court-price-block.entity';
import { Reservation, ReservationStatus, PriceType, PaymentStatus } from './entities/reservation.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreatePriceBlockDto } from './dto/create-price-block.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class CourtsService {
    constructor(
        @InjectRepository(Court)
        private courtRepository: Repository<Court>,
        @InjectRepository(CourtPriceBlock)
        private priceBlockRepository: Repository<CourtPriceBlock>,
        @InjectRepository(Reservation)
        private reservationRepository: Repository<Reservation>,
    ) { }

    // ==========================================
    // COURTS CRUD
    // ==========================================

    async createCourt(dto: CreateCourtDto): Promise<Court> {
        const court = this.courtRepository.create(dto);
        return this.courtRepository.save(court);
    }

    async findCourtsByClub(clubId: string): Promise<Court[]> {
        return this.courtRepository.find({
            where: { clubId },
            relations: ['priceBlocks'],
            order: { courtNumber: 'ASC' }
        });
    }

    async findCourt(id: string): Promise<Court> {
        const court = await this.courtRepository.findOne({
            where: { id },
            relations: ['priceBlocks']
        });
        if (!court) throw new NotFoundException(`Court ${id} not found`);
        return court;
    }

    async updateCourt(id: string, dto: Partial<CreateCourtDto>): Promise<Court> {
        const court = await this.findCourt(id);
        Object.assign(court, dto);
        return this.courtRepository.save(court);
    }

    async removeCourt(id: string): Promise<void> {
        const court = await this.findCourt(id);
        await this.courtRepository.remove(court);
    }

    // ==========================================
    // PRICE BLOCKS
    // ==========================================

    async createPriceBlock(dto: CreatePriceBlockDto): Promise<CourtPriceBlock> {
        const block = this.priceBlockRepository.create(dto);
        return this.priceBlockRepository.save(block);
    }

    async createPriceBlockForAllCourts(clubId: string, dto: CreatePriceBlockDto): Promise<CourtPriceBlock[]> {
        const courts = await this.courtRepository.find({ where: { clubId, isActive: true } });
        const blocks: CourtPriceBlock[] = [];
        for (const court of courts) {
            const block = this.priceBlockRepository.create({
                ...dto,
                courtId: court.id,
            });
            blocks.push(await this.priceBlockRepository.save(block));
        }
        return blocks;
    }

    async getPriceBlocks(courtId: string): Promise<CourtPriceBlock[]> {
        return this.priceBlockRepository.find({
            where: { courtId },
            order: { startTime: 'ASC' }
        });
    }

    async updatePriceBlock(id: string, dto: Partial<CreatePriceBlockDto>): Promise<CourtPriceBlock> {
        const block = await this.priceBlockRepository.findOne({ where: { id } });
        if (!block) throw new NotFoundException(`Price block ${id} not found`);
        Object.assign(block, dto);
        return this.priceBlockRepository.save(block);
    }

    async removePriceBlock(id: string): Promise<void> {
        const block = await this.priceBlockRepository.findOne({ where: { id } });
        if (!block) throw new NotFoundException(`Price block ${id} not found`);
        await this.priceBlockRepository.remove(block);
    }

    /**
     * Find the applicable price block for a given court, date and time
     */
    async getPrice(courtId: string, date: string, startTime: string): Promise<CourtPriceBlock | null> {
        const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Sunday
        const blocks = await this.priceBlockRepository.find({ where: { courtId } });

        return blocks.find(b =>
            b.daysOfWeek.includes(dayOfWeek) &&
            b.startTime <= startTime &&
            b.endTime > startTime
        ) || null;
    }

    // ==========================================
    // RESERVATIONS
    // ==========================================

    async createReservation(dto: CreateReservationDto): Promise<Reservation> {
        // Check for time conflicts
        const conflicts = await this.reservationRepository.find({
            where: {
                courtId: dto.courtId,
                date: dto.date,
                status: ReservationStatus.CONFIRMED
            }
        });

        const hasConflict = conflicts.some(r =>
            (dto.startTime >= r.startTime && dto.startTime < r.endTime) ||
            (dto.endTime > r.startTime && dto.endTime <= r.endTime) ||
            (dto.startTime <= r.startTime && dto.endTime >= r.endTime)
        );

        if (hasConflict) {
            throw new BadRequestException('Ya existe una reserva en ese horario');
        }

        // Auto-calculate price from price blocks if not provided
        if (dto.finalPrice === undefined || dto.finalPrice === null) {
            const priceBlock = await this.getPrice(dto.courtId, dto.date, dto.startTime);
            if (priceBlock) {
                const basePrice = dto.priceType === 'per_player'
                    ? Number(priceBlock.pricePerPlayer)
                    : Number(priceBlock.priceFullCourt);
                (dto as any).basePrice = basePrice;
                dto.finalPrice = basePrice;
            }
        }

        const reservation = this.reservationRepository.create({
            courtId: dto.courtId,
            clubId: dto.clubId,
            date: dto.date,
            startTime: dto.startTime,
            endTime: dto.endTime,
            title: dto.title,
            players: dto.players || [],
            playerCount: dto.playerCount || 4,
            priceType: (dto.priceType as any) || PriceType.FULL_COURT,
            basePrice: (dto as any).basePrice || dto.finalPrice || 0,
            finalPrice: dto.finalPrice || 0,
            paymentStatus: (dto.paymentStatus as any) || PaymentStatus.PENDING,
            paymentNotes: dto.paymentNotes,
        } as Partial<Reservation>);
        return this.reservationRepository.save(reservation as Reservation);
    }

    async getReservations(courtId: string, startDate: string, endDate: string): Promise<Reservation[]> {
        return this.reservationRepository
            .createQueryBuilder('r')
            .where('r.courtId = :courtId', { courtId })
            .andWhere('r.date >= :startDate', { startDate })
            .andWhere('r.date <= :endDate', { endDate })
            .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED })
            .orderBy('r.date', 'ASC')
            .addOrderBy('r.startTime', 'ASC')
            .getMany();
    }

    async getReservationsByClub(clubId: string, startDate: string, endDate: string): Promise<Reservation[]> {
        return this.reservationRepository
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.court', 'court')
            .where('r.clubId = :clubId', { clubId })
            .andWhere('r.date >= :startDate', { startDate })
            .andWhere('r.date <= :endDate', { endDate })
            .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED })
            .orderBy('r.date', 'ASC')
            .addOrderBy('r.startTime', 'ASC')
            .getMany();
    }

    async updateReservation(id: string, dto: Partial<CreateReservationDto>): Promise<Reservation> {
        const reservation = await this.reservationRepository.findOne({ where: { id } });
        if (!reservation) throw new NotFoundException(`Reservation ${id} not found`);

        // If time changed, check conflicts
        if (dto.startTime || dto.endTime || dto.date) {
            const checkDate = dto.date || reservation.date;
            const checkStart = dto.startTime || reservation.startTime;
            const checkEnd = dto.endTime || reservation.endTime;
            const checkCourtId = dto.courtId || reservation.courtId;

            const conflicts = await this.reservationRepository.find({
                where: {
                    courtId: checkCourtId,
                    date: checkDate,
                    status: ReservationStatus.CONFIRMED
                }
            });

            const hasConflict = conflicts
                .filter(r => r.id !== id)
                .some(r =>
                    (checkStart >= r.startTime && checkStart < r.endTime) ||
                    (checkEnd > r.startTime && checkEnd <= r.endTime) ||
                    (checkStart <= r.startTime && checkEnd >= r.endTime)
                );

            if (hasConflict) {
                throw new BadRequestException('Ya existe una reserva en ese horario');
            }
        }

        Object.assign(reservation, dto);
        return this.reservationRepository.save(reservation);
    }

    async cancelReservation(id: string): Promise<Reservation> {
        const reservation = await this.reservationRepository.findOne({ where: { id } });
        if (!reservation) throw new NotFoundException(`Reservation ${id} not found`);
        reservation.status = ReservationStatus.CANCELLED;
        return this.reservationRepository.save(reservation);
    }

    // ==========================================
    // REVENUE REPORTS
    // ==========================================

    async getRevenue(clubId: string, year: number, month?: number): Promise<any> {
        const qb = this.reservationRepository
            .createQueryBuilder('r')
            .select('COALESCE(SUM(CAST(r.finalPrice AS numeric)), 0)', 'totalRevenue')
            .addSelect('COUNT(r.id)', 'totalReservations')
            .addSelect("COALESCE(SUM(CASE WHEN r.paymentStatus = 'paid' THEN CAST(r.finalPrice AS numeric) ELSE 0 END), 0)", 'paidRevenue')
            .addSelect("COALESCE(SUM(CASE WHEN r.paymentStatus = 'pending' THEN CAST(r.finalPrice AS numeric) ELSE 0 END), 0)", 'pendingRevenue')
            .where('r.clubId = :clubId', { clubId })
            .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED })
            .andWhere("EXTRACT(YEAR FROM r.date::date) = :year", { year });

        if (month) {
            qb.andWhere("EXTRACT(MONTH FROM r.date::date) = :month", { month });
        }

        return qb.getRawOne();
    }

    async getMonthlyRevenue(clubId: string, year: number): Promise<any[]> {
        return this.reservationRepository
            .createQueryBuilder('r')
            .select("EXTRACT(MONTH FROM r.date::date)", 'month')
            .addSelect('COALESCE(SUM(CAST(r.finalPrice AS numeric)), 0)', 'totalRevenue')
            .addSelect('COUNT(r.id)', 'totalReservations')
            .addSelect("COALESCE(SUM(CASE WHEN r.paymentStatus = 'paid' THEN CAST(r.finalPrice AS numeric) ELSE 0 END), 0)", 'paidRevenue')
            .where('r.clubId = :clubId', { clubId })
            .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED })
            .andWhere("EXTRACT(YEAR FROM r.date::date) = :year", { year })
            .groupBy("EXTRACT(MONTH FROM r.date::date)")
            .orderBy("EXTRACT(MONTH FROM r.date::date)", 'ASC')
            .getRawMany();
    }
}
