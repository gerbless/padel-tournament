import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Player } from '../players/entities/player.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        @InjectRepository(Player)
        private playersRepository: Repository<Player>,
    ) { }

    async findOne(email: string): Promise<User | undefined> {
        return this.usersRepository.findOne({
            where: { email },
            relations: ['player']
        });
    }

    async findById(id: string): Promise<User | undefined> {
        return this.usersRepository.findOne({
            where: { id },
            relations: ['player']
        });
    }

    async create(userData: Partial<User>): Promise<User> {
        const user = this.usersRepository.create(userData);
        return this.usersRepository.save(user);
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find({ relations: ['player'] });
    }

    /**
     * Link an existing user to an existing player
     * @param userId - ID of the user
     * @param playerId - ID of the player to link
     */
    async linkUserToPlayer(userId: string, playerId: string): Promise<User> {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        const player = await this.playersRepository.findOne({ where: { id: playerId } });
        if (!player) {
            throw new Error('Player not found');
        }

        user.player = player;
        return this.usersRepository.save(user);
    }
}
