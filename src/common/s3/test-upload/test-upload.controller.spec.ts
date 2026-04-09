import { Test, TestingModule } from '@nestjs/testing';
import { TestUploadController } from './test-upload.controller';

describe('TestUploadController', () => {
  let controller: TestUploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestUploadController],
    }).compile();

    controller = module.get<TestUploadController>(TestUploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
