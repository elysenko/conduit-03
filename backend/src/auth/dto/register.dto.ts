import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1, { message: "username can't be blank" })
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may only contain letters, numbers, dots, dashes and underscores',
  })
  username!: string;

  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}

/** RealWorld envelope: `{ "user": { ... } }` — what the Angular client posts. */
export class RegisterEnvelopeDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => RegisterDto)
  user!: RegisterDto;
}
