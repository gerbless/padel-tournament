import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Court } from './entities/court.entity';
import { CourtPriceBlock } from './entities/court-price-block.entity';
import { Reservation, ReservationStatus, PriceType, PaymentStatus } from './entities/reservation.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreatePriceBlockDto } from './dto/create-price-block.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { MercadoPagoPayment } from '../payments/entities/mercadopago-payment.entity';

@Injectable()
export class CourtsService {
    constructor(
        @InjectRepository(Court)
        private courtRepository: Repository<Court>,
        @InjectRepository(CourtPriceBlock)
        private priceBlockRepository: Repository<CourtPriceBlock>,
        @InjectRepository(Reservation)
        private reservationRepository: Repository<Reservation>,
        @InjectRepository(MercadoPagoPayment)
        private mpPaymentRepository: Repository<MercadoPagoPayment>,
    ) { }

    // ==========================================
    // COURTS CRUD
    // ==========================================

    async createCourt(dto: CreateCourtDto): Promise<Court> {
        const court = this.courtRepository.create(dto);
        return this.courtRepository.save(court);
    }

    async copyPriceBlocks(targetCourtId: string, sourceCourtId: string): Promise<CourtPriceBlock[]> {
        const sourceBlocks = await this.priceBlockRepository.find({ where: { courtId: sourceCourtId } });
        if (sourceBlocks.length === 0) return [];

        const newBlocks: CourtPriceBlock[] = [];
        for (const block of sourceBlocks) {
            const newBlock = this.priceBlockRepository.create({
                courtId: targetCourtId,
                daysOfWeek: [...block.daysOfWeek],
                startTime: block.startTime,
                endTime: block.endTime,
                priceFullCourt: block.priceFullCourt,
                pricePerPlayer: block.pricePerPlayer,
            });
            newBlocks.push(await this.priceBlockRepository.save(newBlock));
        }
        return newBlocks;
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

    async bulkUpdatePriceBlocks(
        clubId: string,
        matchCriteria: { startTime: string; endTime: string; daysOfWeek: number[] },
        newValues: Partial<CreatePriceBlockDto>,
    ): Promise<{ updated: number }> {
        // Get all courts for this club
        const courts = await this.courtRepository.find({ where: { clubId } });
        const courtIds = courts.map(c => c.id);
        if (courtIds.length === 0) return { updated: 0 };

        // Find all matching price blocks across these courts
        const allBlocks = await this.priceBlockRepository.find({
            where: { courtId: In(courtIds) },
        });

        const sortedMatch = [...matchCriteria.daysOfWeek].sort().join(',');
        const matching = allBlocks.filter(b =>
            b.startTime === matchCriteria.startTime &&
            b.endTime === matchCriteria.endTime &&
            [...b.daysOfWeek].sort().join(',') === sortedMatch
        );

        for (const block of matching) {
            Object.assign(block, newValues);
            await this.priceBlockRepository.save(block);
        }

        return { updated: matching.length };
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
            paymentMethod: (dto.paymentMethod as any) || null,
            paymentNotes: dto.paymentNotes,
            playerPayments: dto.playerPayments || null,
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
            .select(`COALESCE(SUM(
                CASE WHEN r.playerPayments IS NOT NULL AND jsonb_array_length(r.playerPayments) > 0
                     THEN (SELECT COALESCE(SUM((pp->>'amount')::numeric), 0) FROM jsonb_array_elements(r.playerPayments) pp)
                     ELSE CAST(r.finalPrice AS numeric)
                END
            ), 0)`, 'totalRevenue')
            .addSelect('COUNT(r.id)', 'totalReservations')
            .addSelect(`COALESCE(SUM(
                CASE WHEN r.playerPayments IS NOT NULL AND jsonb_array_length(r.playerPayments) > 0
                     THEN (SELECT COALESCE(SUM(CASE WHEN (pp->>'paid')::boolean THEN (pp->>'amount')::numeric ELSE 0 END), 0) FROM jsonb_array_elements(r.playerPayments) pp)
                     ELSE CASE WHEN r.paymentStatus = 'paid' THEN CAST(r.finalPrice AS numeric) ELSE 0 END
                END
            ), 0)`, 'paidRevenue')
            .addSelect(`COALESCE(SUM(
                CASE WHEN r.playerPayments IS NOT NULL AND jsonb_array_length(r.playerPayments) > 0
                     THEN (SELECT COALESCE(SUM(CASE WHEN NOT (pp->>'paid')::boolean THEN (pp->>'amount')::numeric ELSE 0 END), 0) FROM jsonb_array_elements(r.playerPayments) pp)
                     ELSE CASE WHEN r.paymentStatus IN ('pending', 'partial') THEN CAST(r.finalPrice AS numeric) ELSE 0 END
                END
            ), 0)`, 'pendingRevenue')
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
            .addSelect(`COALESCE(SUM(
                CASE WHEN r.playerPayments IS NOT NULL AND jsonb_array_length(r.playerPayments) > 0
                     THEN (SELECT COALESCE(SUM((pp->>'amount')::numeric), 0) FROM jsonb_array_elements(r.playerPayments) pp)
                     ELSE CAST(r.finalPrice AS numeric)
                END
            ), 0)`, 'totalRevenue')
            .addSelect('COUNT(r.id)', 'totalReservations')
            .addSelect(`COALESCE(SUM(
                CASE WHEN r.playerPayments IS NOT NULL AND jsonb_array_length(r.playerPayments) > 0
                     THEN (SELECT COALESCE(SUM(CASE WHEN (pp->>'paid')::boolean THEN (pp->>'amount')::numeric ELSE 0 END), 0) FROM jsonb_array_elements(r.playerPayments) pp)
                     ELSE CASE WHEN r.paymentStatus = 'paid' THEN CAST(r.finalPrice AS numeric) ELSE 0 END
                END
            ), 0)`, 'paidRevenue')
            .where('r.clubId = :clubId', { clubId })
            .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED })
            .andWhere("EXTRACT(YEAR FROM r.date::date) = :year", { year })
            .groupBy("EXTRACT(MONTH FROM r.date::date)")
            .orderBy("EXTRACT(MONTH FROM r.date::date)", 'ASC')
            .getRawMany();
    }

    async getBillingDashboard(clubId: string, year: number, month?: number): Promise<any> {
        const dateFilter = month
            ? `EXTRACT(YEAR FROM r."date"::date) = ${year} AND EXTRACT(MONTH FROM r."date"::date) = ${month}`
            : `EXTRACT(YEAR FROM r."date"::date) = ${year}`;

        /**
         * Revenue helpers (handle per-player payments via playerPayments JSONB).
         * - totalRevenue: sum of all player amounts (or finalPrice for non per-player)
         * - paidRevenue / partialRevenue / pendingRevenue: grouped by reservation paymentStatus (for donuts)
         * - collectedRevenue: actual money collected (paid playerPayments + fully-paid finalPrice)
         * - owedRevenue:      actual money still owed  (unpaid playerPayments + pending/partial finalPrice)
         */
        const ppTotal = `(SELECT COALESCE(SUM((pp->>'amount')::numeric), 0) FROM jsonb_array_elements(r."playerPayments") pp)`;
        const ppPaid  = `(SELECT COALESCE(SUM(CASE WHEN (pp->>'paid')::boolean THEN (pp->>'amount')::numeric ELSE 0 END), 0) FROM jsonb_array_elements(r."playerPayments") pp)`;
        const ppOwed  = `(SELECT COALESCE(SUM(CASE WHEN NOT (pp->>'paid')::boolean THEN (pp->>'amount')::numeric ELSE 0 END), 0) FROM jsonb_array_elements(r."playerPayments") pp)`;
        const hasPP   = `r."playerPayments" IS NOT NULL AND jsonb_array_length(r."playerPayments") > 0`;
        const fp      = `CAST(r."finalPrice" AS numeric)`;

        const revenueColumns = `
                COALESCE(SUM(CASE WHEN ${hasPP} THEN ${ppTotal} ELSE ${fp} END), 0) AS "totalRevenue",
                COALESCE(SUM(CASE WHEN ${hasPP} THEN CASE WHEN r."paymentStatus" = 'paid' THEN ${ppTotal} ELSE 0 END
                                                   ELSE CASE WHEN r."paymentStatus" = 'paid' THEN ${fp} ELSE 0 END END), 0) AS "paidRevenue",
                COALESCE(SUM(CASE WHEN ${hasPP} THEN CASE WHEN r."paymentStatus" = 'partial' THEN ${ppTotal} ELSE 0 END
                                                   ELSE CASE WHEN r."paymentStatus" = 'partial' THEN ${fp} ELSE 0 END END), 0) AS "partialRevenue",
                COALESCE(SUM(CASE WHEN ${hasPP} THEN CASE WHEN r."paymentStatus" = 'pending' THEN ${ppTotal} ELSE 0 END
                                                   ELSE CASE WHEN r."paymentStatus" = 'pending' THEN ${fp} ELSE 0 END END), 0) AS "pendingRevenue",
                COALESCE(SUM(CASE WHEN ${hasPP} THEN ${ppPaid}
                                                   ELSE CASE WHEN r."paymentStatus" = 'paid' THEN ${fp} ELSE 0 END END), 0) AS "collectedRevenue",
                COALESCE(SUM(CASE WHEN ${hasPP} THEN ${ppOwed}
                                                   ELSE CASE WHEN r."paymentStatus" IN ('pending','partial') THEN ${fp} ELSE 0 END END), 0) AS "owedRevenue"`;

        // Per-court breakdown
        const perCourt = await this.reservationRepository.query(`
            SELECT
                c."id" AS "courtId",
                c."name" AS "courtName",
                c."courtNumber",
                COUNT(r."id") AS "totalReservations",
                COUNT(CASE WHEN r."paymentStatus" = 'paid' THEN 1 END) AS "paidCount",
                COUNT(CASE WHEN r."paymentStatus" = 'partial' THEN 1 END) AS "partialCount",
                COUNT(CASE WHEN r."paymentStatus" = 'pending' THEN 1 END) AS "pendingCount",
                ${revenueColumns}
            FROM "courts" c
            LEFT JOIN "reservations" r ON r."courtId" = c."id"
                AND r."status" != 'cancelled'
                AND ${dateFilter}
            WHERE c."clubId" = $1 AND c."isActive" = true
            GROUP BY c."id", c."name", c."courtNumber"
            ORDER BY c."courtNumber" ASC
        `, [clubId]);

        // Totals
        const totals = await this.reservationRepository.query(`
            SELECT
                COUNT(r."id") AS "totalReservations",
                COUNT(CASE WHEN r."paymentStatus" = 'paid' THEN 1 END) AS "paidCount",
                COUNT(CASE WHEN r."paymentStatus" = 'partial' THEN 1 END) AS "partialCount",
                COUNT(CASE WHEN r."paymentStatus" = 'pending' THEN 1 END) AS "pendingCount",
                ${revenueColumns}
            FROM "reservations" r
            JOIN "courts" c ON r."courtId" = c."id"
            WHERE c."clubId" = $1
                AND r."status" != 'cancelled'
                AND ${dateFilter}
        `, [clubId]);

        // Monthly trend for the year
        const monthlyRevenueColumns = `
                COALESCE(SUM(CASE WHEN ${hasPP} THEN ${ppTotal} ELSE ${fp} END), 0) AS "totalRevenue",
                COALESCE(SUM(CASE WHEN ${hasPP} THEN ${ppPaid}
                                                   ELSE CASE WHEN r."paymentStatus" = 'paid' THEN ${fp} ELSE 0 END END), 0) AS "paidRevenue",
                COALESCE(SUM(CASE WHEN ${hasPP} THEN ${ppOwed}
                                                   ELSE CASE WHEN r."paymentStatus" IN ('pending','partial') THEN ${fp} ELSE 0 END END), 0) AS "pendingRevenue",
                COALESCE(SUM(CASE WHEN ${hasPP} THEN CASE WHEN r."paymentStatus" = 'partial' THEN ${ppTotal} ELSE 0 END
                                                   ELSE CASE WHEN r."paymentStatus" = 'partial' THEN ${fp} ELSE 0 END END), 0) AS "partialRevenue"`;

        const monthlyTrend = await this.reservationRepository.query(`
            SELECT
                EXTRACT(MONTH FROM r."date"::date) AS "month",
                ${monthlyRevenueColumns},
                COUNT(r."id") AS "totalReservations"
            FROM "reservations" r
            JOIN "courts" c ON r."courtId" = c."id"
            WHERE c."clubId" = $1
                AND r."status" != 'cancelled'
                AND EXTRACT(YEAR FROM r."date"::date) = ${year}
            GROUP BY EXTRACT(MONTH FROM r."date"::date)
            ORDER BY "month" ASC
        `, [clubId]);

        // Payment method statistics
        // Counts from full-court reservations (non per-player) — only paid/partial
        const fullCourtMethods = await this.reservationRepository.query(`
            SELECT COALESCE(r."paymentMethod"::text, 'sin_especificar') AS method,
                   COUNT(*) AS count,
                   COALESCE(SUM(${fp}), 0) AS revenue
            FROM "reservations" r
            JOIN "courts" c ON r."courtId" = c."id"
            WHERE c."clubId" = $1
                AND r."status" != 'cancelled'
                AND ${dateFilter}
                AND (r."playerPayments" IS NULL OR jsonb_array_length(r."playerPayments") = 0)
                AND r."paymentStatus" IN ('paid', 'partial')
            GROUP BY COALESCE(r."paymentMethod"::text, 'sin_especificar')
        `, [clubId]);

        // Counts from per-player payments (only paid individual payments)
        const perPlayerMethods = await this.reservationRepository.query(`
            SELECT COALESCE(NULLIF(pp->>'paymentMethod', ''), 'sin_especificar') AS method,
                   COUNT(*) AS count,
                   COALESCE(SUM((pp->>'amount')::numeric), 0) AS revenue
            FROM "reservations" r
            JOIN "courts" c ON r."courtId" = c."id",
                 jsonb_array_elements(r."playerPayments") pp
            WHERE c."clubId" = $1
                AND r."status" != 'cancelled'
                AND ${dateFilter}
                AND r."playerPayments" IS NOT NULL
                AND jsonb_array_length(r."playerPayments") > 0
                AND (pp->>'paid')::boolean = true
            GROUP BY COALESCE(NULLIF(pp->>'paymentMethod', ''), 'sin_especificar')
        `, [clubId]);

        // Merge both sources
        const methodMap: Record<string, { count: number; revenue: number }> = {};
        for (const row of [...fullCourtMethods, ...perPlayerMethods]) {
            const m = row.method;
            if (!m) continue;
            if (!methodMap[m]) methodMap[m] = { count: 0, revenue: 0 };
            methodMap[m].count += +row.count;
            methodMap[m].revenue += +row.revenue;
        }
        const paymentMethodStats = Object.entries(methodMap).map(([method, data]) => ({
            method,
            count: data.count,
            revenue: data.revenue
        }));

        return {
            courts: perCourt,
            totals: totals[0] || {},
            monthlyTrend,
            paymentMethodStats
        };
    }

    async getPlayerBillingHistory(clubId: string, year: number, month?: number): Promise<any> {
        const dateFilter = month
            ? `EXTRACT(YEAR FROM r."date"::date) = ${year} AND EXTRACT(MONTH FROM r."date"::date) = ${month}`
            : `EXTRACT(YEAR FROM r."date"::date) = ${year}`;

        // Get all reservations for the period with their player data
        const reservations = await this.reservationRepository.query(`
            SELECT
                r."id",
                r."players",
                r."playerCount",
                r."priceType",
                r."finalPrice"::numeric AS "finalPrice",
                r."paymentStatus",
                r."paymentMethod",
                r."playerPayments"
            FROM "reservations" r
            JOIN "courts" c ON r."courtId" = c."id"
            WHERE c."clubId" = $1
                AND r."status" != 'cancelled'
                AND ${dateFilter}
        `, [clubId]);

        // Build per-player stats
        const playerMap: Record<string, {
            name: string;
            gamesPlayed: number;
            totalBilled: number;
            totalPaid: number;
            totalOwed: number;
            paymentMethods: Record<string, number>;
        }> = {};

        for (const res of reservations) {
            const players: string[] = res.players || [];
            const fp = +res.finalPrice || 0;
            const pp: any[] = res.playerPayments || [];
            const hasPP = pp.length > 0;
            const playerCount = players.length || res.playerCount || 4;

            for (const playerName of players) {
                if (!playerName || !playerName.trim()) continue;
                const key = playerName.trim().toLowerCase();

                if (!playerMap[key]) {
                    playerMap[key] = {
                        name: playerName.trim(),
                        gamesPlayed: 0,
                        totalBilled: 0,
                        totalPaid: 0,
                        totalOwed: 0,
                        paymentMethods: {}
                    };
                }
                const p = playerMap[key];
                p.gamesPlayed++;

                if (hasPP) {
                    // Per-player payment: find this player's payment entry
                    const ppEntry = pp.find((e: any) => e.playerName?.trim().toLowerCase() === key);
                    if (ppEntry) {
                        const amount = +(ppEntry.amount || 0);
                        p.totalBilled += amount;
                        if (ppEntry.paid) {
                            p.totalPaid += amount;
                            const method = ppEntry.paymentMethod || 'sin_especificar';
                            p.paymentMethods[method] = (p.paymentMethods[method] || 0) + 1;
                        } else {
                            p.totalOwed += amount;
                        }
                    } else {
                        // Player is in list but no payment entry
                        const share = fp / playerCount;
                        p.totalBilled += share;
                        p.totalOwed += share;
                    }
                } else {
                    // Full-court: divide evenly
                    const share = fp / playerCount;
                    p.totalBilled += share;
                    if (res.paymentStatus === 'paid') {
                        p.totalPaid += share;
                        const method = res.paymentMethod || 'sin_especificar';
                        p.paymentMethods[method] = (p.paymentMethods[method] || 0) + 1;
                    } else if (res.paymentStatus === 'partial') {
                        // For partial, count half as approximation
                        p.totalPaid += share * 0.5;
                        p.totalOwed += share * 0.5;
                    } else {
                        p.totalOwed += share;
                    }
                }
            }
        }

        const playerStats = Object.values(playerMap)
            .map(p => ({
                ...p,
                totalBilled: Math.round(p.totalBilled),
                totalPaid: Math.round(p.totalPaid),
                totalOwed: Math.round(p.totalOwed),
                paymentMethods: Object.entries(p.paymentMethods).map(([method, count]) => ({ method, count }))
            }))
            .sort((a, b) => b.gamesPlayed - a.gamesPlayed);

        return { players: playerStats };
    }

    // ==========================================
    // AVAILABLE SLOTS (PUBLIC)
    // ==========================================

    async getAvailableSlots(clubId: string, date: string) {
        const dayOfWeek = new Date(date + 'T12:00:00').getDay();

        const courts = await this.courtRepository.find({
            where: { clubId, isActive: true },
            relations: ['priceBlocks'],
            order: { courtNumber: 'ASC' },
        });

        const reservations = await this.reservationRepository.find({
            where: { clubId, date, status: ReservationStatus.CONFIRMED },
        });

        return courts.map(court => {
            const blocks = (court.priceBlocks || [])
                .filter(b => b.daysOfWeek.includes(dayOfWeek))
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

            const slots = blocks.map(block => {
                const isReserved = reservations.some(r =>
                    r.courtId === court.id &&
                    ((block.startTime >= r.startTime && block.startTime < r.endTime) ||
                     (block.endTime > r.startTime && block.endTime <= r.endTime) ||
                     (block.startTime <= r.startTime && block.endTime >= r.endTime))
                );

                return {
                    startTime: block.startTime,
                    endTime: block.endTime,
                    priceFullCourt: Number(block.priceFullCourt),
                    pricePerPlayer: Number(block.pricePerPlayer),
                    available: !isReserved,
                };
            });

            return {
                courtId: court.id,
                courtName: court.name,
                courtNumber: court.courtNumber,
                surfaceType: court.surfaceType,
                slots,
            };
        });
    }

    // ==========================================
    // PLAYER BOOKINGS
    // ==========================================

    async createPlayerBooking(userId: string, playerId: string, playerName: string, dto: {
        courtId: string;
        clubId: string;
        date: string;
        startTime: string;
        endTime: string;
    }): Promise<Reservation> {
        // Get price
        const priceBlock = await this.getPrice(dto.courtId, dto.date, dto.startTime);
        const price = priceBlock ? Number(priceBlock.priceFullCourt) : 0;

        return this.createReservation({
            courtId: dto.courtId,
            clubId: dto.clubId,
            date: dto.date,
            startTime: dto.startTime,
            endTime: dto.endTime,
            title: `Reserva - ${playerName}`,
            players: [playerName],
            playerCount: 4,
            priceType: 'full_court',
            finalPrice: price,
            paymentStatus: 'pending',
        } as CreateReservationDto);
    }

    async getPlayerBookings(playerId: string, playerName: string, clubId?: string): Promise<any[]> {
        const qb = this.reservationRepository
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.court', 'court')
            .where("r.title LIKE :pattern", { pattern: `%${playerName}%` })
            .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED });

        if (clubId) {
            qb.andWhere('r.clubId = :clubId', { clubId });
        }

        const reservations = await qb.orderBy('r.date', 'DESC')
            .addOrderBy('r.startTime', 'ASC')
            .getMany();

        // Enrich with MP payment statusDetail
        const reservationIds = reservations.map(r => r.id);
        let mpPaymentMap: Record<string, { status: string; statusDetail: string | null }> = {};
        if (reservationIds.length > 0) {
            const mpPayments = await this.mpPaymentRepository
                .createQueryBuilder('mp')
                .where('mp.reservationId IN (:...ids)', { ids: reservationIds })
                .orderBy('mp.createdAt', 'DESC')
                .getMany();

            // Keep only the latest payment per reservation
            for (const mp of mpPayments) {
                if (!mpPaymentMap[mp.reservationId]) {
                    mpPaymentMap[mp.reservationId] = { status: mp.status, statusDetail: mp.statusDetail };
                }
            }
        }

        return reservations.map(r => ({
            ...r,
            mpStatus: mpPaymentMap[r.id]?.status || null,
            mpStatusDetail: mpPaymentMap[r.id]?.statusDetail || null,
        }));
    }

    async cancelPlayerBooking(playerId: string, playerName: string, reservationId: string): Promise<Reservation> {
        const reservation = await this.reservationRepository.findOne({ where: { id: reservationId } });
        if (!reservation) throw new NotFoundException('Reserva no encontrada');

        // Verify this reservation belongs to this player
        if (!reservation.title?.includes(playerName)) {
            throw new ForbiddenException('No tienes permiso para cancelar esta reserva');
        }

        // Prevent cancellation of paid reservations
        if (reservation.paymentStatus === PaymentStatus.PAID) {
            throw new ForbiddenException('No puedes cancelar una reserva que ya fue pagada');
        }

        // Delete the reservation (cascades to mercadopago_payments via FK)
        await this.reservationRepository.remove(reservation);

        // Return the deleted entity (id will be gone but data is still in memory)
        return reservation;
    }
}
