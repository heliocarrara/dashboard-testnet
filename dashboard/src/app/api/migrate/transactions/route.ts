import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const client = await pool.connect();
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                hash VARCHAR(64),
                source_account VARCHAR(56) NOT NULL,
                destination_account VARCHAR(56) NOT NULL,
                amount DECIMAL(20, 7) NOT NULL,
                status VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT
            );
        `);
        
        client.release();
        return NextResponse.json({ message: 'Transactions table created successfully' });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}