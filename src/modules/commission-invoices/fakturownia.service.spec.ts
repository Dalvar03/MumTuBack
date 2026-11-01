import { FakturowniaService } from './fakturownia.service';

describe('FakturowniaService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      FAKTUROWNIA_BASE_URL: 'https://mumtu.fakturownia.pl',
      FAKTUROWNIA_API_TOKEN: 'test-token',
      FAKTUROWNIA_SEND_TO_KSEF: 'true',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates a paid commission invoice with a unique order id', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 123,
        number: 'FV/1/2026',
        token: 'public-token',
        gov_status: 'processing',
        gov_id: null,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new FakturowniaService();
    const result = await service.createCommissionInvoice({
      jobId: 'job-1',
      jobTitle: 'Montaż mebli',
      amountMinor: 1234,
      currency: 'pln',
      issuedAt: new Date('2026-10-22T12:00:00.000Z'),
      transactionAt: new Date('2026-10-22T12:00:00.000Z'),
      buyer: {
        name: 'Jan Kowalski',
        email: 'jan@example.com',
        taxId: '5252445767',
        street: 'Testowa 1',
        city: 'Warszawa',
        postalCode: '00-001',
        country: 'PL',
      },
    });

    expect(result).toEqual({
      id: '123',
      number: 'FV/1/2026',
      token: 'public-token',
      govStatus: 'processing',
      govId: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = request[1].body;

    if (typeof requestBody !== 'string') {
      throw new Error('Expected a JSON request body');
    }

    const payload = JSON.parse(requestBody) as {
      gov_save_and_send: boolean;
      invoice: Record<string, unknown> & {
        positions: Array<Record<string, unknown>>;
      };
    };

    expect(request[0]).toBe('https://mumtu.fakturownia.pl/invoices.json');
    expect(payload.gov_save_and_send).toBe(true);
    expect(payload.invoice).toMatchObject({
      oid: 'commission:job-1',
      oid_unique: 'yes',
      status: 'paid',
      paid: 12.34,
      currency: 'PLN',
      buyer_tax_no: '5252445767',
      buyer_company: true,
    });
    expect(payload.invoice.positions[0]).toMatchObject({
      quantity: 1,
      total_price_gross: 12.34,
      tax: 23,
    });
    expect(service.getPdfUrl(result.token)).toBe(
      'https://mumtu.fakturownia.pl/invoice/public-token.pdf',
    );
  });

  it('rejects non-Fakturownia base URLs', async () => {
    process.env.FAKTUROWNIA_BASE_URL = 'https://example.com';
    const service = new FakturowniaService();

    await expect(
      service.createCommissionInvoice({
        jobId: 'job-1',
        jobTitle: 'Job',
        amountMinor: 100,
        currency: 'pln',
        issuedAt: new Date(),
        transactionAt: new Date(),
        buyer: { name: 'Buyer', email: 'buyer@example.com' },
      }),
    ).rejects.toThrow('FAKTUROWNIA_BASE_URL');
  });
});
