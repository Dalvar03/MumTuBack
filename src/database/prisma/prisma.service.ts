import 'dotenv/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    console.log('DB URL exists:', !!process.env.DATABASE_URL);
    console.log(
      'DB URL starts with postgres:',
      process.env.DATABASE_URL?.startsWith('postgres://') ||
        process.env.DATABASE_URL?.startsWith('postgresql://'),
    );
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
