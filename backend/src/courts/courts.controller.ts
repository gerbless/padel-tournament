import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreatePriceBlockDto } from './dto/create-price-block.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubRoles } from '../auth/club-roles.decorator';

@Controller('courts')
export class CourtsController {
    constructor(private readonly courtsService: CourtsService) { }

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
}
