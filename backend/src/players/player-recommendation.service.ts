import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { PlayerRankingService } from './player-ranking.service';

@Injectable()
export class PlayerRecommendationService {
    constructor(
        @InjectRepository(Player)
        private playerRepository: Repository<Player>,
        private rankingService: PlayerRankingService,
    ) { }

    async getRecommendedMatches(clubId?: string): Promise<any[]> {
        const rankings = await this.rankingService.getPairRankings('global', undefined, clubId);
        const recommendations = [];

        for (let i = 0; i < rankings.length - 1; i++) {
            const pairA = rankings[i];

            for (let j = i + 1; j < Math.min(i + 4, rankings.length); j++) {
                const pairB = rankings[j];

                const playersA = [pairA.p1.id, pairA.p2.id];
                const playersB = [pairB.p1.id, pairB.p2.id];
                const intersection = playersA.filter(id => playersB.includes(id));

                if (intersection.length === 0) {
                    const pointDiff = Math.abs(pairA.points - pairB.points);
                    recommendations.push({ pair1: pairA, pair2: pairB, pointDiff });
                    break;
                }
            }
        }

        return recommendations.slice(0, 5);
    }

    async getAllPartnerRecommendations(clubId?: string): Promise<any[]> {
        let eligiblePlayers: Player[];

        if (!clubId) {
            eligiblePlayers = await this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category')
                .where('player.position IS NOT NULL')
                .andWhere('player.categoryId IS NOT NULL')
                .getMany();
        } else {
            const playersInClub = await this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category')
                .innerJoin('player.clubs', 'club')
                .where('player.position IS NOT NULL')
                .andWhere('player.categoryId IS NOT NULL')
                .andWhere('club.id = :clubId', { clubId })
                .getMany();

            const playersWithoutClubs = await this.playerRepository.createQueryBuilder('player')
                .leftJoinAndSelect('player.category', 'category')
                .leftJoin('player.clubs', 'club')
                .where('player.position IS NOT NULL')
                .andWhere('player.categoryId IS NOT NULL')
                .andWhere('club.id IS NULL')
                .getMany();

            const playerMap = new Map();
            [...playersInClub, ...playersWithoutClubs].forEach(p => playerMap.set(p.id, p));
            eligiblePlayers = Array.from(playerMap.values());
        }

        const isPositionCompatible = (pos1: string, pos2: string): boolean => {
            if (pos1 === 'mixto' || pos2 === 'mixto') return true;
            return (pos1 === 'reves' && pos2 === 'drive') || (pos1 === 'drive' && pos2 === 'reves');
        };

        const recommendations = [];

        for (let i = 0; i < eligiblePlayers.length; i++) {
            const player1 = eligiblePlayers[i];
            for (let j = i + 1; j < eligiblePlayers.length; j++) {
                const player2 = eligiblePlayers[j];
                if (player1.id === player2.id) continue;

                if (player1.category.id === player2.category.id &&
                    isPositionCompatible(player1.position, player2.position)) {
                    const pointDiff = Math.abs(player1.totalPoints - player2.totalPoints);
                    const avgPoints = Math.round((player1.totalPoints + player2.totalPoints) / 2);

                    recommendations.push({
                        player1: { id: player1.id, name: player1.name, position: player1.position, totalPoints: player1.totalPoints },
                        player2: { id: player2.id, name: player2.name, position: player2.position, totalPoints: player2.totalPoints },
                        category: player1.category.name,
                        pointDifference: pointDiff,
                        averagePoints: avgPoints,
                        compatibility: 100 - Math.min(pointDiff, 100)
                    });
                }
            }
        }

        recommendations.sort((a, b) => b.compatibility - a.compatibility);
        return recommendations.slice(0, 10);
    }
}
