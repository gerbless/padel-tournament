import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Club } from '../../clubs/entities/club.entity';

@Entity('user_club_roles')
@Unique(['userId', 'clubId'])
export class UserClubRole {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, (user) => user.clubRoles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;

    @ManyToOne(() => Club, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'clubId' })
    club: Club;

    @Column()
    clubId: string;

    /** admin | editor | viewer */
    @Column({ type: 'varchar', default: 'viewer' })
    role: string;

    @CreateDateColumn()
    createdAt: Date;
}
