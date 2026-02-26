import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Calculate status dynamically based on last_seen (heartbeat every 30s, timeout 60s)
    const query = `
      SELECT 
        t.*, 
        CASE 
          WHEN last_seen IS NULL THEN 'pending'
          WHEN last_seen > NOW() - INTERVAL '1 minute' THEN 'online'
          ELSE 'offline'
        END as status,
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
    return NextResponse.json(result.rows);
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
