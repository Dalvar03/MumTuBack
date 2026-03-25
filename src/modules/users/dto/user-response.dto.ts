export class UserResponseDto {
  id: string;
  clerkUserId: string;
  email: string;
  role: 'CLIENT' | 'WORKER' | null;
  username: string | null;
  city: string | null;
  workRadiusKm: number | null;
  onboardingDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}
