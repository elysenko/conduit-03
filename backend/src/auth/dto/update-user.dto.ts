import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may only contain letters, numbers, dots, dashes and underscores',
  })
  username?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;
}

export class UpdateUserEnvelopeDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateUserDto)
  user!: UpdateUserDto;
}
