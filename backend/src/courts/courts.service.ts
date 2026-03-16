import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Court } from './entities/court.entity';
import { CourtPriceBlock } from './entities/court-price-block.entity';
import { Reservation, ReservationStatus, PriceType, PaymentStatus } from './entities/reservation.entity';
import { CourtBlock, BlockType } from './entities/court-block.entity';
import { FreePlayMatch } from './entities/free-play-match.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreatePriceBlockDto } from './dto/create-price-block.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CreateCourtBlockDto } from './dto/create-court-block.dto';
import { MercadoPagoPayment } from '../payments/entities/mercadopago-payment.entity';
import { ClubsService } from '../clubs/clubs.service';
import { ClubCredentialsService } from '../clubs/club-credentials.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class CourtsService {
    private readonly logger = new Logger(CourtsService.name);

    constructor(
        private clubsService: ClubsService,
        private credentialsService: ClubCredentialsService,
        private usersService: UsersService,
        private emailService: EmailService,
        private notificationsService: NotificationsService,
        private tenant: TenantService,
    ) { }

    // ==========================================
    // COURTS CRUD
    // ==========================================

    async createCourt(dto: CreateCourtDto): Promise<Court> {
        return this.tenant.run(dto.clubId, async (em) => {
            const repo = em.getRepository(Court);
            const court = repo.create(dto);
            return repo.save(court);
        });
    }

    async copyPriceBlocks(targetCourtId: string, sourceCourtId: string): Promise<CourtPriceBlock[]> {
        return this.tenant.runInContext(async (em) => {
            const pbRepo = em.getRepository(CourtPriceBlock);
            const sourceBlocks = await pbRepo.find({ where: { courtId: sourceCourtId } });
            if (sourceBlocks.length === 0) return [];

            const newBlocks: CourtPriceBlock[] = [];
            for (const block of sourceBlocks) {
                const newBlock = pbRepo.create({
                    courtId: targetCourtId,
                    daysOfWeek: [...block.daysOfWeek],
                    startTime: block.startTime,
                    endTime: block.endTime,
                    priceFullCourt: block.priceFullCourt,
                    pricePerPlayer: block.pricePerPlayer,
                });
                newBlocks.push(await pbRepo.save(newBlock));
            }
            return newBlocks;
        });
    }

    async findCourtsByClub(clubId: string): Promise<Court[]> {
        return this.tenant.run(clubId, em =>
            em.getRepository(Court).find({
                relations: ['priceBlocks'],
                order: { courtNumber: 'ASC' }
            })
        );
    }

    async findCourt(id: string, clubId?: string): Promise<Court> {
        const cid = clubId || this.tenant.getCurrentClubId();
        if (!cid) throw new BadRequestException('Club ID required');
        return this.tenant.run(cid, async (em) => {
            const court = await em.getRepository(Court).findOne({
                where: { id },
                relations: ['priceBlocks']
            });
            if (!court) throw new NotFoundException(`Court ${id} not found`);
            return court;
        });
    }

    async updateCourt(id: string, dto: Partial<CreateCourtDto>): Promise<Court> {
        return this.tenant.runInContext(async (em) => {
            const repo = em.getRepository(Court);
            const court = await repo.findOne({ where: { id }, relations: ['priceBlocks'] });
            if (!court) throw new NotFoundException(`Court ${id} not found`);
            Object.assign(court, dto);
            return repo.save(court);
        });
    }

    async removeCourt(id: string): Promise<void> {
        return this.tenant.runInContext(async (em) => {
            const repo = em.getRepository(Court);
            const court = await repo.findOne({ where: { id } });
            if (!court) throw new NotFoundException(`Court ${id} not found`);
            await repo.remove(court);
        });
    }

    // ==========================================
    // PRICE BLOCKS
    // ==========================================

    async createPriceBlock(dto: CreatePriceBlockDto): Promise<CourtPriceBlock> {
        return this.tenant.runInContext(async (em) => {
            const block = em.getRepository(CourtPriceBlock).create(dto);
            return em.getRepository(CourtPriceBlock).save(block);
        });
    }

    async createPriceBlockForAllCourts(clubId: string, dto: CreatePriceBlockDto): Promise<CourtPriceBlock[]> {
        return this.tenant.run(clubId, async (em) => {
            const courts = await em.getRepository(Court).find({ where: { clubId, isActive: true } });
            const blocks: CourtPriceBlock[] = [];
            for (const court of courts) {
                const block = em.getRepository(CourtPriceBlock).create({
                    ...dto,
                    courtId: court.id,
                });
                blocks.push(await em.getRepository(CourtPriceBlock).save(block));
            }
            return blocks;
        });
    }

    async getPriceBlocks(courtId: string): Promise<CourtPriceBlock[]> {
        return this.tenant.runInContext(em =>
            em.getRepository(CourtPriceBlock).find({
                where: { courtId },
                order: { startTime: 'ASC' }
            })
        );
    }

    async updatePriceBlock(id: string, dto: Partial<CreatePriceBlockDto>): Promise<CourtPriceBlock> {
        return this.tenant.runInContext(async (em) => {
            const block = await em.getRepository(CourtPriceBlock).findOne({ where: { id } });
            if (!block) throw new NotFoundException(`Price block ${id} not found`);
            Object.assign(block, dto);
            return em.getRepository(CourtPriceBlock).save(block);
        });
    }

    async bulkUpdatePriceBlocks(
        clubId: string,
        matchCriteria: { startTime: string; endTime: string; daysOfWeek: number[] },
        newValues: Partial<CreatePriceBlockDto>,
    ): Promise<{ updated: number }> {
        return this.tenant.run(clubId, async (em) => {
            const courts = await em.getRepository(Court).find({ where: { clubId } });
            const courtIds = courts.map(c => c.id);
            if (courtIds.length === 0) return { updated: 0 };

            const allBlocks = await em.getRepository(CourtPriceBlock).find({
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
                await em.getRepository(CourtPriceBlock).save(block);
            }

            return { updated: matching.length };
        });
    }

    async removePriceBlock(id: string): Promise<void> {
        return this.tenant.runInContext(async (em) => {
            const block = await em.getRepository(CourtPriceBlock).findOne({ where: { id } });
            if (!block) throw new NotFoundException(`Price block ${id} not found`);
            await em.getRepository(CourtPriceBlock).remove(block);
        });
    }

    /**
     * Find the applicable price block for a given court, date and time
     */
    async getPrice(courtId: string, date: string, startTime: string): Promise<CourtPriceBlock | null> {
        const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Sunday
        const blocks = await this.tenant.runInContext(em =>
            em.getRepository(CourtPriceBlock).find({ where: { courtId } })
        );

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
        const cid = dto.clubId || this.tenant.getCurrentClubId();
        if (!cid) throw new BadRequestException('Club ID required');

        return this.tenant.run(cid, async (em) => {
            const reservationRepo = em.getRepository(Reservation);
            // Check for time conflicts
            const conflicts = await reservationRepo.find({
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

            const data: Partial<Reservation> = {
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
            };
            const insertResult = await reservationRepo.insert(data as any);
            const newId = insertResult.identifiers[0].id;
            return reservationRepo.findOne({ where: { id: newId } });
        });
    }

    async getReservations(courtId: string, startDate: string, endDate: string): Promise<Reservation[]> {
        return this.tenant.runInContext(em =>
            em.createQueryBuilder(Reservation, 'r')
                .where('r.courtId = :courtId', { courtId })
                .andWhere('r.date >= :startDate', { startDate })
                .andWhere('r.date <= :endDate', { endDate })
                .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED })
                .orderBy('r.date', 'ASC')
                .addOrderBy('r.startTime', 'ASC')
                .getMany()
        );
    }

    async getReservationsByClub(clubId: string, startDate: string, endDate: string): Promise<Reservation[]> {
        return this.tenant.run(clubId, em =>
            em.createQueryBuilder(Reservation, 'r')
                .leftJoinAndSelect('r.court', 'court')
                .where('r.clubId = :clubId', { clubId })
                .andWhere('r.date >= :startDate', { startDate })
                .andWhere('r.date <= :endDate', { endDate })
                .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED })
                .orderBy('r.date', 'ASC')
                .addOrderBy('r.startTime', 'ASC')
                .getMany()
        );
    }

    async updateReservation(id: string, dto: Partial<CreateReservationDto>): Promise<Reservation> {
        return this.tenant.runInContext(async (em) => {
            const reservationRepo = em.getRepository(Reservation);
            const reservation = await reservationRepo.findOne({ where: { id } });
            if (!reservation) throw new NotFoundException(`Reservation ${id} not found`);

            // If time changed, check conflicts
            if (dto.startTime || dto.endTime || dto.date) {
                const checkDate = dto.date || reservation.date;
                const checkStart = dto.startTime || reservation.startTime;
                const checkEnd = dto.endTime || reservation.endTime;
                const checkCourtId = dto.courtId || reservation.courtId;

                const conflicts = await reservationRepo.find({
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

            await reservationRepo.update(id, dto as any);
            return reservationRepo.findOne({ where: { id } });
        });
    }

    async cancelReservation(id: string): Promise<Reservation> {
        return this.tenant.runInContext(async (em) => {
            const reservationRepo = em.getRepository(Reservation);
            const reservation = await reservationRepo.findOne({ where: { id } });
            if (!reservation) throw new NotFoundException(`Reservation ${id} not found`);
            await reservationRepo.update(id, { status: ReservationStatus.CANCELLED });
            reservation.status = ReservationStatus.CANCELLED;
            return reservation;
        });
    }

    // ==========================================
    // REVENUE REPORTS
    // ==========================================

    async getRevenue(clubId: string, year: number, month?: number): Promise<any> {
        return this.tenant.run(clubId, async (em) => {
            const qb = em.createQueryBuilder(Reservation, 'r')
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
        });
    }

    async getMonthlyRevenue(clubId: string, year: number): Promise<any[]> {
        return this.tenant.run(clubId, em =>
            em.createQueryBuilder(Reservation, 'r')
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
                .getRawMany()
        );
    }

    async getBillingDashboard(clubId: string, year: number, month?: number): Promise<any> {
        return this.tenant.run(clubId, async () => {
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
        const perCourt = await this.tenant.getRepo(Reservation).query(`
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
        const totals = await this.tenant.getRepo(Reservation).query(`
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

        const monthlyTrend = await this.tenant.getRepo(Reservation).query(`
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
        const fullCourtMethods = await this.tenant.getRepo(Reservation).query(`
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
        const perPlayerMethods = await this.tenant.getRepo(Reservation).query(`
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
        }); // end tenant.run
    }

    async getPlayerBillingHistory(clubId: string, year: number, month?: number): Promise<any> {
        return this.tenant.run(clubId, async () => {
        const dateFilter = month
            ? `EXTRACT(YEAR FROM r."date"::date) = ${year} AND EXTRACT(MONTH FROM r."date"::date) = ${month}`
            : `EXTRACT(YEAR FROM r."date"::date) = ${year}`;

        // Get all reservations for the period with their player data
        const reservations = await this.tenant.getRepo(Reservation).query(`
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
        }); // end tenant.run
    }

    // ==========================================
    // AVAILABLE SLOTS (PUBLIC)
    // ==========================================

    async getAvailableSlots(clubId: string, date: string) {
        return this.tenant.run(clubId, async () => {
        const dayOfWeek = new Date(date + 'T12:00:00').getDay();

        const courts = await this.tenant.getRepo(Court).find({
            where: { clubId, isActive: true },
            relations: ['priceBlocks'],
            order: { courtNumber: 'ASC' },
        });

        const reservations = await this.tenant.getRepo(Reservation).find({
            where: { clubId, date, status: ReservationStatus.CONFIRMED },
        });

        const activeBlocks = await this.getActiveBlocksForDate(clubId, date);

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

                const blockCheck = this.isSlotBlocked(block.startTime, block.endTime, court.id, activeBlocks);

                return {
                    startTime: block.startTime,
                    endTime: block.endTime,
                    priceFullCourt: Number(block.priceFullCourt),
                    pricePerPlayer: Number(block.pricePerPlayer),
                    available: !isReserved && !blockCheck.blocked,
                    blocked: blockCheck.blocked,
                    blockReason: blockCheck.reason || null,
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
        }); // end tenant.run
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

        const reservation = await this.createReservation({
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

        // ── Send booking confirmation when Mercado Pago is disabled ────────────
        this.sendBookingNotifications(userId, reservation, dto.clubId, playerName).catch(err =>
            this.logger.warn(`Could not send booking notification: ${err?.message}`)
        );

        return reservation;
    }

    /** Fire-and-forget: sends email and/or WhatsApp booking confirmation. */
    private async sendBookingNotifications(userId: string, reservation: Reservation, clubId: string, playerName: string): Promise<void> {
        // Check if MP is active first — if so, no manual notification needed.
        // IMPORTANT: query club info BEFORE any tenant-scoped queries to avoid
        // sharing the request's QR in a fire-and-forget async context.
        const club = await this.clubsService.findOne(clubId).catch(() => null);
        if (!club || club.enablePayments !== false) return; // MP is active — skip

        // MP is disabled — send booking confirmation notification.
        // Use tenant.run() for an independent QR so we don't share the request's QR.
        const [user, court] = await Promise.all([
            this.usersService.findById(userId).catch(() => null),
            this.tenant.run(clubId, em =>
                em.getRepository(Court).findOne({ where: { id: reservation.courtId } })
            ).catch(() => null),
        ]);

        const courtName = court?.name ?? 'Cancha';
        const clubName  = club.name;
        const [year, month, day] = reservation.date.split('-');
        const formattedDate  = `${day}/${month}/${year}`;
        const formattedTime  = `${reservation.startTime} - ${reservation.endTime}`;
        const formattedPrice = Number(reservation.finalPrice).toLocaleString('es-CL');
        const transferInfo   = club.transferInfo ?? null;

        // ── Email ──────────────────────────────────────────────────────────────
        if (user?.email && user.isEmailVerified) {
            const smtpCreds = await this.credentialsService.getEffectiveSmtpCreds(clubId).catch(() => undefined);
            await this.emailService.sendReservationBookingEmail(
                user.email,
                { date: reservation.date, startTime: reservation.startTime, endTime: reservation.endTime, courtName, finalPrice: reservation.finalPrice, clubName },
                transferInfo,
                smtpCreds,
            );
        }

        // ── WhatsApp ───────────────────────────────────────────────────────────
        if (user?.phone && user.isPhoneVerified && club.enablePaymentLinkSending) {
            const twilioCreds = await this.credentialsService.getEffectiveTwilioCreds(clubId).catch(() => undefined);

            // Build plain-text transfer block for WhatsApp
            let transferBlock = '';
            if (transferInfo) {
                const lines: string[] = [];
                if (transferInfo.bankName)      lines.push(`Banco: ${transferInfo.bankName}`);
                if (transferInfo.accountHolder) lines.push(`Titular: ${transferInfo.accountHolder}`);
                if (transferInfo.accountType)   lines.push(`Tipo: ${transferInfo.accountType}`);
                if (transferInfo.accountNumber) lines.push(`N° cuenta: ${transferInfo.accountNumber}`);
                if (transferInfo.rut)           lines.push(`RUT: ${transferInfo.rut}`);
                if (transferInfo.email)         lines.push(`Email: ${transferInfo.email}`);
                if (transferInfo.notes)         lines.push(`📝 ${transferInfo.notes}`);
                transferBlock = lines.join('\n');
            }

            await this.notificationsService.sendBookingConfirmWithTransfer(
                user.phone,
                { playerName, courtName, date: formattedDate, time: formattedTime, clubName, amount: formattedPrice, transferInfo: transferBlock || undefined },
                twilioCreds,
            );
        }
    }

    async getPlayerBookings(playerId: string, playerName: string, clubId?: string): Promise<any[]> {
        const cid = clubId || this.tenant.getCurrentClubId();
        if (!cid) {
            this.logger.warn('getPlayerBookings called without clubId — returning empty');
            return [];
        }

        return this.tenant.run(cid, async (em, qr) => {
            // Use em.createQueryBuilder() directly — this guarantees the QR
            // is passed through EntityManager.queryRunner, unlike
            // repo.createQueryBuilder() which can lose the QR reference
            // in some TypeORM 0.3.x versions.
            const reservations = await em
                .createQueryBuilder(Reservation, 'r')
                .leftJoinAndSelect('r.court', 'court')
                .where("r.title LIKE :pattern", { pattern: `%${playerName}%` })
                .andWhere('r.status != :cancelled', { cancelled: ReservationStatus.CANCELLED })
                .andWhere('r.clubId = :clubId', { clubId: cid })
                .orderBy('r.date', 'DESC')
                .addOrderBy('r.startTime', 'ASC')
                .getMany();

            // Enrich with MP payment statusDetail
            const reservationIds = reservations.map(r => r.id);
            let mpPaymentMap: Record<string, { status: string; statusDetail: string | null }> = {};
            if (reservationIds.length > 0) {
                const mpPayments = await em
                    .createQueryBuilder(MercadoPagoPayment, 'mp')
                    .where('mp.reservationId IN (:...ids)', { ids: reservationIds })
                    .orderBy('mp.createdAt', 'DESC')
                    .getMany();

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
        });
    }

    async cancelPlayerBooking(playerId: string, playerName: string, reservationId: string): Promise<Reservation> {
        const cid = this.tenant.getCurrentClubId();
        if (!cid) throw new BadRequestException('Se requiere contexto de club');

        return this.tenant.run(cid, async (em) => {
            const reservationRepo = em.getRepository(Reservation);
            const reservation = await reservationRepo.findOne({ where: { id: reservationId } });
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
            await reservationRepo.delete(reservationId);

            // Return the deleted entity (id will be gone but data is still in memory)
            return reservation;
        });
    }

    // ==========================================
    // COURT BLOCKS
    // ==========================================

    private getBlockTimeRange(block: CourtBlock): { start: string; end: string } {
        switch (block.blockType) {
            case BlockType.MORNING: return { start: '07:00', end: '12:00' };
            case BlockType.AFTERNOON: return { start: '12:00', end: '18:00' };
            case BlockType.NIGHT: return { start: '18:00', end: '23:30' };
            case BlockType.FULL_DAY: return { start: '00:00', end: '23:59' };
            case BlockType.CUSTOM: return { start: block.customStartTime || '00:00', end: block.customEndTime || '23:59' };
            default: return { start: '00:00', end: '23:59' };
        }
    }

    async createCourtBlock(dto: CreateCourtBlockDto): Promise<CourtBlock> {
        return this.tenant.runInContext(async (em) => {
            const block = em.getRepository(CourtBlock).create({
                ...dto,
                courtIds: dto.courtIds && dto.courtIds.length > 0 ? dto.courtIds : null,
            });
            return em.getRepository(CourtBlock).save(block);
        });
    }

    async getCourtBlocks(clubId: string): Promise<CourtBlock[]> {
        return this.tenant.run(clubId, em =>
            em.getRepository(CourtBlock).find({
                where: { clubId, isActive: true },
                order: { startDate: 'ASC' },
            })
        );
    }

    async deleteCourtBlock(id: string): Promise<void> {
        return this.tenant.runInContext(async (em) => {
            await em.getRepository(CourtBlock).delete(id);
        });
    }

    async getActiveBlocksForDate(clubId: string, date: string): Promise<CourtBlock[]> {
        return this.tenant.run(clubId, em =>
            em.getRepository(CourtBlock).find({
                where: {
                    clubId,
                    isActive: true,
                    startDate: LessThanOrEqual(date),
                    endDate: MoreThanOrEqual(date),
                },
            })
        );
    }

    isSlotBlocked(slotStart: string, slotEnd: string, courtId: string, blocks: CourtBlock[]): { blocked: boolean; reason?: string } {
        for (const block of blocks) {
            // Check if this block applies to this court
            if (block.courtIds && !block.courtIds.includes(courtId)) continue;

            const { start, end } = this.getBlockTimeRange(block);

            // Check time overlap
            if (slotStart < end && slotEnd > start) {
                return { blocked: true, reason: block.reason || 'Bloqueado' };
            }
        }
        return { blocked: false };
    }

    // ==========================================
    // FREE-PLAY MATCHES (Score tracking for reservations)
    // ==========================================

    async getFreePlayMatch(reservationId: string): Promise<FreePlayMatch | null> {
        return this.tenant.runInContext(em =>
            em.getRepository(FreePlayMatch).findOne({ where: { reservationId } })
        );
    }

    async getFreePlayMatchesByClub(clubId: string, startDate?: string, endDate?: string): Promise<FreePlayMatch[]> {
        return this.tenant.run(clubId, async (em) => {
            const query = em.createQueryBuilder(FreePlayMatch, 'fpm')
                .where('fpm.clubId = :clubId', { clubId });

            if (startDate) query.andWhere('fpm.date >= :startDate', { startDate });
            if (endDate) query.andWhere('fpm.date <= :endDate', { endDate });

            return query.orderBy('fpm.date', 'DESC').getMany();
        });
    }

    async saveFreePlayMatch(data: {
        reservationId: string;
        clubId: string;
        date: string;
        team1PlayerIds: string[];
        team2PlayerIds: string[];
        team1Names: string[];
        team2Names: string[];
        sets: { team1: number; team2: number }[];
        countsForRanking: boolean;
        pointsPerWin: number;
    }): Promise<FreePlayMatch> {
        return this.tenant.run(data.clubId, async (em) => {
            const fpmRepo = em.getRepository(FreePlayMatch);
            const reservationRepo = em.getRepository(Reservation);

            // Determine winner from sets
            let team1Sets = 0;
            let team2Sets = 0;
            for (const s of data.sets) {
                if (s.team1 > s.team2) team1Sets++;
                else if (s.team2 > s.team1) team2Sets++;
            }
            const winner = team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : null;
            const status = data.sets.length > 0 ? 'completed' : 'pending';

            // Check if match already exists for this reservation
            let match = await fpmRepo.findOne({ where: { reservationId: data.reservationId } });

            if (match) {
                // Update existing
                const updateFields = {
                    team1PlayerIds: data.team1PlayerIds,
                    team2PlayerIds: data.team2PlayerIds,
                    team1Names: data.team1Names,
                    team2Names: data.team2Names,
                    sets: data.sets,
                    winner,
                    status,
                    countsForRanking: data.countsForRanking,
                    pointsPerWin: data.pointsPerWin,
                };
                await fpmRepo.update(match.id, updateFields as any);
                Object.assign(match, updateFields);
            } else {
                // Create new
                const insertData = {
                    ...data,
                    winner,
                    status,
                };
                const result = await fpmRepo.insert(insertData as any);
                match = { ...insertData, id: result.identifiers[0].id } as FreePlayMatch;
            }

            // Also update reservation countsForRanking flag
            await reservationRepo.update(data.reservationId, { countsForRanking: data.countsForRanking });

            return match;
        });
    }

    async deleteFreePlayMatch(reservationId: string): Promise<void> {
        return this.tenant.runInContext(async (em) => {
            await em.getRepository(FreePlayMatch).delete({ reservationId });
            await em.getRepository(Reservation).update(reservationId, { countsForRanking: false });
        });
    }

    /** Get free-play stats for a player across all completed matches */
    async getFreePlayStatsForPlayer(playerId: string, clubId?: string): Promise<{ matchesWon: number; matchesLost: number; matchesPlayed: number; points: number }> {
        const cid = clubId || this.tenant.getCurrentClubId();
        if (!cid) return { matchesWon: 0, matchesLost: 0, matchesPlayed: 0, points: 0 };

        return this.tenant.run(cid, async (em) => {
            const query = em.createQueryBuilder(FreePlayMatch, 'fpm')
                .where('fpm.status = :status', { status: 'completed' })
                .andWhere('fpm.countsForRanking = true');

            if (clubId) query.andWhere('fpm.clubId = :clubId', { clubId });

            const matches = await query.getMany();

            let matchesWon = 0;
            let matchesLost = 0;
            let points = 0;

            for (const m of matches) {
                const inTeam1 = (m.team1PlayerIds || []).includes(playerId);
                const inTeam2 = (m.team2PlayerIds || []).includes(playerId);
                if (!inTeam1 && !inTeam2) continue;

                if (m.winner === 1 && inTeam1) {
                    matchesWon++;
                    points += m.pointsPerWin;
                } else if (m.winner === 2 && inTeam2) {
                    matchesWon++;
                    points += m.pointsPerWin;
                } else if (m.winner !== null) {
                    matchesLost++;
                }
            }

            return { matchesWon, matchesLost, matchesPlayed: matchesWon + matchesLost, points };
        });
    }

    /** Get all free-play matches for bulk stats computation */
    async getAllFreePlayMatches(clubId?: string): Promise<FreePlayMatch[]> {
        const cid = clubId || this.tenant.getCurrentClubId();
        if (!cid) return [];

        return this.tenant.run(cid, async (em) => {
            const query = em.createQueryBuilder(FreePlayMatch, 'fpm')
                .where('fpm.status = :status', { status: 'completed' })
                .andWhere('fpm.countsForRanking = true');

            if (clubId) query.andWhere('fpm.clubId = :clubId', { clubId });

            return query.getMany();
        });
    }
}
