import { IsIn } from 'class-validator';

import { UserStatus } from '../../users/user.entity.js';

export class UpdateUserStatusDto {
  @IsIn(['pending', 'active', 'disabled', 'rejected'])
  status!: UserStatus;
}
