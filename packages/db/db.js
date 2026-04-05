"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("./generated/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const globalForPrisma = global;
let prisma;
if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    const adapter = new adapter_pg_1.PrismaPg({ connectionString });
    exports.prisma = prisma = new client_1.PrismaClient({ adapter });
}
else {
    exports.prisma = prisma = globalForPrisma.prisma;
}
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
