import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { S3Module } from './common/s3/s3.module';
import { PrismaService } from './database/prisma/prisma.service';
import { Database, Resource, getModelByName } from '@adminjs/prisma';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import AdminJS from 'adminjs';
import { PaymentsModule } from './modules/payments/payments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JobCompletionModule } from './modules/job-completion/job-completion.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { DisputesService } from './modules/disputes/disputes.service';
import { createJobDisputeResource } from './admin/job-dispute.resource';

AdminJS.registerAdapter({ Database, Resource });

const requireAdminSecret = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
};

const DEFAULT_ADMIN = {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
};

const authenticate = async (email: string, password: string) => {
  if (
    DEFAULT_ADMIN.email &&
    DEFAULT_ADMIN.password &&
    email === DEFAULT_ADMIN.email &&
    password === DEFAULT_ADMIN.password
  ) {
    return Promise.resolve({ email: DEFAULT_ADMIN.email });
  }
  return null;
};

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    JobsModule,
    S3Module,
    ScheduleModule.forRoot(),
    JobCompletionModule,
    DisputesModule,
    import('@adminjs/nestjs').then(({ AdminModule }) =>
      AdminModule.createAdminAsync({
        imports: [PrismaModule, DisputesModule],
        inject: [PrismaService, DisputesService],
        useFactory: (
          prisma: PrismaService,
          disputesService: DisputesService,
        ) => {
          return {
            adminJsOptions: {
              rootPath: '/admin',
              resources: [
                {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  resource: { model: getModelByName('User'), client: prisma },
                  options: {},
                },
                {
                  resource: {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    model: getModelByName('Job'),
                    client: prisma,
                  },
                  options: {},
                },
                createJobDisputeResource(prisma, disputesService),
              ],
            },
            auth: {
              authenticate,
              cookieName: 'adminjs',
              cookiePassword: requireAdminSecret('ADMIN_COOKIE_SECRET'),
            },
            sessionOptions: {
              resave: true,
              saveUninitialized: true,
              secret:
                process.env.ADMIN_SESSION_SECRET ??
                requireAdminSecret('ADMIN_COOKIE_SECRET'),
            },
          };
        },
      }),
    ),
    ConversationsModule,
    NotificationsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
