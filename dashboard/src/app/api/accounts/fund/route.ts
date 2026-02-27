import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { publicKey } = await request.json();

    if (!publicKey) {
      return NextResponse.json({ error: 'Public Key is required' }, { status: 400 });
    }

    // Call Friendbot (Testnet)
    const friendbotUrl = `https://friendbot.stellar.org/?addr=${publicKey}`;
    const response = await fetch(friendbotUrl);
    const data = await response.json();

    if (!response.ok) {
        // Friendbot returns JSON with "detail" usually on error
        throw new Error(data.detail || 'Failed to fund account via Friendbot');
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
