import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ArrayMaxSize } from 'class-validator';

export class CreateTelegramBarcodesDto {
  @IsString()
  chat_id!: string;

  @IsOptional()
  @IsInt()
  message_thread_id?: number;

  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  codes!: string[];

  @IsOptional()
  @IsBoolean()
  zip?: boolean;
}
