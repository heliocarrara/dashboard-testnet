import { NextResponse } from 'next/server';
import os from 'os';
import net from 'net';
import pool from '@/lib/db';

function checkP2PConnection(host: string, port: number = 11625, timeout: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

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

  let targetIp = ip;

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
    if (isLocal) {
        targetIp = 'localhost';
    }

    // Start measuring latency
    const start = performance.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Fetch core info
    const response = await fetch(`http://${targetIp}:11626/info`, {
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
    const info = data.info;

    return NextResponse.json({
      status: 'online',
      latency_ms: latency,
      ledger: {
        num: info.ledger.num,
        age: info.ledger.age,
        hash: info.ledger.hash,
        version: info.ledger.version,
        baseFee: info.ledger.baseFee,
        baseReserve: info.ledger.baseReserve
      },
      peers: {
        authenticated: info.peers.authenticated_count,
        pending: info.peers.pending_count
      },
      state: info.state,
      quorum: info.quorum
    });

  } catch (error: any) {
    // Try P2P fallback
    try {
        const p2pStart = performance.now();
        const isP2POnline = await checkP2PConnection(targetIp, 11625);
        const p2pEnd = performance.now();
        
        if (isP2POnline) {
            // Update last_seen in DB
            try {
                await pool.query('UPDATE testnet_node_identity SET last_seen = NOW() WHERE ip_address = $1', [ip]);
            } catch (dbError) {
                console.error('Failed to update node status in DB:', dbError);
            }

            return NextResponse.json({
                status: 'online_p2p',
                latency_ms: Math.round(p2pEnd - p2pStart),
                ledger: { num: 0, age: 0 },
                peers: { authenticated: 'P2P Only', pending: 0 },
                state: 'Synced (Assumed)'
            });
        }
    } catch (p2pError) {
        // Ignore
    }

    console.error('Core metrics error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch Core metrics',
      details: error.message 
    }, { status: 500 });
  }
}
