import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import net from 'net';

// Helper to check TCP connection (P2P fallback)
function checkTcpConnection(host: string, port: number, timeout: number = 1000): Promise<boolean> {
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

// Helper to check Node Status via HTTP or TCP
async function checkNodeStatus(node: any): Promise<string> {
    if (!node.ip_address) return 'offline';

    const isHorizon = node.role && node.role.includes('horizon');
    const port = isHorizon ? 8000 : 11626; // Horizon: 8000, Core HTTP: 11626
    const path = isHorizon ? '/' : '/info';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout for fast UI

        const res = await fetch(`http://${node.ip_address}:${port}${path}`, { 
            signal: controller.signal,
            // Disable cache to ensure fresh status
            cache: 'no-store'
        });
        
        clearTimeout(timeoutId);

        if (res.ok) {
            // If we connected successfully, update the DB last_seen asynchronously
            // (We don't await this to keep the UI fast)
            pool.query('UPDATE testnet_node_identity SET last_seen = NOW() WHERE id = $1', [node.id]).catch(err => console.error('Background DB update failed', err));
            return 'online';
        }
    } catch (e) {
        // HTTP failed
    }

    // If HTTP fails, and it's a Core node, try P2P port (11625)
    if (!isHorizon) {
        const p2pOnline = await checkTcpConnection(node.ip_address, 11625, 1000);
        if (p2pOnline) {
            // Update DB for P2P too
            pool.query('UPDATE testnet_node_identity SET last_seen = NOW() WHERE id = $1', [node.id]).catch(err => console.error('Background DB update failed', err));
            return 'online'; // Or 'online_p2p' if we want to distinguish
        }
    }
    
    return 'offline';
}

export async function GET() {
  try {
    // 1. Fetch nodes from DB (Ignore 'status' calculation from DB)
    const query = `
      SELECT 
        t.*, 
        COALESCE(
          (SELECT json_agg(target_node_id) 
           FROM node_relationships 
           WHERE source_node_id = t.id), 
          '[]'::json
        ) as peers
      FROM testnet_node_identity t
      ORDER BY ordem ASC, id ASC
    `;
    const result = await pool.query(query);
    const nodes = result.rows;

    // 2. Perform parallel real-time status checks
    const nodesWithStatus = await Promise.all(nodes.map(async (node) => {
        const realTimeStatus = await checkNodeStatus(node);
        return { 
            ...node, 
            status: realTimeStatus,
            // Keep db_status for debugging if needed, or just overwrite
            db_status: node.last_seen ? 'seen' : 'never' 
        };
    }));

    return NextResponse.json(nodesWithStatus);
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
    return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, role, quorum_group, hostname, ip_address, ordem } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const query = `
      UPDATE testnet_node_identity
      SET role = COALESCE($1, role), 
          quorum_group = COALESCE($2, quorum_group),
          hostname = COALESCE($3, hostname),
          ip_address = COALESCE($4, ip_address),
          ordem = COALESCE($5, ordem)
      WHERE id = $6
      RETURNING *
    `;
    const values = [role, quorum_group, hostname, ip_address, ordem, id];
    
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update node:', error);
    return NextResponse.json({ error: 'Failed to update node' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const query = `DELETE FROM testnet_node_identity WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Node deleted successfully' });
  } catch (error) {
    console.error('Failed to delete node:', error);
    return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 });
  }
}
