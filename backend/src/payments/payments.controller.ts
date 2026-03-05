import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus, UseGuards, Request, Logger } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubRoles } from '../auth/club-roles.decorator';

@Controller('payments')
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private paymentsService: PaymentsService) {}

    /**
     * Get MP public key for frontend Bricks
     */
    @Get('config')
    getConfig() {
        return this.paymentsService.getPublicKey();
    }

    /**
     * Create a preference for a reservation (player booking flow)
     */
    @UseGuards(JwtAuthGuard)
    @Post('create-preference')
    async createPreference(
        @Body() body: { reservationId: string; payerEmail?: string },
        @Request() req,
    ) {
        return this.paymentsService.createPreference(
            body.reservationId,
            body.payerEmail || req.user?.username,
        );
    }

    /**
     * Create a payment link (admin/editor billing flow)
     */
    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin', 'editor')
    @Post('payment-link/:reservationId')
    async createPaymentLink(@Param('reservationId') reservationId: string) {
        return this.paymentsService.createPaymentLink(reservationId);
    }

    /**
     * Create a payment link for a single player (on-demand)
     */
    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin', 'editor')
    @Post('player-link/:reservationId/:playerIndex')
    async createSinglePlayerLink(
        @Param('reservationId') reservationId: string,
        @Param('playerIndex') playerIndex: string,
    ) {
        return this.paymentsService.createSinglePlayerLink(reservationId, parseInt(playerIndex, 10));
    }

    /**
     * Create per-player payment links (admin/editor billing flow for per_player pricing)
     */
    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin', 'editor')
    @Post('per-player-links/:reservationId')
    async createPerPlayerLinks(@Param('reservationId') reservationId: string) {
        return this.paymentsService.createPerPlayerPaymentLinks(reservationId);
    }

    /**
     * Mercado Pago webhook (no auth – MP sends notifications here)
     */
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async webhook(@Body() body: any, @Query() query: any) {
        this.logger.log('=== MP WEBHOOK ===');
        await this.paymentsService.handleWebhook(body, query);
        return { received: true };
    }

    /**
     * Sync payment status from MP (called when user returns from checkout)
     */
    @UseGuards(JwtAuthGuard)
    @Post('sync/:reservationId')
    async syncStatus(@Param('reservationId') reservationId: string) {
        return this.paymentsService.syncPaymentStatus(reservationId);
    }

    /**
     * Get payment status for a reservation
     */
    @UseGuards(JwtAuthGuard)
    @Get('status/:reservationId')
    async getStatus(@Param('reservationId') reservationId: string) {
        return this.paymentsService.getPaymentStatus(reservationId);
    }

    /**
     * Get all payments for a club (admin)
     */
    @UseGuards(JwtAuthGuard)
    @Get('club/:clubId')
    async getClubPayments(
        @Param('clubId') clubId: string,
        @Query('limit') limit?: number,
    ) {
        return this.paymentsService.getClubPayments(clubId, limit ? +limit : 50);
    }
}
