import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString() name!: string;
  @IsString() description!: string;
  @IsString() requesterDependency!: string;
  @IsArray() @IsString({ each: true }) assignedEmployeeIds!: string[];
  @IsOptional() @IsString() status?: string;
}
