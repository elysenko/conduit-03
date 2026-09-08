import { Type } from 'class-transformer';
import {
  IsDefined,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: "body can't be blank" })
  @MaxLength(5000)
  body!: string;
}

/** RealWorld envelope: `{ "comment": { "body": "..." } }`. */
export class CreateCommentEnvelopeDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateCommentDto)
  comment!: CreateCommentDto;
}
