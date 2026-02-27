import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
    try {
        // 1. Get all accounts
        const result = await pool.query('SELECT public_key FROM testnet_accounts');
        const accounts = result.rows;
        
        let successCount = 0;
        let failCount = 0;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const failedAccounts: string[] = [];

        // 2. Iterate and check/fund
        // Note: Checking balance for every account is slow. 
        // Optimization: Just try to fund. Friendbot is idempotent-ish (if account exists, it might fail or just send XLM).
        // Actually Friendbot creates account if not exists. If exists, it might error "op_already_exists" or similar if using CreateAccount, 
        // but Friendbot usually just funds. However, Friendbot has rate limits.
        
        // We will try to fund 5 at a time to avoid overwhelming but speed up.
        // And we will add a small delay.

        const batchSize = 3;
        for (let i = 0; i < accounts.length; i += batchSize) {
            const batch = accounts.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (acc: { public_key: string }) => {
                try {
                    const res = await fetch(`https://friendbot.stellar.org/?addr=${acc.public_key}`);
                    if (res.ok) {
                        successCount++;
                    } else {
                        // If it fails, it might be because it's already funded or rate limited.
                        // We count as fail for report but it might be fine.
                        failCount++;
                        failedAccounts.push(acc.public_key);
                    }
                } catch {
                    failCount++;
                }
            }));

            // Small delay to be nice to Friendbot
            await new Promise(r => setTimeout(r, 1000));
        }

        return NextResponse.json({ 
            success: successCount, 
            failed: failCount, 
            message: `Processed ${accounts.length} accounts. Funded: ${successCount}, Failed/Skipped: ${failCount}` 
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}