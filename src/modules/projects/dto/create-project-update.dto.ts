import { IsString } from 'class-validator';

export class CreateProjectUpdateDto {
  @IsString() content!: string;
  @IsString() authorName!: string;
}
