import { IsOptional, IsString } from 'class-validator';

export class CreateDeploymentDto {
  @IsString() environment!: string;
  @IsString() status!: string;
  @IsOptional() @IsString() apiCommit?: string;
  @IsOptional() @IsString() webCommit?: string;
  @IsOptional() @IsString() apiRepoUrl?: string;
  @IsOptional() @IsString() webRepoUrl?: string;
  @IsOptional() @IsString() server?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() deployedAt?: string;
}
