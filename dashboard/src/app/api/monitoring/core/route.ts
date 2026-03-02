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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`http://${targetIp}:11626/info`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Update last_seen in DB for the node
    try {
      await pool.query('UPDATE testnet_node_identity SET last_seen = NOW() WHERE ip_address = $1', [ip]);
    } catch (dbError) {
      console.error('Failed to update node status in DB:', dbError);
    }

    return NextResponse.json({
      status: 'online',
      ledger_num: data.info.ledger.num,
      ledger_age: data.info.ledger.age,
      state: data.info.state,
      peers: data.info.peers,
      quorum: data.info.quorum,
      build: data.info.build,
      protocol_version: data.info.protocol_version
    });
  } catch (error: any) {
    // If HTTP fails, try P2P port (11625)
    try {
        const isP2POnline = await checkP2PConnection(targetIp, 11625);
        if (isP2POnline) {
            // Update last_seen in DB for the node (P2P only)
            try {
                await pool.query('UPDATE testnet_node_identity SET last_seen = NOW() WHERE ip_address = $1', [ip]);
            } catch (dbError) {
                console.error('Failed to update node status in DB:', dbError);
            }

            return NextResponse.json({
                status: 'online_p2p',
                ledger_num: 'N/A (P2P Only)',
                ledger_age: 'N/A',
                state: 'Synced (Assumed)',
                peers: { authenticated: 'P2P Port Open', pending: 0 },
                quorum: { transitive: true },
                build: 'Unknown',
                protocol_version: 'Unknown',
                message: 'HTTP API blocked, but P2P port is reachable.'
            });
        }
    } catch (p2pError) {
        // Ignore P2P error and fall through to original error
    }

    return NextResponse.json({
      status: 'offline',
      error: error.message || 'Failed to connect to Stellar Core',
    }, { status: 200 }); // Return 200 so frontend can handle "offline" state gracefully
  }
}
