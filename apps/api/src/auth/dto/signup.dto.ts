import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  profileImage?: string;

  @IsString()
  @IsOptional()
  @IsIn(['PLAYER', 'COACH'])
  role?: string;
}
