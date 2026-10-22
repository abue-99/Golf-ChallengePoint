// Environment for unit tests. No real database connection is opened.
process.env.ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123';
process.env.REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef012';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
