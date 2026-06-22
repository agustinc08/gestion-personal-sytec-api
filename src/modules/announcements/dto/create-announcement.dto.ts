import { AnnouncementPriority, AnnouncementType, Role } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateAnnouncementDto {
  @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(4000) message!: string;
  @IsOptional() @IsEnum(AnnouncementType) type?: AnnouncementType;
  @IsOptional() @IsEnum(AnnouncementPriority) priority?: AnnouncementPriority;
  @IsOptional() @IsEnum(Role) targetRole?: Role;
  @IsOptional() @IsString() targetDependencyId?: string;
  @IsOptional() @IsString() targetEmployeeId?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
