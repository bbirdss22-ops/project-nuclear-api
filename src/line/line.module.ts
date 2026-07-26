import { Module } from '@nestjs/common';
import { LineController } from './line.controller.js';
import { LineService } from './line.service.js';

@Module({
  controllers: [LineController],
  providers: [LineService],
  exports: [LineService],
})
export class LineModule {}
