const { PrismaClient, Prisma } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient();
} else {
    // In development, reuse the client across module reloads to avoid exhausting connections
    if (!global.__prisma) {
        global.__prisma = new PrismaClient();
    }
    prisma = global.__prisma;
}

module.exports = { prisma, Prisma };