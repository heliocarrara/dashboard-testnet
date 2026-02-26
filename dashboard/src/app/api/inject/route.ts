import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, destination, amount, batchSize, horizonUrl } = body;

    // Here we would use the Stellar SDK to build and submit transactions
    // If horizonUrl is provided, we would use it as the server URL:
    // const server = new StellarSdk.Horizon.Server(horizonUrl || 'https://horizon-testnet.stellar.org');
    
    console.log(`[Stress Test] Injecting ${batchSize} transactions from ${source} to ${destination}`);
    if (horizonUrl) {
        console.log(`[Stress Test] Using Horizon Node: ${horizonUrl}`);
    } else {
        console.log(`[Stress Test] Using Default Horizon`);
    }

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    return NextResponse.json({ 
      success: true, 
      message: `Successfully injected ${batchSize} transactions`,
      details: {
        source,
        destination,
        amount,
        batchSize,
        horizonUrl,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to inject transactions:', error);
    return NextResponse.json({ error: 'Failed to inject transactions' }, { status: 500 });
  }
}
