import { UserRole, UserStatus } from '@prisma/client';

export interface CurrentUser {
  id: number;
  clerkUserId: string;
  email: string;
  role: UserRole | null;
  status: UserStatus;
}
