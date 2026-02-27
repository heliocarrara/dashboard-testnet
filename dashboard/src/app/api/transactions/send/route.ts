import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { Horizon, Keypair, TransactionBuilder, Asset, Networks, Operation } from 'stellar-sdk';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sourceId, destinationAddress, amount, nodeIp } = body;

        if (!sourceId || !destinationAddress || !amount || !nodeIp) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Get Source Account Keys from DB
        const result = await pool.query('SELECT * FROM testnet_accounts WHERE id = $1', [sourceId]);
        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Source account not found' }, { status: 404 });
        }
        const sourceAccount = result.rows[0];
        const sourceKeypair = Keypair.fromSecret(sourceAccount.secret_key);

        // Retry logic: Try provided IP, then localhost if different
        const targetIps = [nodeIp];
        if (nodeIp !== 'localhost' && nodeIp !== '127.0.0.1' && nodeIp !== 'public') {
            targetIps.push('localhost');
        }

        let lastError = null;

        for (const ip of targetIps) {
            try {
                const serverUrl = (ip === 'public') 
                    ? 'https://horizon-testnet.stellar.org' 
                    : `http://${ip}:8000`;
                
                console.log(`Attempting transaction via ${serverUrl}...`);
                const server = new Horizon.Server(serverUrl);

                // Load Account
                const source = await server.loadAccount(sourceKeypair.publicKey());

                // Build Transaction
                const transaction = new TransactionBuilder(source, {
                    fee: Horizon.BASE_FEE,
                    networkPassphrase: Networks.TESTNET
                })
                .addOperation(
                    Operation.payment({ 
                        destination: destinationAddress,
                        asset: Asset.native(),
                        amount: amount.toString()
                    })
                )
                .setTimeout(30)
                .build();

                // Sign
                transaction.sign(sourceKeypair);

                // Submit
                const txResult = await server.submitTransaction(transaction);

                return NextResponse.json({ 
                    success: true, 
                    hash: txResult.hash,
                    result: txResult
                });

            } catch (e: any) {
                console.error(`Transaction attempt failed with IP ${ip}:`, e.message);
                lastError = e;
                // If this was the last IP, or if the error is definitely not a connection error (e.g. op_underfunded), 
                // we might want to stop? 
                // But distinguishing connection errors is hard. Let's try all.
            }
        }

        throw lastError;

    } catch (error: any) {
        console.error('Transaction Error:', error);
        // Extract Horizon error details if available
        let errorMessage = error.message;
        if (error.response && error.response.data && error.response.data.extras) {
             errorMessage = JSON.stringify(error.response.data.extras.result_codes);
        }

        return NextResponse.json({ 
            error: 'Transaction Failed', 
            details: errorMessage 
        }, { status: 500 });
    }
}