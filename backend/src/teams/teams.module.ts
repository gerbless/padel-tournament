import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './entities/team.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Team])],
    exports: [TypeOrmModule],
})
export class TeamsModule { }
