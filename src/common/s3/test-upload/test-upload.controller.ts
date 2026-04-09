import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { S3Service } from '../s3.service';

@Controller('test-upload')
export class TestUploadController {
  constructor(private readonly s3Service: S3Service) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.s3Service.uploadFile(file, 'test');
  }
}
