import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, JobsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
