import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Player } from '../players/entities/player.entity';

@Injectable()
export class CategoriesService {
    constructor(
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
        @InjectRepository(Player)
        private playerRepository: Repository<Player>
    ) { }

    create(createCategoryDto: CreateCategoryDto) {
        const category = this.categoryRepository.create(createCategoryDto);
        return this.categoryRepository.save(category);
    }

    findAll() {
        return this.categoryRepository.find({
            order: { level: 'ASC' }
        });
    }

    findOne(id: string) {
        return this.categoryRepository.findOne({ where: { id } });
    }

    update(id: string, updateCategoryDto: any) {
        return this.categoryRepository.update(id, updateCategoryDto);
    }

    remove(id: string) {
        return this.categoryRepository.delete(id);
    }

    async analyzePromotions(): Promise<{ promotions: any[], relegations: any[] }> {
        const categories = await this.findAll();
        const players = await this.playerRepository.find({ relations: ['category'] });

        const promotions = [];
        const relegations = [];

        for (const player of players) {
            if (!player.category) continue;

            // Check Promotion (Move to lower level number, e.g. 2 -> 1)
            // Logic: If points > category.maxPoints -> Promote to next higher category (level - 1)
            if (player.totalPoints > player.category.maxPoints) {
                const higherCategory = categories.find(c => c.level === player.category.level - 1);
                if (higherCategory) {
                    promotions.push({
                        player: player.name,
                        currentCategory: player.category.name,
                        points: player.totalPoints,
                        suggestedCategory: higherCategory.name,
                        threshold: player.category.maxPoints
                    });
                }
            }

            // Check Relegation (Move to higher level number, e.g. 1 -> 2)
            // Logic: If points < category.minPoints -> Relegate to next lower category (level + 1)
            if (player.totalPoints < player.category.minPoints) {
                const lowerCategory = categories.find(c => c.level === player.category.level + 1);
                if (lowerCategory) {
                    relegations.push({
                        player: player.name,
                        currentCategory: player.category.name,
                        points: player.totalPoints,
                        suggestedCategory: lowerCategory.name,
                        threshold: player.category.minPoints
                    });
                }
            }
        }

        return { promotions, relegations };
    }
}
