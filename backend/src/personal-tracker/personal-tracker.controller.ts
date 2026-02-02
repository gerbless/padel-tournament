import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { PersonalTrackerService } from './personal-tracker.service';
import { CreatePersonalMatchDto } from './dto/create-personal-match.dto';
import { UpdatePersonalMatchDto } from './dto/update-personal-match.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('personal-tracker')
@UseGuards(JwtAuthGuard)
export class PersonalTrackerController {
    constructor(private readonly trackerService: PersonalTrackerService) { }

    @Post()
    create(@Request() req: any, @Body() createDto: CreatePersonalMatchDto) {
        return this.trackerService.create(createDto, req.user.userId);
    }

    @Get('history')
    findAll(@Request() req: any) {
        return this.trackerService.findAll(req.user.userId);
    }

    @Get('in-progress')
    findInProgress(@Request() req: any) {
        return this.trackerService.findInProgress(req.user.userId);
    }

    @Get('stats')
    getStats(@Request() req: any) {
        return this.trackerService.getStats(req.user.userId);
    }

    @Get(':id')
    findOne(@Request() req: any, @Param('id') id: string) {
        return this.trackerService.findOne(id, req.user.userId);
    }

    @Patch(':id')
    update(@Request() req: any, @Param('id') id: string, @Body() updateDto: UpdatePersonalMatchDto) {
        return this.trackerService.update(id, updateDto, req.user.userId);
    }
}
