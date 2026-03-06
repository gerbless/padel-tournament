import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreatePriceBlockDto } from './dto/create-price-block.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CreateCourtBlockDto } from './dto/create-court-block.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubRoles } from '../auth/club-roles.decorator';
import { PlayersService } from '../players/players.service';

@Controller('courts')
export class CourtsController {
    constructor(
        private readonly courtsService: CourtsService,
        private readonly playersService: PlayersService,
    ) { }

    // ==========================================
    // COURTS CRUD
    // ==========================================

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post()
    createCourt(@Body() dto: CreateCourtDto) {
        return this.courtsService.createCourt(dto);
    }

    @Get('club/:clubId')
    findByClub(@Param('clubId') clubId: string) {
        return this.courtsService.findCourtsByClub(clubId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.courtsService.findCourt(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Patch(':id')
    updateCourt(@Param('id') id: string, @Body() dto: Partial<CreateCourtDto>) {
        return this.courtsService.updateCourt(id, dto);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    removeCourt(@Param('id') id: string) {
        return this.courtsService.removeCourt(id);
    }

    // ==========================================
    // PRICE BLOCKS
    // ==========================================

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post(':courtId/copy-price-blocks/:sourceCourtId')
    copyPriceBlocks(
        @Param('courtId') courtId: string,
        @Param('sourceCourtId') sourceCourtId: string,
    ) {
        return this.courtsService.copyPriceBlocks(courtId, sourceCourtId);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post(':courtId/price-blocks')
    createPriceBlock(@Param('courtId') courtId: string, @Body() dto: CreatePriceBlockDto) {
        dto.courtId = courtId;
        return this.courtsService.createPriceBlock(dto);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post('club/:clubId/price-blocks/batch')
    createPriceBlockForAllCourts(
        @Param('clubId') clubId: string,
        @Body() dto: CreatePriceBlockDto
    ) {
        return this.courtsService.createPriceBlockForAllCourts(clubId, dto);
    }

    @Get(':courtId/price-blocks')
    getPriceBlocks(@Param('courtId') courtId: string) {
        return this.courtsService.getPriceBlocks(courtId);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Patch('club/:clubId/price-blocks/bulk-update')
    bulkUpdatePriceBlocks(
        @Param('clubId') clubId: string,
        @Body() body: { matchCriteria: { startTime: string; endTime: string; daysOfWeek: number[] }; newValues: Partial<CreatePriceBlockDto> },
    ) {
        return this.courtsService.bulkUpdatePriceBlocks(clubId, body.matchCriteria, body.newValues);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Patch('price-blocks/:id')
    updatePriceBlock(@Param('id') id: string, @Body() dto: Partial<CreatePriceBlockDto>) {
        return this.courtsService.updatePriceBlock(id, dto);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Delete('price-blocks/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    removePriceBlock(@Param('id') id: string) {
        return this.courtsService.removePriceBlock(id);
    }

    @Get(':courtId/price')
    async getPrice(
        @Param('courtId') courtId: string,
        @Query('date') date: string,
        @Query('startTime') startTime: string
    ) {
        const block = await this.courtsService.getPrice(courtId, date, startTime);
        return block || { priceFullCourt: 0, pricePerPlayer: 0 };
    }

    // ==========================================
    // RESERVATIONS
    // ==========================================

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Post('reservations')
    createReservation(@Body() dto: CreateReservationDto) {
        return this.courtsService.createReservation(dto);
    }

    @Get(':courtId/reservations')
    getReservations(
        @Param('courtId') courtId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string
    ) {
        return this.courtsService.getReservations(courtId, startDate, endDate);
    }

    @Get('club/:clubId/reservations')
    getReservationsByClub(
        @Param('clubId') clubId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string
    ) {
        return this.courtsService.getReservationsByClub(clubId, startDate, endDate);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Patch('reservations/:id')
    updateReservation(@Param('id') id: string, @Body() dto: Partial<CreateReservationDto>) {
        return this.courtsService.updateReservation(id, dto);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('editor')
    @Delete('reservations/:id')
    cancelReservation(@Param('id') id: string) {
        return this.courtsService.cancelReservation(id);
    }

    // ==========================================
    // REVENUE REPORTS
    // ==========================================

    @Get('club/:clubId/revenue')
    getRevenue(
        @Param('clubId') clubId: string,
        @Query('year') year: number,
        @Query('month') month?: number
    ) {
        return this.courtsService.getRevenue(clubId, +year, month ? +month : undefined);
    }

    @Get('club/:clubId/revenue/monthly')
    getMonthlyRevenue(
        @Param('clubId') clubId: string,
        @Query('year') year: number
    ) {
        return this.courtsService.getMonthlyRevenue(clubId, +year);
    }

    @Get('club/:clubId/billing')
    getBillingDashboard(
        @Param('clubId') clubId: string,
        @Query('year') year: number,
        @Query('month') month?: number
    ) {
        return this.courtsService.getBillingDashboard(clubId, +year, month ? +month : undefined);
    }

    @Get('club/:clubId/billing/players')
    getPlayerBillingHistory(
        @Param('clubId') clubId: string,
        @Query('year') year: number,
        @Query('month') month?: number
    ) {
        return this.courtsService.getPlayerBillingHistory(clubId, +year, month ? +month : undefined);
    }

    // ==========================================
    // PUBLIC: AVAILABLE SLOTS
    // ==========================================

    @Get('club/:clubId/available-slots')
    getAvailableSlots(
        @Param('clubId') clubId: string,
        @Query('date') date: string
    ) {
        return this.courtsService.getAvailableSlots(clubId, date);
    }

    // ==========================================
    // COURT BLOCKS
    // ==========================================

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post('club/:clubId/blocks')
    createCourtBlock(@Param('clubId') clubId: string, @Body() dto: CreateCourtBlockDto) {
        dto.clubId = clubId;
        return this.courtsService.createCourtBlock(dto);
    }

    @Get('club/:clubId/blocks')
    getCourtBlocks(@Param('clubId') clubId: string) {
        return this.courtsService.getCourtBlocks(clubId);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Delete('blocks/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    deleteCourtBlock(@Param('id') id: string) {
        return this.courtsService.deleteCourtBlock(id);
    }

    // ==========================================
    // PLAYER BOOKINGS (auth required, any user)
    // ==========================================

    @UseGuards(JwtAuthGuard)
    @Post('player-booking')
    async createPlayerBooking(@Request() req, @Body() dto: { courtId: string; clubId: string; date: string; startTime: string; endTime: string }) {
        const player = await this.playersService.findOne(req.user.playerId);
        return this.courtsService.createPlayerBooking(req.user.userId, req.user.playerId, player.name, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('player-bookings/my')
    async getMyBookings(@Request() req, @Query('clubId') clubId?: string) {
        const player = await this.playersService.findOne(req.user.playerId);
        return this.courtsService.getPlayerBookings(req.user.playerId, player.name, clubId);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('player-bookings/:id')
    async cancelMyBooking(@Request() req, @Param('id') id: string) {
        const player = await this.playersService.findOne(req.user.playerId);
        return this.courtsService.cancelPlayerBooking(req.user.playerId, player.name, id);
    }

    // ==========================================
    // FREE-PLAY MATCHES (Score tracking)
    // ==========================================

    @Get('free-play-match/:reservationId')
    getFreePlayMatch(@Param('reservationId') reservationId: string) {
        return this.courtsService.getFreePlayMatch(reservationId);
    }

    @Get('free-play-matches/club/:clubId')
    getFreePlayMatchesByClub(
        @Param('clubId') clubId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.courtsService.getFreePlayMatchesByClub(clubId, startDate, endDate);
    }

    @UseGuards(JwtAuthGuard)
    @Post('free-play-match')
    async saveFreePlayMatch(@Body() body: {
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
    }) {
        const match = await this.courtsService.saveFreePlayMatch(body);
        // Recalculate ranking points for all players involved
        const allPlayerIds = [...(body.team1PlayerIds || []), ...(body.team2PlayerIds || [])].filter(id => id);
        if (allPlayerIds.length > 0) {
            await this.playersService.recalculateTotalPoints(allPlayerIds);
        }
        return match;
    }

    @UseGuards(JwtAuthGuard)
    @Delete('free-play-match/:reservationId')
    async deleteFreePlayMatch(@Param('reservationId') reservationId: string) {
        // Get match before deleting to know which players to recalculate
        const match = await this.courtsService.getFreePlayMatch(reservationId);
        await this.courtsService.deleteFreePlayMatch(reservationId);
        if (match) {
            const allPlayerIds = [...(match.team1PlayerIds || []), ...(match.team2PlayerIds || [])].filter(id => id);
            if (allPlayerIds.length > 0) {
                await this.playersService.recalculateTotalPoints(allPlayerIds);
            }
        }
    }

    @Get('free-play-stats/:playerId')
    getFreePlayStatsForPlayer(
        @Param('playerId') playerId: string,
        @Query('clubId') clubId?: string,
    ) {
        return this.courtsService.getFreePlayStatsForPlayer(playerId, clubId);
    }
}
