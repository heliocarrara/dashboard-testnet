import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const result = await pool.query(
            `SELECT * FROM transactions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        return NextResponse.json({ 
            transactions: result.rows,
            count: result.rowCount 
        });
    } catch (error: any) {
        console.error('Failed to fetch transaction history:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}