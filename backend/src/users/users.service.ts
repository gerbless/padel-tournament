import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserClubRole } from './entities/user-club-role.entity';
import { Player } from '../players/entities/player.entity';
import { Club } from '../clubs/entities/club.entity';
import * as bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 10;
const VALID_CLUB_ROLES = ['admin', 'editor', 'viewer'];

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        @InjectRepository(UserClubRole)
        private userClubRoleRepository: Repository<UserClubRole>,
        @InjectRepository(Player)
        private playersRepository: Repository<Player>,
        @InjectRepository(Club)
        private clubsRepository: Repository<Club>,
    ) { }

    async findOne(email: string): Promise<User | undefined> {
        return this.usersRepository.findOne({
            where: { email },
            relations: ['player', 'clubRoles', 'clubRoles.club']
        });
    }

    async findById(id: string): Promise<User | undefined> {
        return this.usersRepository.findOne({
            where: { id },
            relations: ['player', 'clubRoles', 'clubRoles.club']
        });
    }

    async create(userData: Partial<User>): Promise<User> {
        // Check if user already exists
        const existing = await this.usersRepository.findOne({ where: { email: userData.email } });
        if (existing) {
            throw new ConflictException('Ya existe un usuario con ese email');
        }

        // Hash password before saving
        const hashedPassword = await bcrypt.hash(userData.password, BCRYPT_SALT_ROUNDS);
        const user = this.usersRepository.create({
            ...userData,
            password: hashedPassword,
        });
        const saved = await this.usersRepository.save(user);
        return this.sanitizeUser(saved);
    }

    async findAll(): Promise<User[]> {
        const users = await this.usersRepository.find({
            relations: ['player', 'clubRoles', 'clubRoles.club']
        });
        return users.map(u => this.sanitizeUser(u));
    }

    /**
     * Remove password from user object before returning
     */
    private sanitizeUser(user: User): User {
        if (user) {
            const { password, ...rest } = user as any;
            return rest as User;
        }
        return user;
    }

    /**
     * Link an existing user to an existing player
     */
    async linkUserToPlayer(userId: string, playerId: string): Promise<User> {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        const player = await this.playersRepository.findOne({ where: { id: playerId } });
        if (!player) {
            throw new NotFoundException('Jugador no encontrado');
        }

        user.player = player;
        const saved = await this.usersRepository.save(user);
        return this.sanitizeUser(saved);
    }

    // ─── Club Role Management ─────────────────────────────────

    /**
     * Assign a role to a user for a specific club
     */
    async assignClubRole(userId: string, clubId: string, role: string): Promise<UserClubRole> {
        if (!VALID_CLUB_ROLES.includes(role)) {
            throw new BadRequestException(`Rol inválido. Valores permitidos: ${VALID_CLUB_ROLES.join(', ')}`);
        }

        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        const club = await this.clubsRepository.findOne({ where: { id: clubId } });
        if (!club) {
            throw new NotFoundException('Club no encontrado');
        }

        // Upsert: if role already exists for this user+club, update it
        let existing = await this.userClubRoleRepository.findOne({
            where: { userId, clubId },
        });

        if (existing) {
            existing.role = role;
            return this.userClubRoleRepository.save(existing);
        }

        const ucr = this.userClubRoleRepository.create({ userId, clubId, role });
        return this.userClubRoleRepository.save(ucr);
    }

    /**
     * Remove a user's role for a specific club
     */
    async removeClubRole(userId: string, clubId: string): Promise<void> {
        const result = await this.userClubRoleRepository.delete({ userId, clubId });
        if (result.affected === 0) {
            throw new NotFoundException('Rol de club no encontrado');
        }
    }

    /**
     * Get all club roles for a specific user
     */
    async getClubRoles(userId: string): Promise<UserClubRole[]> {
        return this.userClubRoleRepository.find({
            where: { userId },
            relations: ['club'],
        });
    }

    /**
     * Get all users with roles for a specific club
     */
    async getClubUsers(clubId: string): Promise<UserClubRole[]> {
        return this.userClubRoleRepository.find({
            where: { clubId },
            relations: ['user', 'user.player'],
        });
    }

    /**
     * Check if user has a specific role (or higher) for a club
     */
    async hasClubRole(userId: string, clubId: string, requiredRole: string): Promise<boolean> {
        // Super admin bypasses all checks
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (user?.role === 'super_admin') {
            return true;
        }

        const ucr = await this.userClubRoleRepository.findOne({
            where: { userId, clubId },
        });

        if (!ucr) return false;

        // Role hierarchy: admin > editor > viewer
        const roleHierarchy: Record<string, number> = {
            'admin': 3,
            'editor': 2,
            'viewer': 1,
        };

        return (roleHierarchy[ucr.role] || 0) >= (roleHierarchy[requiredRole] || 0);
    }
}
