import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: Awaited<ReturnType<typeof verifyToken>>;

    try {
      payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
    } catch {
      throw new UnauthorizedException('Invalid Clerk token');
    }

    const clerkUserId = payload.sub;
    const email =
      typeof payload.email === 'string'
        ? payload.email
        : Array.isArray(payload.email_addresses) && payload.email_addresses[0]
          ? String(payload.email_addresses[0])
          : undefined;

    if (!clerkUserId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (!email) {
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const primaryEmail = clerkUser.emailAddresses.find(
        (item) => item.id === clerkUser.primaryEmailAddressId,
      );

      if (!primaryEmail?.emailAddress) {
        throw new UnauthorizedException('User email not found');
      }

      request.user = await this.authService.findOrCreateUser({
        clerkUserId,
        email: primaryEmail.emailAddress,
      });

      return true;
    }

    request.user = await this.authService.findOrCreateUser({
      clerkUserId,
      email,
    });

    return true;
  }
}
