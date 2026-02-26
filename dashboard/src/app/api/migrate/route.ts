
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // 1. Add 'ordem' column if it doesn't exist
    await pool.query(`
      ALTER TABLE testnet_node_identity 
      ADD COLUMN IF NOT EXISTS ordem INTEGER;
    `);

    // 2. Populate 'ordem' for existing rows if null, based on ID
    // We use a DO block or just a simple UPDATE with a subquery/CTE
    // Simple approach: Fetch all, loop, update. Or pure SQL.
    
    // Pure SQL approach to set order sequentially based on ID for those that are null
    await pool.query(`
      WITH Ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn
        FROM testnet_node_identity
      )
      UPDATE testnet_node_identity
      SET ordem = Ordered.rn
      FROM Ordered
      WHERE testnet_node_identity.id = Ordered.id
      AND testnet_node_identity.ordem IS NULL;
    `);

    return NextResponse.json({ message: "Migration completed successfully" });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
