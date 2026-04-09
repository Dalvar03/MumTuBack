import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { S3Module } from './common/s3/s3.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, JobsModule, S3Module],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
