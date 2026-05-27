import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_nextjs_build', {
  apiVersion: '2025-02-11' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: `Webhook Error: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      console.warn('Supabase admin client not initialized. Database is offline.');
      return NextResponse.json({ received: true });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;

      if (userId) {
        // Fetch current credits to increment cleanly
        const { data: profile, error: fetchError } = await adminClient
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine for default
          console.error(`Failed to fetch user profile for webhook:`, fetchError.message);
          return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const currentCredits = profile?.credits ?? 3;
        const newCredits = currentCredits + 50;

        const { error: updateError } = await adminClient
          .from('profiles')
          .update({
            subscription_status: 'active',
            stripe_customer_id: session.customer as string,
            credits: newCredits
          })
          .eq('id', userId);

        if (updateError) {
          console.error(`Failed to update profile for user ${userId}:`, updateError.message);
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        console.log(`Successfully credited user ${userId} with 50 credits (Total: ${newCredits})`);
      } else {
        console.warn('checkout.session.completed received but no client_reference_id found.');
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      if (customerId) {
        const { error: updateError } = await adminClient
          .from('profiles')
          .update({
            subscription_status: 'past_due'
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          console.error(`Failed to mark profile as past_due for customer ${customerId}:`, updateError.message);
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        console.log(`Successfully marked subscription status as past_due for customer ${customerId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Failed to process Stripe webhook event:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
