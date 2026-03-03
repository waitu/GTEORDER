import { IsArray, IsBoolean, IsOptional, IsString, ArrayMaxSize } from 'class-validator';

export class CreateBarcodesDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  codes!: string[];

  @IsOptional()
  @IsBoolean()
  zip?: boolean;
}
