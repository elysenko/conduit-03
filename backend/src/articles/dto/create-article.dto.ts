import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(1, { message: "title can't be blank" })
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1, { message: "description can't be blank" })
  @MaxLength(500)
  description!: string;

  @IsString()
  @MinLength(1, { message: "body can't be blank" })
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tagList?: string[];
}

/** RealWorld envelope: `{ "article": { ... } }`. */
export class CreateArticleEnvelopeDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateArticleDto)
  article!: CreateArticleDto;
}
