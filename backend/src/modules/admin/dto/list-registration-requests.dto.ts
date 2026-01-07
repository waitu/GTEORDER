import { IsIn, IsOptional } from 'class-validator';

import { RegistrationState } from '../registration-request.entity.js';

export class ListRegistrationRequestsDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: RegistrationState;
}