import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TagsService } from './tags.service';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  /** GET /api/tags — public. */
  @Get()
  list(): Promise<{ tags: string[] }> {
    return this.tags.popular();
  }
}
