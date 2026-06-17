import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  cuil!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
