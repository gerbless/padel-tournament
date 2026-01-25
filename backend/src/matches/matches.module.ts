import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { Match } from './entities/match.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Match])],
    controllers: [MatchesController],
    providers: [MatchesService],
    exports: [MatchesService],
})
export class MatchesModule { }
