import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hostname } = body;

    if (!hostname) {
      return NextResponse.json({ error: 'Hostname is required' }, { status: 400 });
    }

    const query = `
      UPDATE testnet_node_identity
      SET last_seen = NOW(), status = 'online'
      WHERE hostname = $1
      RETURNING *
    `;
    const values = [hostname];
    
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, node: result.rows[0] });
  } catch (error) {
    console.error('Failed to update heartbeat:', error);
    return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 });
  }
}
