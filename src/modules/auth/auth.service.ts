import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CurrentUser } from '../../common/types/current-user.type';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(params: {
    clerkUserId: string;
    email: string;
  }): Promise<CurrentUser> {
    const { clerkUserId, email } = params;

    let user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          clerkUserId,
          email,
        },
      });
    } else if (user.email !== email) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { email },
      });
    }

    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  getMe(user: CurrentUser | undefined): CurrentUser {
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return user;
  }
}
