import { PrismaClient } from '@prisma/client';
import path from 'node:path';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'dev.db')}`;
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[prisma] DATABASE_URL was not set. Falling back to local sqlite database at ./dev.db'
    );
  }
}

const prisma = new PrismaClient();

export default prisma;
