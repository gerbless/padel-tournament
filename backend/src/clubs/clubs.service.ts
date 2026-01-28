import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Club } from './entities/club.entity';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { Player } from '../players/entities/player.entity';

@Injectable()
export class ClubsService {
    constructor(
        @InjectRepository(Club)
        private clubRepository: Repository<Club>,
        @InjectRepository(Player)
        private playerRepository: Repository<Player>,
    ) { }

    async create(createClubDto: CreateClubDto): Promise<Club> {
        const club = this.clubRepository.create(createClubDto);
        return this.clubRepository.save(club);
    }

    async findAll(): Promise<Club[]> {
        return this.clubRepository.find({
            relations: ['players'],
            order: { name: 'ASC' }
        });
    }

    async findOne(id: string): Promise<Club> {
        const club = await this.clubRepository.findOne({
            where: { id },
            relations: ['players', 'tournaments', 'leagues']
        });

        if (!club) {
            throw new NotFoundException(`Club with ID ${id} not found`);
        }

        return club;
    }

    async update(id: string, updateClubDto: UpdateClubDto): Promise<Club> {
        const club = await this.findOne(id);
        Object.assign(club, updateClubDto);
        return this.clubRepository.save(club);
    }

    async remove(id: string): Promise<void> {
        const club = await this.findOne(id);
        await this.clubRepository.remove(club);
    }

    async getPlayers(clubId: string): Promise<Player[]> {
        const club = await this.clubRepository.findOne({
            where: { id: clubId },
            relations: ['players', 'players.category']
        });

        if (!club) {
            throw new NotFoundException(`Club with ID ${clubId} not found`);
        }

        return club.players;
    }

    async addPlayer(clubId: string, playerId: string): Promise<void> {
        const club = await this.clubRepository.findOne({
            where: { id: clubId },
            relations: ['players']
        });

        if (!club) {
            throw new NotFoundException(`Club with ID ${clubId} not found`);
        }

        const player = await this.playerRepository.findOne({
            where: { id: playerId }
        });

        if (!player) {
            throw new NotFoundException(`Player with ID ${playerId} not found`);
        }

        // Check if player is already in club
        if (!club.players.some(p => p.id === playerId)) {
            club.players.push(player);
            await this.clubRepository.save(club);
        }
    }

    async removePlayer(clubId: string, playerId: string): Promise<void> {
        const club = await this.clubRepository.findOne({
            where: { id: clubId },
            relations: ['players']
        });

        if (!club) {
            throw new NotFoundException(`Club with ID ${clubId} not found`);
        }

        club.players = club.players.filter(p => p.id !== playerId);
        await this.clubRepository.save(club);
    }

    async getTopPlayers(clubId: string, limit: number = 10): Promise<Player[]> {
        const club = await this.clubRepository.findOne({
            where: { id: clubId },
            relations: ['players']
        });

        if (!club) {
            throw new NotFoundException(`Club with ID ${clubId} not found`);
        }

        return club.players
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(0, limit);
    }
}
