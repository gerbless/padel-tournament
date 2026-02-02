import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonalMatch } from './entities/personal-match.entity';
import { CreatePersonalMatchDto } from './dto/create-personal-match.dto';
import { UpdatePersonalMatchDto } from './dto/update-personal-match.dto';

@Injectable()
export class PersonalTrackerService {
    constructor(
        @InjectRepository(PersonalMatch)
        private matchRepository: Repository<PersonalMatch>,
    ) { }

    async create(createDto: CreatePersonalMatchDto, ownerId: string): Promise<PersonalMatch> {
        const sets = createDto.sets || [];
        const status = createDto.status || (sets.length === 0 ? 'draft' : 'in_progress');

        let result: 'win' | 'loss' | null = null;

        // Only calculate result if status is completed or if we have sets
        if (sets.length > 0) {
            let mySets = 0;
            let rivalSets = 0;

            sets.forEach(s => {
                if (s.myScore > s.rivalScore) mySets++;
                else if (s.rivalScore > s.myScore) rivalSets++;
            });

            result = mySets > rivalSets ? 'win' : 'loss';
        }

        const match = this.matchRepository.create({
            ...createDto,
            ownerId,
            sets,
            status,
            result
        });

        return this.matchRepository.save(match);
    }

    async findOne(id: string, ownerId: string): Promise<PersonalMatch> {
        const match = await this.matchRepository.findOne({
            where: { id, ownerId },
            relations: ['partner', 'rival1', 'rival2', 'club']
        });

        if (!match) {
            throw new NotFoundException('Match not found');
        }

        return match;
    }

    async update(id: string, updateDto: UpdatePersonalMatchDto, ownerId: string): Promise<PersonalMatch> {
        const match = await this.findOne(id, ownerId);

        // Update sets if provided
        if (updateDto.sets) {
            match.sets = updateDto.sets;

            // Recalculate result
            let mySets = 0;
            let rivalSets = 0;

            updateDto.sets.forEach(s => {
                if (s.myScore > s.rivalScore) mySets++;
                else if (s.rivalScore > s.myScore) rivalSets++;
            });

            match.result = mySets > rivalSets ? 'win' : 'loss';
        }

        // Update status if provided
        if (updateDto.status) {
            match.status = updateDto.status;
        }

        return this.matchRepository.save(match);
    }

    async findAll(ownerId: string): Promise<PersonalMatch[]> {
        return this.matchRepository.find({
            where: { ownerId },
            relations: ['partner', 'rival1', 'rival2', 'club'],
            order: { date: 'DESC' }
        });
    }

    async findInProgress(ownerId: string): Promise<PersonalMatch[]> {
        return this.matchRepository.find({
            where: [
                { ownerId, status: 'draft' },
                { ownerId, status: 'in_progress' }
            ],
            relations: ['partner', 'rival1', 'rival2', 'club'],
            order: { date: 'DESC' }
        });
    }

