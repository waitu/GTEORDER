import { IsArray, IsNotEmpty, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class CreateDesignDto {
  @IsString()
  @IsNotEmpty()
  designSubtype!: string;

  @IsArray()
  @ArrayMinSize(1)
  assetUrls!: string[];

  @IsOptional()
  @IsString()
  adminNote?: string | null;
}
