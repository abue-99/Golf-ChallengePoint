import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}