    async getStats(ownerId: string) {
        const matches = await this.findAll(ownerId);

        const totalMatches = matches.length;
        const wins = matches.filter(m => m.result === 'win').length;
        const losses = totalMatches - wins;
        const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

        // ===== CATEGORY PERFORMANCE ANALYSIS =====
        const categoryStats = new Map<string, {
            category: string,
            wins: number,
            losses: number,
            played: number,
            winRate: number
        }>();

        matches.forEach(m => {
            // Process both rivals
            [m.rival1, m.rival2].forEach(rival => {
                if (!rival || !rival.category) return;

                const catName = rival.category.name;
                if (!categoryStats.has(catName)) {
                    categoryStats.set(catName, {
                        category: catName,
                        wins: 0,
                        losses: 0,
                        played: 0,
                        winRate: 0
                    });
                }

                const stat = categoryStats.get(catName);
                stat.played++;
                if (m.result === 'win') stat.wins++;
                else stat.losses++;
            });
        });

        // Calculate win rates and sort
        const categoryPerformance = Array.from(categoryStats.values())
            .map(s => ({ ...s, winRate: (s.wins / s.played) * 100 }))
            .sort((a, b) => b.winRate - a.winRate);

        // ===== CURRENT STREAK =====
        let currentStreak = 0;
        let streakType: 'win' | 'loss' | 'none' = 'none';

        if (matches.length > 0) {
            const sortedMatches = [...matches].sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            streakType = sortedMatches[0].result;
            currentStreak = 1;

            for (let i = 1; i < sortedMatches.length; i++) {
                if (sortedMatches[i].result === streakType) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }

        // ===== SET STATISTICS =====
        let setsWon = 0;
        let setsLost = 0;
        let totalGamesWon = 0;
        let totalGamesLost = 0;
        let tieBreaksPlayed = 0;
        let tieBreaksWon = 0;

        matches.forEach(m => {
            m.sets.forEach(set => {
                if (set.myScore > set.rivalScore) {
                    setsWon++;
                    totalGamesWon += set.myScore;
                    totalGamesLost += set.rivalScore;
                } else {
                    setsLost++;
                    totalGamesWon += set.myScore;
                    totalGamesLost += set.rivalScore;
                }

                if (set.tieBreak) {
                    tieBreaksPlayed++;
                    if (set.myScore > set.rivalScore) tieBreaksWon++;
                }
            });
        });

        // ===== BEST VICTORY / WORST DEFEAT =====
        let bestVictory = null;
        let worstDefeat = null;

        matches.forEach(m => {
            const gameDiff = m.sets.reduce((acc, set) =>
                acc + (set.myScore - set.rivalScore), 0
            );

            if (m.result === 'win') {
                if (!bestVictory || gameDiff > bestVictory.diff) {
                    bestVictory = {
                        diff: gameDiff,
                        date: m.date,
                        rivals: `${m.rival1.name} / ${m.rival2.name}`
                    };
                }
            } else {
                if (!worstDefeat || Math.abs(gameDiff) > Math.abs(worstDefeat.diff)) {
                    worstDefeat = {
                        diff: gameDiff,
                        date: m.date,
                        rivals: `${m.rival1.name} / ${m.rival2.name}`
                    };
                }
            }
        });

        // ===== PARTNER STATS =====
        const partnerStats = new Map<string, { name: string, wins: number, played: number }>();
        matches.forEach(m => {
            if (!m.partner) return;
            const pid = m.partnerId;
            if (!partnerStats.has(pid)) {
                partnerStats.set(pid, { name: m.partner.name, wins: 0, played: 0 });
            }
            const stat = partnerStats.get(pid);
            stat.played++;
            if (m.result === 'win') stat.wins++;
        });

        const sortedPartners = Array.from(partnerStats.values())
            .map(s => ({ ...s, winRate: (s.wins / s.played) * 100 }))
            .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

        // ===== RIVAL STATS =====
        const rivalStats = new Map<string, { name: string, category: string, losses: number, played: number }>();
        const processRival = (r: any, result: string) => {
            if (!r) return;
            const rid = r.id;
            if (!rivalStats.has(rid)) {
                rivalStats.set(rid, {
                    name: r.name,
                    category: r.category?.name || 'Sin categoría',
                    losses: 0,
                    played: 0
                });
            }
            const stat = rivalStats.get(rid);
            stat.played++;
            if (result === 'loss') stat.losses++;
        };

        matches.forEach(m => {
            processRival(m.rival1, m.result);
            processRival(m.rival2, m.result);
        });

        const toughestRivals = Array.from(rivalStats.values())
            .map(s => ({ ...s, lossRate: (s.losses / s.played) * 100 }))
            .sort((a, b) => b.lossRate - a.lossRate || b.losses - a.losses);

        // ===== EVOLUTION (ELO) =====
        let currentPoints = 1000;
        const evolution = [...matches]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(m => {
                if (m.result === 'win') currentPoints += 25;
                else currentPoints -= 15;
                return { date: m.date, points: currentPoints };
            });

        return {
            // Basic stats
            totalMatches,
            wins,
            losses,
            winRate,

            // Category performance (NEW)
            categoryPerformance,

            // Streak (NEW)
            currentStreak,
            streakType,

            // Set statistics (NEW)
            setsWon,
            setsLost,
            setWinRate: setsWon + setsLost > 0 ? (setsWon / (setsWon + setsLost)) * 100 : 0,
            totalGamesWon,
            totalGamesLost,
            averageGamesPerSet: totalMatches > 0 ? (totalGamesWon + totalGamesLost) / (setsWon + setsLost) : 0,

            // Tie-breaks (NEW)
            tieBreaksPlayed,
            tieBreaksWon,
            tieBreakWinRate: tieBreaksPlayed > 0 ? (tieBreaksWon / tieBreaksPlayed) * 100 : 0,

            // Best/Worst (NEW)
            bestVictory,
            worstDefeat,

            // Partner & Rival stats
            bestPartner: sortedPartners[0] || null,
            toughestRival: toughestRivals[0] || null,
            partnerStats: sortedPartners.slice(0, 5),
            rivalStats: toughestRivals.slice(0, 5),

            // Evolution
            evolution,
            currentRating: evolution.length > 0 ? evolution[evolution.length - 1].points : 1000
        };
    }
}
