import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

export type StripeEvent = ReturnType<
  Stripe.Stripe['webhooks']['constructEvent']
>;

@Injectable()
export class StripeService {
  readonly client: Stripe.Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    this.client = new Stripe(secretKey);
  }

  constructWebhookEvent(payload: Buffer, signature: string): StripeEvent {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }

    return this.client.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }
}
