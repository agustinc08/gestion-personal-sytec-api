import { IsInt, Min } from 'class-validator';
export class AdjustCompensatoryDaysDto { @IsInt() @Min(0) days!: number; }
