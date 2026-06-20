import { getModelByName } from '@adminjs/prisma';
import type {
  ActionContext,
  ActionRequest,
  ActionResponse,
  RecordActionResponse,
} from 'adminjs';
import { PrismaService } from '../database/prisma/prisma.service';
import { DisputesService } from '../modules/disputes/disputes.service';

export function createJobDisputeResource(
  prisma: PrismaService,
  disputesService: DisputesService,
) {
  const enrichRecords = async <
    T extends ActionResponse & {
      record?: RecordActionResponse['record'];
      records?: RecordActionResponse['record'][];
    },
  >(
    response: T,
  ): Promise<T> => {
    const records =
      response.records ?? (response.record ? [response.record] : []);
    const disputeIds = records.map((record) => String(record.id));

    if (disputeIds.length === 0) {
      return response;
    }

    const disputes = await prisma.jobDispute.findMany({
      where: {
        id: {
          in: disputeIds,
        },
      },
      include: {
        openedByClient: true,
        job: {
          include: {
            client: true,
            assignedWorker: true,
            payment: true,
            workerTransfer: true,
          },
        },
      },
    });
    const disputesById = new Map(
      disputes.map((dispute) => [dispute.id, dispute]),
    );

    for (const record of records) {
      const dispute = disputesById.get(String(record.id));

      if (!dispute) {
        continue;
      }

      record.params.clientEmail = dispute.job.client.email;
      record.params.clientUsername = dispute.job.client.username ?? '';
      record.params.workerEmail =
        dispute.job.assignedWorker?.email ?? 'Not assigned';
      record.params.workerUsername =
        dispute.job.assignedWorker?.username ?? 'Not assigned';
      record.params.jobTitle = dispute.job.title;
      record.params.jobStatus = dispute.job.status;
      record.params.jobAmount = `${dispute.job.price.toFixed(2)} ${dispute.job.currency.toUpperCase()}`;
      record.params.workerAmount = `${(dispute.job.workerAmountMinor / 100).toFixed(2)} ${dispute.job.currency.toUpperCase()}`;
      record.params.workerCompletedAt =
        dispute.job.workerCompletedAt?.toISOString() ?? '';
      record.params.approvalDeadlineAt =
        dispute.job.approvalDeadlineAt?.toISOString() ?? '';
      record.params.paymentStatus = dispute.job.payment?.status ?? 'MISSING';
      record.params.paymentIntentId =
        dispute.job.payment?.stripePaymentIntentId ?? '';
      record.params.transferStatus =
        dispute.job.workerTransfer?.status ?? 'NOT_CREATED';
      record.params.transferId =
        dispute.job.workerTransfer?.stripeTransferId ?? '';
    }

    return response;
  };

  const createResolutionAction = (resolution: 'client' | 'worker') => ({
    actionType: 'record' as const,
    component: false,
    guard:
      resolution === 'client'
        ? 'Refund the full payment to the client?'
        : 'Release the worker payout?',
    isVisible: ({ record }: ActionContext) =>
      record?.param('status') === 'OPEN',
    isAccessible: ({ record }: ActionContext) =>
      record?.param('status') === 'OPEN',
    handler: async (
      request: ActionRequest,
      _response: unknown,
      context: ActionContext,
    ): Promise<RecordActionResponse> => {
      const recordId = context.record?.id();

      if (!recordId) {
        throw new Error('Dispute record not found');
      }

      if (request.method === 'post') {
        const adminEmail =
          typeof context.currentAdmin?.email === 'string'
            ? context.currentAdmin.email
            : 'unknown-admin';

        if (resolution === 'client') {
          await disputesService.resolveToClient(recordId, adminEmail);
        } else {
          await disputesService.resolveToWorker(recordId, adminEmail);
        }
      }

      const updatedRecord = await context.resource.findOne(recordId);

      if (!updatedRecord) {
        throw new Error('Dispute record not found after resolution');
      }

      return {
        record: updatedRecord.toJSON(context.currentAdmin),
        notice: {
          message:
            resolution === 'client'
              ? 'Client refund resolution started'
              : 'Worker payout resolution completed',
          type: 'success',
        },
        redirectUrl: context.h.resourceUrl({
          resourceId: context.resource.id(),
        }),
      };
    },
  });

  return {
    resource: {
      // AdminJS Prisma adapter exposes model metadata as an untyped value.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      model: getModelByName('JobDispute'),
      client: prisma,
    },
    options: {
      navigation: {
        name: 'Payments',
        icon: 'AlertTriangle',
      },
      listProperties: [
        'id',
        'status',
        'reason',
        'jobTitle',
        'clientEmail',
        'workerEmail',
        'jobAmount',
        'approvalDeadlineAt',
        'paymentStatus',
        'transferStatus',
        'resolution',
        'createdAt',
      ],
      showProperties: [
        'id',
        'jobId',
        'openedByClientId',
        'jobTitle',
        'jobStatus',
        'clientEmail',
        'clientUsername',
        'workerEmail',
        'workerUsername',
        'jobAmount',
        'workerAmount',
        'workerCompletedAt',
        'approvalDeadlineAt',
        'paymentStatus',
        'paymentIntentId',
        'transferStatus',
        'transferId',
        'reason',
        'description',
        'status',
        'resolution',
        'resolutionError',
        'resolvedByAdminEmail',
        'createdAt',
        'resolvedAt',
        'updatedAt',
      ],
      properties: {
        jobTitle: { type: 'string', isSortable: false },
        jobStatus: { type: 'string', isSortable: false },
        clientEmail: { type: 'string', isSortable: false },
        clientUsername: { type: 'string', isSortable: false },
        workerEmail: { type: 'string', isSortable: false },
        workerUsername: { type: 'string', isSortable: false },
        jobAmount: { type: 'string', isSortable: false },
        workerAmount: { type: 'string', isSortable: false },
        workerCompletedAt: { type: 'datetime', isSortable: false },
        approvalDeadlineAt: { type: 'datetime', isSortable: false },
        paymentStatus: { type: 'string', isSortable: false },
        paymentIntentId: { type: 'string', isSortable: false },
        transferStatus: { type: 'string', isSortable: false },
        transferId: { type: 'string', isSortable: false },
      },
      actions: {
        list: {
          after: enrichRecords,
        },
        show: {
          after: enrichRecords,
        },
        new: { isAccessible: false },
        edit: { isAccessible: false },
        delete: { isAccessible: false },
        bulkDelete: { isAccessible: false },
        refundClient: createResolutionAction('client'),
        resolveToWorker: createResolutionAction('worker'),
      },
    },
  };
}
