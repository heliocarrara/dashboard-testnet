import { NextResponse } from 'next/server';
import os from 'os';

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`http://${targetIp}:8000/`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      status: 'online',
      core_latest_ledger: data.core_latest_ledger,
      history_latest_ledger: data.history_latest_ledger,
      horizon_version: data.horizon_version,
      core_version: data.core_version,
      network_passphrase: data.network_passphrase,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'offline',
      error: error.message || 'Failed to connect to Horizon',
    }, { status: 200 }); // Return 200 so frontend can handle "offline" state gracefully
  }
}
