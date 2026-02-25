import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
  try {
    // 1. Check if we already have 5 validators
    const checkQuery = `SELECT COUNT(*) FROM testnet_node_identity WHERE role = 'validator'`;
    const checkResult = await pool.query(checkQuery);
    const validatorCount = parseInt(checkResult.rows[0].count);

    if (validatorCount >= 5) {
      return NextResponse.json({ message: 'Quorum already met (5+ validators exist)', count: validatorCount });
    }

    // 2. Select up to 5 unconfigured nodes to promote
    const limit = 5 - validatorCount;
    const selectQuery = `
      SELECT id FROM testnet_node_identity
      WHERE role IS NULL OR role = 'none'
      ORDER BY created_at ASC
      LIMIT $1
    `;
    const nodesToPromote = await pool.query(selectQuery, [limit]);

    if (nodesToPromote.rowCount === 0) {
      return NextResponse.json({ error: 'No available nodes to promote' }, { status: 400 });
    }

    const ids = nodesToPromote.rows.map(row => row.id);

    // 3. Update them to be validators
    const updateQuery = `
      UPDATE testnet_node_identity
      SET role = 'validator', quorum_group = 1, config_status = 'configured'
      WHERE id = ANY($1::int[])
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [ids]);

    return NextResponse.json({
      success: true,
      promoted: updateResult.rows,
      message: `Promoted ${updateResult.rowCount} nodes to validators`
    });

  } catch (error) {
    console.error('Failed to auto-provision:', error);
    return NextResponse.json({ error: 'Failed to auto-provision' }, { status: 500 });
  }
}
