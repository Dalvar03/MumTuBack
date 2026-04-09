import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './s3.service';
import { TestUploadController } from './test-upload/test-upload.controller';

@Module({
  imports: [ConfigModule],
  providers: [S3Service],
  exports: [S3Service],
  controllers: [TestUploadController],
})
export class S3Module {}
