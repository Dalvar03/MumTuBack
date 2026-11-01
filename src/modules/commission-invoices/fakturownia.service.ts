import { Injectable } from '@nestjs/common';

export type CreateFakturowniaInvoiceInput = {
  jobId: string;
  jobTitle: string;
  amountMinor: number;
  currency: string;
  issuedAt: Date;
  transactionAt: Date;
  buyer: {
    name: string;
    email: string;
    taxId?: string | null;
    street?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
};

export type FakturowniaInvoice = {
  id: string;
  number: string | null;
  token: string | null;
  govStatus: string | null;
  govId: string | null;
};

type FakturowniaResponse = {
  id?: number | string;
  number?: string | null;
  token?: string | null;
  gov_status?: string | null;
  gov_id?: string | null;
};

@Injectable()
export class FakturowniaService {
  isConfigured() {
    return Boolean(
      process.env.FAKTUROWNIA_BASE_URL && process.env.FAKTUROWNIA_API_TOKEN,
    );
  }

  async createCommissionInvoice(
    input: CreateFakturowniaInvoiceInput,
  ): Promise<FakturowniaInvoice> {
    const baseUrl = this.getBaseUrl();
    const apiToken = this.requireEnv('FAKTUROWNIA_API_TOKEN');
    const issueDate = this.formatDate(input.issuedAt);
    const transactionDate = this.formatDate(input.transactionAt);
    const amount = input.amountMinor / 100;
    const tax = this.getTaxRate();
    const departmentId = process.env.FAKTUROWNIA_DEPARTMENT_ID?.trim();

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.getTimeoutMilliseconds(),
    );

    try {
      const response = await fetch(`${baseUrl}/invoices.json`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          api_token: apiToken,
          gov_save_and_send: this.shouldSendToKsef(),
          invoice: {
            kind: process.env.FAKTUROWNIA_INVOICE_KIND?.trim() || 'vat',
            department_id: departmentId || undefined,
            issue_date: issueDate,
            sell_date: transactionDate,
            payment_to: issueDate,
            payment_type: 'compensation',
            status: 'paid',
            paid: amount,
            paid_date: issueDate,
            currency: input.currency.toUpperCase(),
            lang: process.env.FAKTUROWNIA_INVOICE_LANGUAGE?.trim() || 'pl',
            oid: `commission:${input.jobId}`,
            oid_unique: 'yes',
            buyer_name: input.buyer.name,
            buyer_email: input.buyer.email,
            buyer_tax_no: input.buyer.taxId || undefined,
            buyer_street: input.buyer.street || undefined,
            buyer_city: input.buyer.city || undefined,
            buyer_post_code: input.buyer.postalCode || undefined,
            buyer_country: input.buyer.country || 'PL',
            buyer_company: Boolean(input.buyer.taxId),
            positions: [
              {
                name: this.getPositionName(input.jobTitle),
                quantity: 1,
                total_price_gross: amount,
                tax,
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        const responseBody = (await response.text()).slice(0, 1000);
        throw new Error(
          `Fakturownia API returned ${response.status}: ${responseBody}`,
        );
      }

      const result = (await response.json()) as FakturowniaResponse;

      if (result.id === undefined || result.id === null) {
        throw new Error('Fakturownia response did not contain an invoice id');
      }

      return {
        id: String(result.id),
        number: result.number ?? null,
        token: result.token ?? null,
        govStatus: result.gov_status ?? null,
        govId: result.gov_id ?? null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  getPdfUrl(token: string | null) {
    return token ? `${this.getBaseUrl()}/invoice/${token}.pdf` : null;
  }

  private getBaseUrl() {
    const rawUrl = this.requireEnv('FAKTUROWNIA_BASE_URL');
    const url = new URL(rawUrl);

    if (
      url.protocol !== 'https:' ||
      (!url.hostname.endsWith('.fakturownia.pl') &&
        url.hostname !== 'fakturownia.pl')
    ) {
      throw new Error(
        'FAKTUROWNIA_BASE_URL must be an HTTPS fakturownia.pl account URL',
      );
    }

    return url.toString().replace(/\/$/, '');
  }

  private getTaxRate(): number | string {
    const configured = process.env.FAKTUROWNIA_TAX_RATE?.trim() || '23';
    const numeric = Number(configured);

    return Number.isFinite(numeric) ? numeric : configured;
  }

  private getPositionName(jobTitle: string) {
    const prefix =
      process.env.FAKTUROWNIA_COMMISSION_ITEM_NAME?.trim() ||
      'Prowizja platformy';

    return `${prefix} - ${jobTitle}`.slice(0, 256);
  }

  private formatDate(date: Date) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: process.env.FAKTUROWNIA_TIME_ZONE?.trim() || 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value }) => [type, value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  private shouldSendToKsef() {
    return process.env.FAKTUROWNIA_SEND_TO_KSEF?.toLowerCase() === 'true';
  }

  private getTimeoutMilliseconds() {
    const timeout = Number(process.env.FAKTUROWNIA_TIMEOUT_MS ?? 10_000);

    return Number.isFinite(timeout) && timeout > 0 ? timeout : 10_000;
  }

  private requireEnv(name: string) {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new Error(`${name} is not set`);
    }

    return value;
  }
}
