import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubRoleGuard } from '../auth/club-role.guard';
import { ClubRoles } from '../auth/club-roles.decorator';

@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Post()
    create(@Body() createCategoryDto: CreateCategoryDto) {
        return this.categoriesService.create(createCategoryDto);
    }

    @Get()
    findAll() {
        return this.categoriesService.findAll();
    }

    @Get('analysis')
    analyze() {
        return this.categoriesService.analyzePromotions();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.categoriesService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
        return this.categoriesService.update(id, updateCategoryDto);
    }

    @UseGuards(JwtAuthGuard, ClubRoleGuard)
    @ClubRoles('admin')
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.categoriesService.remove(id);
    }
}
