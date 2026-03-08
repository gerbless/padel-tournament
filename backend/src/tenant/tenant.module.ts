import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantInterceptor } from './tenant.interceptor';
import { Club } from '../clubs/entities/club.entity';

/**
 * Global module that provides multi-tenant (per-club schema) infrastructure.
 *
 * - TenantMiddleware: extracts clubId from every request into AsyncLocalStorage
 * - TenantInterceptor: sets PostgreSQL search_path per request
 * - TenantService: provides getRepo()/query() for tenant-scoped DB access
 */
@Global()
@Module({
    imports: [TypeOrmModule.forFeature([Club])],
    providers: [
        TenantService,
        {
            provide: APP_INTERCEPTOR,
            useClass: TenantInterceptor,
        },
    ],
    exports: [TenantService],
})
export class TenantModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(TenantMiddleware).forRoutes('*');
    }
}
