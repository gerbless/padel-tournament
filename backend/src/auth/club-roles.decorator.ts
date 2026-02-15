import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify the required club role for an endpoint.
 * Usage: @ClubRoles('admin') or @ClubRoles('editor')
 *
 * The guard will look for clubId in:
 *   1. route params (e.g. :clubId, :id for club endpoints)
 *   2. request body (body.clubId)
 *   3. query params (query.clubId)
 */
export const CLUB_ROLES_KEY = 'clubRoles';
export const ClubRoles = (...roles: string[]) => SetMetadata(CLUB_ROLES_KEY, roles);
