import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalTrackerService } from './personal-tracker.service';
import { PersonalTrackerController } from './personal-tracker.controller';
import { PersonalMatch } from './entities/personal-match.entity';

@Module({
    imports: [TypeOrmModule.forFeature([PersonalMatch])],
    controllers: [PersonalTrackerController],
    providers: [PersonalTrackerService],
})
export class PersonalTrackerModule { }
