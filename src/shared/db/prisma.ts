import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env, isDevelopment } from '../config/env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });
  
  const adapter = new PrismaPg(pool);
  
  const client = new PrismaClient({
    adapter,
    log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  });

  return client;
}

// Prevent multiple instances in development (hot reloading)
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (isDevelopment) {
  globalThis.__prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    // Set timezone to UTC-3 (America/Sao_Paulo) in PostgreSQL
    await prisma.$executeRaw`SET timezone = 'America/Sao_Paulo'`;
    console.log('✅ Database connected (timezone: UTC-3)');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    // Don't exit - allow server to start for health checks
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('📴 Database disconnected');
}





