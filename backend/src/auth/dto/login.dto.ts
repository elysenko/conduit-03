import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email must be a valid address' })
  email!: string;

  @IsString()
  @MinLength(1, { message: "password can't be blank" })
  password!: string;
}

export class LoginEnvelopeDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => LoginDto)
  user!: LoginDto;
}
