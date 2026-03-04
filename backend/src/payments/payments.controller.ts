import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus, UseGuards, Request, Logger } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
     * Create a payment link (admin billing flow)
     */
    @UseGuards(JwtAuthGuard)
    @Post('payment-link/:reservationId')
    async createPaymentLink(@Param('reservationId') reservationId: string) {
        return this.paymentsService.createPaymentLink(reservationId);
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
