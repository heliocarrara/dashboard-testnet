import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { Keypair } from 'stellar-sdk';

// List accounts
export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM testnet_accounts ORDER BY created_at DESC');
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create account (Single or Batch)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Batch Creation
    if (body.count && typeof body.count === 'number') {
        const count = Math.min(Math.max(1, body.count), 50); // Limit between 1 and 50
        const accounts = [];

        for (let i = 0; i < count; i++) {
            const pair = Keypair.random();
            accounts.push({
                name: `Batch Account ${Date.now()}-${i}`,
                publicKey: pair.publicKey(),
                secretKey: pair.secret()
            });
        }

        // Generate placeholders: ($1, $2, $3), ($4, $5, $6), ...
        const placeholders = accounts.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
        
        // Flatten values array
        const values = accounts.flatMap(acc => [acc.name, acc.publicKey, acc.secretKey]);

        const query = `
            INSERT INTO testnet_accounts (name, public_key, secret_key)
            VALUES ${placeholders}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return NextResponse.json({ message: 'Batch created', count: result.rowCount, accounts: result.rows });
    }

    // Single Creation (Legacy/Default)
    const name = body.name || 'Untitled Account';

    // Generate new keypair
    const pair = Keypair.random();
    const publicKey = pair.publicKey();
    const secretKey = pair.secret();

    const query = `
      INSERT INTO testnet_accounts (name, public_key, secret_key)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [name, publicKey, secretKey]);
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Delete account
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query('DELETE FROM testnet_accounts WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
