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

// Create account
export async function POST(request: Request) {
  try {
    const body = await request.json();
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
