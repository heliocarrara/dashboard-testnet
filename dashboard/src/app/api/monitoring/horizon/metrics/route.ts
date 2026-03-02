import { NextResponse } from 'next/server';
import os from 'os';
import pool from '@/lib/db';

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (!iface.internal && iface.family === 'IPv4') {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip) {
    return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
  }

  try {
    const localIps = getLocalIpAddresses();
    
    // Fetch public IP to include in comparison
    let publicIp = '';
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) });
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        publicIp = ipData.ip;
      }
    } catch (e) {
      // Ignore public IP fetch error
    }

    const isLocal = localIps.includes(ip) || ip === publicIp;
    const targetIp = isLocal ? 'localhost' : ip;

    // Start measuring latency
    const start = performance.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for metrics

    // Fetch latest ledgers to calculate close time
    const response = await fetch(`http://${targetIp}:8000/ledgers?order=desc&limit=6`, {
      signal: controller.signal,
    });
    
    const end = performance.now();
    const latency = Math.round(end - start);

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Update last_seen in DB
    try {
      await pool.query('UPDATE testnet_node_identity SET last_seen = NOW() WHERE ip_address = $1', [ip]);
    } catch (dbError) {
      console.error('Failed to update node status in DB:', dbError);
    }

    const data = await response.json();
    const ledgers = data._embedded.records;

    // Calculate average close time
    let totalCloseTime = 0;
    let closeTimeCount = 0;
    const ledgerDetails = [];

    for (let i = 0; i < ledgers.length - 1; i++) {
      const current = new Date(ledgers[i].closed_at).getTime();
      const previous = new Date(ledgers[i+1].closed_at).getTime();
      const diff = (current - previous) / 1000; // in seconds
      
      totalCloseTime += diff;
      closeTimeCount++;

      ledgerDetails.push({
        sequence: ledgers[i].sequence,
        closed_at: ledgers[i].closed_at,
        close_time_s: diff.toFixed(2),
        tx_count: (ledgers[i].successful_transaction_count ?? 0) + (ledgers[i].failed_transaction_count ?? 0),
        op_count: ledgers[i].operation_count ?? 0,
        successful_tx_count: ledgers[i].successful_transaction_count ?? 0,
        failed_tx_count: ledgers[i].failed_transaction_count ?? 0,
      });
    }

    const avgCloseTime = closeTimeCount > 0 ? (totalCloseTime / closeTimeCount).toFixed(2) : 0;

    return NextResponse.json({
      status: 'online',
      latency_ms: latency,
      avg_ledger_close_time_s: avgCloseTime,
      latest_ledger: ledgerDetails[0],
      recent_ledgers: ledgerDetails,
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'offline',
      error: error.message || 'Failed to connect to Horizon Metrics',
    }, { status: 200 });
  }
}
