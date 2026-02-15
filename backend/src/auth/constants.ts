
// JWT secret is now read from environment variables.
// This constant is kept for backward compatibility with imports,
// but the actual secret is injected via ConfigModule.
export const jwtConstants = {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_' + Math.random(),
};
