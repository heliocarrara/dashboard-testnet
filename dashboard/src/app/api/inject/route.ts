import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, destination, amount, batchSize } = body;

    // Here we would use the Stellar SDK to build and submit transactions
    // For now, we simulate the load and logging
    
    console.log(`[Stress Test] Injecting ${batchSize} transactions from ${source} to ${destination}`);

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
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to inject transactions:', error);
    return NextResponse.json({ error: 'Failed to inject transactions' }, { status: 500 });
  }
}
