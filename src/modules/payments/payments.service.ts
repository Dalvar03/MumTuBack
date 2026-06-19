import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JobPaymentStatus,
  JobStatus,
  Prisma,
  StripeOnboardingStatus,
  User,
  WorkerTransferStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StripeEvent, StripeService } from './stripe.service';

type StripeEventObject<T extends StripeEvent['type']> = Extract<
  StripeEvent,
  { type: T }
>['data']['object'];
type StripePaymentIntent = StripeEventObject<'payment_intent.succeeded'>;
type StripeCheckoutSession = StripeEventObject<'checkout.session.completed'>;
type StripeAccount = StripeEventObject<'account.updated'>;
type StripeRefund = StripeEventObject<'refund.updated'>;
type StripeCharge = StripeEventObject<'charge.refunded'>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  getPaymentAmounts(price: Prisma.Decimal): {
    amountMinor: number;
    platformFeeMinor: number;
    workerAmountMinor: number;
    currency: string;
  } {
    const feePercent = new Prisma.Decimal(
      process.env.STRIPE_PLATFORM_FEE_PERCENT ?? '0',
    );

    if (feePercent.isNegative() || feePercent.greaterThanOrEqualTo(100)) {
      throw new Error(
        'STRIPE_PLATFORM_FEE_PERCENT must be at least 0 and less than 100',
      );
    }

    const amountMinor = price.mul(100).toDecimalPlaces(0).toNumber();
    const platformFeeMinor = new Prisma.Decimal(amountMinor)
      .mul(feePercent)
      .div(100)
      .toDecimalPlaces(0)
      .toNumber();

    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException('Job price must be at least 0.01');
    }

    return {
      amountMinor,
      platformFeeMinor,
      workerAmountMinor: amountMinor - platformFeeMinor,
      currency: (process.env.STRIPE_CURRENCY ?? 'pln').toLowerCase(),
    };
  }

  async createCheckoutSession(jobId: string, clientId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: true,
        payment: true,
      },
    });

    if (!job || job.clientId !== clientId || !job.payment) {
      throw new NotFoundException('Job payment not found');
    }

    if (job.status !== JobStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Job is not awaiting payment');
    }

    const customerId = await this.ensureStripeCustomer(job.client);
    const successUrl = this.requireEnv('STRIPE_CHECKOUT_SUCCESS_URL');
    const cancelUrl = this.requireEnv('STRIPE_CHECKOUT_CANCEL_URL');

    try {
      const session = await this.stripeService.client.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        success_url: this.withJobQuery(successUrl, job.id, true),
        cancel_url: this.withJobQuery(cancelUrl, job.id, false),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: job.currency,
              unit_amount: job.amountMinor,
              product_data: {
                name: job.title,
                description: job.description.slice(0, 500),
                metadata: {
                  jobId: job.id,
                },
              },
            },
          },
        ],
        metadata: {
          jobId: job.id,
          jobPaymentId: job.payment.id,
        },
        payment_intent_data: {
          transfer_group: `job:${job.id}`,
          metadata: {
            jobId: job.id,
            jobPaymentId: job.payment.id,
          },
        },
      });

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;

      await this.prisma.jobPayment.update({
        where: { id: job.payment.id },
        data: {
          status: JobPaymentStatus.PENDING,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId ?? undefined,
          stripeCustomerId: customerId,
          failureCode: null,
          failureMessage: null,
        },
      });

      if (!session.url) {
        throw new Error('Stripe Checkout Session did not return a URL');
      }

      return {
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
      };
    } catch (error) {
      await this.prisma.jobPayment.update({
        where: { id: job.payment.id },
        data: {
          status: JobPaymentStatus.FAILED,
          failureMessage: this.getErrorMessage(error),
        },
      });

      throw error;
    }
  }

  async createOnboardingLink(clerkUserId: string) {
    let worker = await this.getWorker(clerkUserId);

    if (!worker.stripeAccountId) {
      const account = await this.stripeService.client.accounts.create({
        type: 'express',
        country: process.env.STRIPE_CONNECT_COUNTRY || undefined,
        email: worker.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          userId: worker.id,
        },
      });

      worker = await this.prisma.user.update({
        where: { id: worker.id },
        data: {
          stripeAccountId: account.id,
          stripeOnboardingStatus: StripeOnboardingStatus.PENDING,
        },
      });
    }

    const stripeAccountId = worker.stripeAccountId;

    if (!stripeAccountId) {
      throw new Error('Stripe account creation did not persist an account ID');
    }

    const accountLink = await this.stripeService.client.accountLinks.create({
      account: stripeAccountId,
      refresh_url: this.requireEnv('STRIPE_CONNECT_REFRESH_URL'),
      return_url: this.requireEnv('STRIPE_CONNECT_RETURN_URL'),
      type: 'account_onboarding',
    });

    return {
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
    };
  }

  async getConnectedAccountStatus(clerkUserId: string) {
    const worker = await this.getWorker(clerkUserId);

    if (!worker.stripeAccountId) {
      return this.toConnectedAccountStatus(worker);
    }

    const account = await this.stripeService.client.accounts.retrieve(
      worker.stripeAccountId,
    );
    const updatedWorker = await this.persistConnectedAccountState(account);

    if (!updatedWorker) {
      throw new NotFoundException('Worker Stripe account is not linked');
    }

    return this.toConnectedAccountStatus(updatedWorker);
  }

  handleWebhook(payload: Buffer, signature: string) {
    const event = this.stripeService.constructWebhookEvent(payload, signature);
    return this.processWebhookEvent(event);
  }

  async executeWorkerTransfer(workerTransferId: string) {
    const transfer = await this.prisma.workerTransfer.findUnique({
      where: { id: workerTransferId },
      include: {
        job: {
          include: {
            payment: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Worker transfer not found');
    }

    if (
      transfer.status === WorkerTransferStatus.SUCCEEDED &&
      transfer.stripeTransferId
    ) {
      return transfer;
    }

    await this.prisma.workerTransfer.update({
      where: { id: transfer.id },
      data: {
        status: WorkerTransferStatus.PENDING,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });

    try {
      const stripeTransfer = await this.stripeService.client.transfers.create(
        {
          amount: transfer.amountMinor,
          currency: transfer.currency,
          destination: transfer.stripeAccountId,
          transfer_group: `job:${transfer.jobId}`,
          source_transaction: transfer.job.payment?.stripeChargeId ?? undefined,
          metadata: {
            jobId: transfer.jobId,
            workerId: transfer.workerId,
            workerTransferId: transfer.id,
          },
        },
        {
          idempotencyKey: `worker-transfer:${transfer.jobId}`,
        },
      );

      return this.prisma.workerTransfer.update({
        where: { id: transfer.id },
        data: {
          stripeTransferId: stripeTransfer.id,
          status: WorkerTransferStatus.SUCCEEDED,
          lastError: null,
        },
      });
    } catch (error) {
      return this.prisma.workerTransfer.update({
        where: { id: transfer.id },
        data: {
          status: WorkerTransferStatus.FAILED,
          lastError: this.getErrorMessage(error),
        },
      });
    }
  }

  async refundOpenJob(jobId: string, clientId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
      },
    });

    if (!job || job.clientId !== clientId || !job.payment) {
      throw new NotFoundException('Job payment not found');
    }

    if (job.assignedWorkerId) {
      throw new ConflictException(
        'Only paid, open, unassigned jobs can be refunded',
      );
    }

    if (
      job.payment.status === JobPaymentStatus.REFUNDED &&
      job.status === JobStatus.CANCELLED
    ) {
      return job;
    }

    if (
      job.payment.status === JobPaymentStatus.REFUND_PENDING &&
      job.status === JobStatus.CANCELLED
    ) {
      return job;
    }

    if (job.status !== JobStatus.OPEN) {
      throw new ConflictException(
        'Only paid, open, unassigned jobs can be refunded',
      );
    }

    if (
      job.payment.status !== JobPaymentStatus.SUCCEEDED ||
      (!job.payment.stripePaymentIntentId && !job.payment.stripeChargeId)
    ) {
      throw new ConflictException('Job does not have a refundable payment');
    }

    const reserved = await this.prisma.jobPayment.updateMany({
      where: {
        id: job.payment.id,
        status: JobPaymentStatus.SUCCEEDED,
      },
      data: {
        status: JobPaymentStatus.REFUND_PENDING,
        refundRequestedAt: new Date(),
        refundFailureMessage: null,
      },
    });

    if (reserved.count === 0) {
      return this.getRefundState(job.id);
    }

    try {
      const refund = await this.stripeService.client.refunds.create(
        {
          payment_intent: job.payment.stripePaymentIntentId ?? undefined,
          charge: job.payment.stripePaymentIntentId
            ? undefined
            : (job.payment.stripeChargeId ?? undefined),
          reason: 'requested_by_customer',
          metadata: {
            jobId: job.id,
            jobPaymentId: job.payment.id,
          },
        },
        {
          idempotencyKey: `job-refund:${job.id}`,
        },
      );

      await this.applyRefundState(refund);
      return this.getRefundState(job.id);
    } catch (error) {
      await this.prisma.jobPayment.updateMany({
        where: {
          id: job.payment.id,
          status: JobPaymentStatus.REFUND_PENDING,
          stripeRefundId: null,
        },
        data: {
          status: JobPaymentStatus.SUCCEEDED,
          refundFailureMessage: this.getErrorMessage(error),
        },
      });

      throw error;
    }
  }

  private async processWebhookEvent(event: StripeEvent) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.stripeWebhookEvent.create({
          data: {
            stripeEventId: event.id,
            type: event.type,
          },
        });

        switch (event.type) {
          case 'payment_intent.succeeded':
            await this.handlePaymentIntentSucceeded(tx, event.data.object);
            break;
          case 'payment_intent.payment_failed':
            await this.handlePaymentIntentFailed(tx, event.data.object);
            break;
          case 'payment_intent.canceled':
            await this.handlePaymentIntentCanceled(tx, event.data.object);
            break;
          case 'checkout.session.completed':
            await this.handleCheckoutSessionCompleted(tx, event.data.object);
            break;
          case 'account.updated':
            await this.persistConnectedAccountState(event.data.object, tx);
            break;
          case 'refund.created':
          case 'refund.updated':
          case 'refund.failed':
            await this.applyRefundState(event.data.object, tx);
            break;
          case 'charge.refunded':
            await this.handleChargeRefunded(tx, event.data.object);
            break;
          default:
            break;
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingEvent = await this.prisma.stripeWebhookEvent.findUnique({
          where: { stripeEventId: event.id },
        });

        if (existingEvent) {
          return { received: true, duplicate: true };
        }
      }

      throw error;
    }

    return { received: true, duplicate: false };
  }

  private async handlePaymentIntentSucceeded(
    tx: Prisma.TransactionClient,
    paymentIntent: StripePaymentIntent,
  ) {
    const payment = await this.findPaymentForIntent(tx, paymentIntent);

    if (!payment) {
      return;
    }

    if (
      paymentIntent.amount_received !== payment.amountMinor ||
      paymentIntent.currency.toLowerCase() !== payment.currency.toLowerCase()
    ) {
      throw new Error(
        `PaymentIntent ${paymentIntent.id} amount or currency mismatch`,
      );
    }

    const chargeId =
      typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;
    const paidAt = new Date();

    await tx.jobPayment.update({
      where: { id: payment.id },
      data: {
        status: JobPaymentStatus.SUCCEEDED,
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: chargeId ?? undefined,
        failureCode: null,
        failureMessage: null,
      },
    });

    await tx.job.updateMany({
      where: {
        id: payment.jobId,
        status: JobStatus.PAYMENT_PENDING,
      },
      data: {
        status: JobStatus.OPEN,
        paidAt,
      },
    });
  }

  private async handlePaymentIntentFailed(
    tx: Prisma.TransactionClient,
    paymentIntent: StripePaymentIntent,
  ) {
    const payment = await this.findPaymentForIntent(tx, paymentIntent);

    if (!payment) {
      return;
    }

    await tx.jobPayment.update({
      where: { id: payment.id },
      data: {
        status: JobPaymentStatus.FAILED,
        stripePaymentIntentId: paymentIntent.id,
        failureCode: paymentIntent.last_payment_error?.code ?? null,
        failureMessage: paymentIntent.last_payment_error?.message ?? null,
      },
    });
  }

  private async handlePaymentIntentCanceled(
    tx: Prisma.TransactionClient,
    paymentIntent: StripePaymentIntent,
  ) {
    const payment = await this.findPaymentForIntent(tx, paymentIntent);

    if (!payment) {
      return;
    }

    await tx.jobPayment.update({
      where: { id: payment.id },
      data: {
        status: JobPaymentStatus.CANCELED,
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    await tx.job.updateMany({
      where: {
        id: payment.jobId,
        status: JobStatus.PAYMENT_PENDING,
      },
      data: {
        status: JobStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  }

  private async handleCheckoutSessionCompleted(
    tx: Prisma.TransactionClient,
    session: StripeCheckoutSession,
  ) {
    const jobPaymentId = session.metadata?.jobPaymentId;

    if (!jobPaymentId) {
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    await tx.jobPayment.updateMany({
      where: { id: jobPaymentId },
      data: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId ?? undefined,
      },
    });
  }

  private async findPaymentForIntent(
    tx: Prisma.TransactionClient,
    paymentIntent: StripePaymentIntent,
  ) {
    const paymentByIntent = await tx.jobPayment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (paymentByIntent) {
      return paymentByIntent;
    }

    const jobPaymentId = paymentIntent.metadata.jobPaymentId;

    if (!jobPaymentId) {
      return null;
    }

    return tx.jobPayment.findUnique({
      where: { id: jobPaymentId },
    });
  }

  private async applyRefundState(
    refund: StripeRefund,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const payment = await this.findPaymentForRefund(tx, refund);

    if (!payment) {
      return;
    }

    const isSucceeded = refund.status === 'succeeded';
    const isFailed = refund.status === 'failed' || refund.status === 'canceled';
    const nextPaymentStatus = isSucceeded
      ? JobPaymentStatus.REFUNDED
      : isFailed
        ? JobPaymentStatus.SUCCEEDED
        : JobPaymentStatus.REFUND_PENDING;

    await tx.jobPayment.update({
      where: { id: payment.id },
      data: {
        status: nextPaymentStatus,
        stripeRefundId: refund.id,
        refundedAmountMinor: isFailed ? 0 : refund.amount,
        refundedAt: isSucceeded ? new Date() : null,
        refundFailureMessage: isFailed
          ? (refund.failure_reason ?? `Refund ${refund.status}`)
          : null,
      },
    });

    if (isFailed) {
      await tx.job.updateMany({
        where: {
          id: payment.jobId,
          status: JobStatus.CANCELLED,
          assignedWorkerId: null,
        },
        data: {
          status: JobStatus.OPEN,
          cancelledAt: null,
        },
      });
      return;
    }

    await tx.job.updateMany({
      where: {
        id: payment.jobId,
        assignedWorkerId: null,
        status: {
          in: [JobStatus.OPEN, JobStatus.CANCELLED],
        },
      },
      data: {
        status: JobStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  }

  private async handleChargeRefunded(
    tx: Prisma.TransactionClient,
    charge: StripeCharge,
  ) {
    const payment = await tx.jobPayment.findUnique({
      where: { stripeChargeId: charge.id },
    });

    if (!payment || charge.amount_refunded <= 0) {
      return;
    }

    const isFullRefund = charge.amount_refunded >= payment.amountMinor;

    await tx.jobPayment.update({
      where: { id: payment.id },
      data: {
        status: isFullRefund
          ? JobPaymentStatus.REFUNDED
          : JobPaymentStatus.PARTIALLY_REFUNDED,
        refundedAmountMinor: charge.amount_refunded,
        refundedAt: isFullRefund ? new Date() : null,
        refundFailureMessage: null,
      },
    });

    if (isFullRefund) {
      await tx.job.updateMany({
        where: {
          id: payment.jobId,
          assignedWorkerId: null,
        },
        data: {
          status: JobStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });
    }
  }

  private async findPaymentForRefund(
    tx: Prisma.TransactionClient | PrismaService,
    refund: StripeRefund,
  ) {
    const paymentByRefund = await tx.jobPayment.findUnique({
      where: { stripeRefundId: refund.id },
    });

    if (paymentByRefund) {
      return paymentByRefund;
    }

    const jobPaymentId = refund.metadata?.jobPaymentId;

    if (!jobPaymentId) {
      return null;
    }

    return tx.jobPayment.findUnique({
      where: { id: jobPaymentId },
    });
  }

  private getRefundState(jobId: string) {
    return this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
      },
    });
  }

  private async ensureStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripeService.client.customers.create({
      email: user.email,
      name: user.username ?? undefined,
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customer.id,
      },
    });

    return customer.id;
  }

  private async getWorker(clerkUserId: string) {
    const worker = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!worker) {
      throw new NotFoundException('User not found');
    }

    if (worker.role !== 'WORKER') {
      throw new ForbiddenException('Only workers can use Stripe Connect');
    }

    return worker;
  }

  private async persistConnectedAccountState(
    account: StripeAccount,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const worker = await tx.user.findUnique({
      where: { stripeAccountId: account.id },
    });

    if (!worker) {
      return null;
    }

    const transfersEnabled = account.capabilities?.transfers === 'active';
    const hasRequirements =
      Boolean(account.requirements?.disabled_reason) ||
      Boolean(account.requirements?.currently_due?.length) ||
      Boolean(account.requirements?.past_due?.length);

    let onboardingStatus: StripeOnboardingStatus =
      StripeOnboardingStatus.PENDING;

    if (hasRequirements) {
      onboardingStatus = StripeOnboardingStatus.RESTRICTED;
    } else if (
      account.details_submitted &&
      transfersEnabled &&
      account.payouts_enabled
    ) {
      onboardingStatus = StripeOnboardingStatus.COMPLETE;
    }

    return tx.user.update({
      where: { id: worker.id },
      data: {
        stripeDetailsSubmitted: account.details_submitted,
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeTransfersEnabled: transfersEnabled,
        stripeOnboardingStatus: onboardingStatus,
      },
    });
  }

  private toConnectedAccountStatus(user: User) {
    return {
      stripeAccountId: user.stripeAccountId,
      onboardingStatus: user.stripeOnboardingStatus,
      detailsSubmitted: user.stripeDetailsSubmitted,
      chargesEnabled: user.stripeChargesEnabled,
      payoutsEnabled: user.stripePayoutsEnabled,
      transfersEnabled: user.stripeTransfersEnabled,
      ready:
        user.stripeOnboardingStatus === StripeOnboardingStatus.COMPLETE &&
        user.stripeTransfersEnabled &&
        user.stripePayoutsEnabled,
    };
  }

  private withJobQuery(
    url: string,
    jobId: string,
    includeSessionId: boolean,
  ): string {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set('jobId', jobId);
    const urlWithJob = parsedUrl.toString();

    if (!includeSessionId) {
      return urlWithJob;
    }

    const separator = urlWithJob.includes('?') ? '&' : '?';
    return `${urlWithJob}${separator}session_id={CHECKOUT_SESSION_ID}`;
  }

  private requireEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} is not set`);
    }

    return value;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown Stripe error';
  }
}
