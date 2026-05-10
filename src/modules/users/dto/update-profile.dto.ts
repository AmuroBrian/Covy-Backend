import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsOptional()
  preferences?: Record<string, boolean>;
}
