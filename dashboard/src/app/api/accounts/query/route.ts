import { NextResponse } from 'next/server';

async function fetchAccount(url: string, timeoutMs: number = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const publicKey = searchParams.get('publicKey');
  const ip = searchParams.get('ip');

  if (!publicKey) {
    return NextResponse.json({ error: 'Public Key is required' }, { status: 400 });
  }

  let url = '';
  const isNodeQuery = ip && ip !== 'public';
  
  if (isNodeQuery) {
    url = `http://${ip}:8000/accounts/${publicKey}`;
  } else {
    url = `https://horizon-testnet.stellar.org/accounts/${publicKey}`;
  }

  try {
    const response = await fetchAccount(url, 15000);

    if (response.status === 404) {
      return NextResponse.json({ error: 'Account not found on this node/network' }, { status: 404 });
    }

    if (!response.ok) {
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            return NextResponse.json(json, { status: response.status });
        } catch {
             throw new Error(`Horizon error: ${response.status} - ${text}`);
        }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error fetching account from ${url}:`, error);
    
    // Check if it's a timeout error (AbortError or Undici timeout)
    const isTimeout = error.name === 'AbortError' || 
                      error.code === 'UND_ERR_CONNECT_TIMEOUT' || 
                      (error.cause && error.cause.code === 'UND_ERR_CONNECT_TIMEOUT') ||
                      error.cause?.code === 'ECONNREFUSED'; // Also catch refused connections

    // Fallback logic for local node queries
    if (isNodeQuery && (isTimeout || error.cause?.code === 'ECONNREFUSED')) {
        console.log(`Primary IP ${ip} failed. Attempting localhost fallback...`);
        try {
            const fallbackUrl = `http://127.0.0.1:8000/accounts/${publicKey}`;
            const fallbackResponse = await fetchAccount(fallbackUrl, 5000); // Short timeout for fallback
            
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                // Add metadata to indicate fallback was used
                return NextResponse.json({
                    ...data,
                    _meta: {
                        source: 'fallback_localhost',
                        original_target: url
                    }
                });
            }
        } catch (fallbackError) {
            console.error('Fallback to localhost also failed:', fallbackError);
        }
    }

    if (isTimeout) {
        return NextResponse.json({
            error: 'Connection Timeout',
            details: 'The node did not respond within 15 seconds. Check if port 8000 is open and accessible from the dashboard server.',
            target: url,
            suggestion: 'If running locally, try using 127.0.0.1 or localhost.'
        }, { status: 504 });
    }

    return NextResponse.json({ 
        error: 'Failed to fetch account details', 
        details: error.message,
        target: url
    }, { status: 500 });
  }
}
