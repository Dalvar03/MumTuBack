import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CommissionInvoiceStatus,
  JobStatus,
  WorkerTransferStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FakturowniaService } from './fakturownia.service';

@Injectable()
export class CommissionInvoicesService {
  private readonly logger = new Logger(CommissionInvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fakturownia: FakturowniaService,
  ) {}

  isConfigured() {
    return this.fakturownia.isConfigured();
  }

  async issueForJob(jobId: string) {
    if (!this.isConfigured()) {
      return null;
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        assignedWorker: true,
        workerTransfer: true,
        commissionInvoice: true,
      },
    });

    if (
      !job ||
      job.status !== JobStatus.COMPLETED ||
      job.workerTransfer?.status !== WorkerTransferStatus.SUCCEEDED ||
      !job.assignedWorkerId ||
      !job.assignedWorker
    ) {
      return null;
    }

    if (job.commissionInvoice?.status === CommissionInvoiceStatus.ISSUED) {
      return job.commissionInvoice;
    }

    const invoice = await this.prisma.commissionInvoice.upsert({
      where: { jobId: job.id },
      update: {},
      create: {
        jobId: job.id,
        workerId: job.assignedWorkerId,
        amountMinor: job.platformFeeMinor,
        currency: job.currency,
      },
    });

    const claimed = await this.prisma.commissionInvoice.updateMany({
      where: {
        id: invoice.id,
        status: {
          in: [CommissionInvoiceStatus.PENDING, CommissionInvoiceStatus.FAILED],
        },
      },
      data: {
        status: CommissionInvoiceStatus.PROCESSING,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });

    if (claimed.count === 0) {
      return this.prisma.commissionInvoice.findUnique({
        where: { id: invoice.id },
      });
    }

    try {
      const issuedAt = new Date();
      const created = await this.fakturownia.createCommissionInvoice({
        jobId: job.id,
        jobTitle: job.title,
        amountMinor: job.platformFeeMinor,
        currency: job.currency,
        issuedAt,
        transactionAt: job.completedAt ?? issuedAt,
        buyer: {
          name:
            job.assignedWorker.billingName ||
            job.assignedWorker.username ||
            job.assignedWorker.email,
          email: job.assignedWorker.email,
          taxId: job.assignedWorker.billingTaxId,
          street:
            job.assignedWorker.billingStreet || job.assignedWorker.address,
          city: job.assignedWorker.billingCity || job.assignedWorker.city,
          postalCode: job.assignedWorker.billingPostalCode,
          country: job.assignedWorker.billingCountry || 'PL',
        },
      });

      return this.prisma.commissionInvoice.update({
        where: { id: invoice.id },
        data: {
          status: CommissionInvoiceStatus.ISSUED,
          providerId: created.id,
          providerStatus: created.govStatus,
          number: created.number,
          ksefNumber: created.govId,
          pdfUrl: this.fakturownia.getPdfUrl(created.token),
          issuedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const message = this.getErrorMessage(error);

      this.logger.error(
        `Failed to create commission invoice for job ${job.id}: ${message}`,
      );

      return this.prisma.commissionInvoice.update({
        where: { id: invoice.id },
        data: {
          status: CommissionInvoiceStatus.FAILED,
          lastError: message,
        },
      });
    }
  }

  async retryOutstanding() {
    if (!this.isConfigured()) {
      return 0;
    }

    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    await this.prisma.commissionInvoice.updateMany({
      where: {
        status: CommissionInvoiceStatus.PROCESSING,
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: CommissionInvoiceStatus.FAILED,
        lastError: 'Invoice processing timed out and was scheduled for retry',
      },
    });

    const maxAttempts = this.getMaxAttempts();
    const invoices = await this.prisma.commissionInvoice.findMany({
      where: {
        status: {
          in: [CommissionInvoiceStatus.PENDING, CommissionInvoiceStatus.FAILED],
        },
        attemptCount: { lt: maxAttempts },
      },
      orderBy: { updatedAt: 'asc' },
      take: 25,
      select: { jobId: true },
    });

    for (const invoice of invoices) {
      await this.issueForJob(invoice.jobId);
    }

    return invoices.length;
  }

  async listForWorker(clerkUserId: string) {
    const worker = await this.prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!worker) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.commissionInvoice.findMany({
      where: { workerId: worker.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            completedAt: true,
          },
        },
      },
    });
  }

  private getMaxAttempts() {
    const value = Number(process.env.FAKTUROWNIA_MAX_ATTEMPTS ?? 5);

    return Number.isInteger(value) && value > 0 ? value : 5;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error
      ? error.message.slice(0, 2000)
      : String(error);
  }
}
