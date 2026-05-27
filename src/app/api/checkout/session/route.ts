import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_nextjs_build', {
  apiVersion: '2025-02-11' as any,
});

async function handleCheckout(request: Request, token?: string) {
  const client = getSupabase();
  if (!client) {
    return { error: 'Database offline. Local fallback active.', status: 500 };
  }

  let user = null;
  if (token) {
    const { data: { user: authUser }, error } = await client.auth.getUser(token);
    if (!error && authUser) {
      user = authUser;
    }
  }

  if (!user) {
    return { error: 'Unauthorized credentials.', status: 401 };
  }

  const origin = request.headers.get('origin') || new URL(request.url).origin || 'http://localhost:3000';

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'CineForge Premium Credits',
            description: '50 Studio-Grade AI Video Renders',
          },
          unit_amount: 1500, // $15.00
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    client_reference_id: user.id,
    success_url: `${origin}/projects?checkout=success`,
    cancel_url: `${origin}/projects`,
  });

  return { url: session.url };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';
    const result = await handleCheckout(request, token);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.url) {
      return NextResponse.redirect(result.url);
    }

    return NextResponse.json({ error: 'Failed to generate checkout link' }, { status: 500 });
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    const result = await handleCheckout(request, token);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
