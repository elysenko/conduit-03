import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query params for GET /api/articles and GET /api/articles/feed. */
export class ListArticlesQuery {
  /** Only articles carrying this tag. */
  @IsOptional()
  @IsString()
  tag?: string;

  /** Only articles written by this username. */
  @IsOptional()
  @IsString()
  author?: string;

  /** Only articles favorited by this username. */
  @IsOptional()
  @IsString()
  favorited?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
