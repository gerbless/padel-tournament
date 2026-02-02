import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { PersonalTrackerService } from './personal-tracker.service';
import { CreatePersonalMatchDto } from './dto/create-personal-match.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('personal-tracker')
@UseGuards(JwtAuthGuard)
export class PersonalTrackerController {
    constructor(private readonly trackerService: PersonalTrackerService) { }

    @Post()
    create(@Request() req, @Body() createDto: CreatePersonalMatchDto) {
        // Personal matches are now owned by the User (not Player)
        // req.user.userId comes from JWT strategy
        return this.trackerService.create(createDto, req.user.userId);
    }

    @Get('history')
    findAll(@Request() req) {
        return this.trackerService.findAll(req.user.userId);
    }

    @Get('stats')
    getStats(@Request() req) {
        return this.trackerService.getStats(req.user.userId);
    }
}
