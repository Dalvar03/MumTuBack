import {
  CommissionInvoiceStatus,
  JobStatus,
  WorkerTransferStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CommissionInvoicesService } from './commission-invoices.service';
import { FakturowniaService } from './fakturownia.service';

describe('CommissionInvoicesService', () => {
  const job = {
    id: 'job-1',
    title: 'Montaż mebli',
    status: JobStatus.COMPLETED,
    platformFeeMinor: 1000,
    currency: 'pln',
    completedAt: new Date('2026-10-22T12:00:00.000Z'),
    assignedWorkerId: 'worker-1',
    assignedWorker: {
      id: 'worker-1',
      username: 'jan',
      email: 'jan@example.com',
      address: 'Testowa 1',
      city: 'Warszawa',
      billingName: 'Jan Kowalski',
      billingTaxId: '5252445767',
      billingStreet: 'Testowa 1',
      billingCity: 'Warszawa',
      billingPostalCode: '00-001',
      billingCountry: 'PL',
    },
    workerTransfer: { status: WorkerTransferStatus.SUCCEEDED },
    commissionInvoice: null,
  };

  const pendingInvoice = {
    id: 'invoice-1',
    jobId: job.id,
    status: CommissionInvoiceStatus.PENDING,
  };

  function createService() {
    const prisma = {
      job: {
        findUnique: jest.fn().mockResolvedValue(job),
      },
      commissionInvoice: {
        upsert: jest.fn().mockResolvedValue(pendingInvoice),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Record<string, unknown> }) => ({
              ...pendingInvoice,
              ...data,
            }),
          ),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    const fakturownia = {
      isConfigured: jest.fn().mockReturnValue(true),
      createCommissionInvoice: jest.fn().mockResolvedValue({
        id: '123',
        number: 'FV/1/2026',
        token: 'token',
        govStatus: 'processing',
        govId: null,
      }),
      getPdfUrl: jest
        .fn()
        .mockReturnValue('https://mumtu.fakturownia.pl/invoice/token.pdf'),
    };

    return {
      service: new CommissionInvoicesService(
        prisma as unknown as PrismaService,
        fakturownia as unknown as FakturowniaService,
      ),
      prisma,
      fakturownia,
    };
  }

  it('stores the issued invoice after a successful provider call', async () => {
    const { service, prisma, fakturownia } = createService();

    const result = await service.issueForJob(job.id);

    expect(fakturownia.createCommissionInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        amountMinor: 1000,
        buyer: expect.objectContaining({
          name: 'Jan Kowalski',
          taxId: '5252445767',
        }) as object,
      }),
    );
    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CommissionInvoiceStatus.ISSUED,
          providerId: '123',
          number: 'FV/1/2026',
        }) as object,
      }),
    );
    expect(result).toMatchObject({
      status: CommissionInvoiceStatus.ISSUED,
      providerId: '123',
    });
  });

  it('marks the invoice failed without throwing when Fakturownia fails', async () => {
    const { service, prisma, fakturownia } = createService();
    fakturownia.createCommissionInvoice.mockRejectedValue(
      new Error('Provider unavailable'),
    );

    const result = await service.issueForJob(job.id);

    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({
      where: { id: pendingInvoice.id },
      data: {
        status: CommissionInvoiceStatus.FAILED,
        lastError: 'Provider unavailable',
      },
    });
    expect(result).toMatchObject({
      status: CommissionInvoiceStatus.FAILED,
      lastError: 'Provider unavailable',
    });
  });
});
