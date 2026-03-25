import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateOnboardingDto, UserRoleDto } from './dto/update-onboarding.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(clerkUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateOnboarding(clerkUserId: string, dto: UpdateOnboardingDto) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedUsername = dto.username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

    const normalizedCity = dto.city?.trim() || null;

    const existingUsername = await this.prisma.user.findFirst({
      where: {
        username: normalizedUsername,
        NOT: {
          clerkUserId,
        },
      },
    });

    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    if (dto.role === UserRoleDto.WORKER) {
      if (!normalizedCity) {
        throw new BadRequestException('city is required for WORKER role');
      }

      if (!dto.workRadiusKm) {
        throw new BadRequestException(
          'workRadiusKm is required for WORKER role',
        );
      }
    }

    if (dto.role === UserRoleDto.CLIENT && dto.workRadiusKm) {
      throw new BadRequestException(
        'workRadiusKm is not allowed for CLIENT role',
      );
    }

    return this.prisma.user.update({
      where: { clerkUserId },
      data: {
        role: dto.role as UserRole,
        username: normalizedUsername,
        city: normalizedCity,
        workRadiusKm:
          dto.role === UserRoleDto.WORKER ? (dto.workRadiusKm ?? null) : null,
        onboardingDone: true,
      },
    });
  }
}
