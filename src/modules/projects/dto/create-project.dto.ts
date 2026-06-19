import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProjectDto {
  @IsString() name!: string;
  @IsString() description!: string;
  @IsString() requesterDependency!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) assignedEmployeeIds?: string[];
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() @Min(2000) year?: number;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsString() repositoryApiUrl?: string;
  @IsOptional() @IsString() repositoryWebUrl?: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsString() techStack?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() needsRedesign?: boolean;
  @IsOptional() @IsBoolean() needsRework?: boolean;
}
