import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { Horizon, Keypair, TransactionBuilder, Asset, Networks, Operation, BASE_FEE } from 'stellar-sdk';

export async function POST(request: Request) {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
        async start(controller) {
            const sendLog = (msg: string) => {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'log', message: msg }) + '\n'));
            };

            const sendResult = (data: any) => {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'result', data }) + '\n'));
            };

            const sendError = (error: string, details?: any) => {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error, details }) + '\n'));
            };

            try {
                const body = await request.json();
                const { sourceId, destinationAddress, amount, nodeIp } = body;

                if (!sourceId || !destinationAddress || !amount || !nodeIp) {
                    sendError('Missing required fields');
                    controller.close();
                    return;
                }

                // 1. Get Source Account Keys from DB
                sendLog(`Retrieving source account (ID: ${sourceId}) keys from database...`);
                const result = await pool.query('SELECT * FROM testnet_accounts WHERE id = $1', [sourceId]);
                
                if (result.rows.length === 0) {
                    sendError('Source account not found');
                    controller.close();
                    return;
                }
                
                const sourceAccount = result.rows[0];
                const sourceKeypair = Keypair.fromSecret(sourceAccount.secret_key);
                sendLog(`Source account loaded: ${sourceAccount.public_key.substring(0, 8)}...`);

                // Retry logic: Try provided IP, then localhost if different
                const targetIps = [nodeIp];
                if (nodeIp !== 'localhost' && nodeIp !== '127.0.0.1' && nodeIp !== 'public') {
                    targetIps.push('localhost');
                }

                let lastError = null;
                let success = false;

                for (const ip of targetIps) {
                    try {
                        const serverUrl = (ip === 'public') 
                            ? 'https://horizon-testnet.stellar.org' 
                            : `http://${ip}:8000`;
                        
                        sendLog(`Connecting to Horizon node at ${serverUrl}...`);
                        const server = new Horizon.Server(serverUrl, { allowHttp: true });

                        // Load Account
                        sendLog(`Fetching sequence number for ${sourceAccount.public_key.substring(0, 8)}...`);
                        const source = await server.loadAccount(sourceKeypair.publicKey());
                        sendLog(`Sequence number retrieved: ${source.sequence}`);

                        // Build Transaction
                        sendLog(`Building transaction envelope (Payment: ${amount} XLM -> ${destinationAddress.substring(0, 8)}...)...`);
                        const transaction = new TransactionBuilder(source, {
                            fee: BASE_FEE,
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
                        sendLog(`Signing transaction with secret key...`);
                        transaction.sign(sourceKeypair);
                        sendLog(`Transaction signed. Signature count: ${transaction.signatures.length}`);

                        // Submit
                        sendLog(`Submitting transaction to network...`);
                        const txResult = await server.submitTransaction(transaction);

                        sendLog(`Transaction submitted successfully! Hash: ${txResult.hash.substring(0, 10)}...`);
                        
                        // Save to DB (Success)
                        try {
                            await pool.query(
                                `INSERT INTO transactions (hash, source_account, destination_account, amount, status) 
                                 VALUES ($1, $2, $3, $4, 'success')`,
                                [txResult.hash, sourceAccount.public_key, destinationAddress, amount]
                            );
                            sendLog(`Transaction saved to history.`);
                        } catch (dbError: any) {
                            console.error('Failed to save transaction to DB:', dbError);
                            sendLog(`Warning: Failed to save to history: ${dbError.message}`);
                        }

                        sendResult({ 
                            success: true, 
                            hash: txResult.hash,
                            result: txResult
                        });
                        
                        success = true;
                        break; // Exit retry loop on success

                    } catch (e: any) {
                        sendLog(`Attempt failed with IP ${ip}: ${e.message}`);
                        lastError = e;
                    }
                }

                if (!success) {
                    throw lastError;
                }

            } catch (error: any) {
                console.error('Transaction Error:', error);
                // Extract Horizon error details if available
                let errorMessage = error.message;
                if (error.response && error.response.data && error.response.data.extras) {
                     errorMessage = JSON.stringify(error.response.data.extras.result_codes);
                }
                
                sendLog(`Transaction Final Error: ${errorMessage}`);
                
                // Save failed transaction to DB
                try {
                    await pool.query(
                        `INSERT INTO transactions (hash, source_account, destination_account, amount, status, error_message) 
                         VALUES ($1, $2, $3, $4, 'failed', $5)`,
                        [null, sourceAccount?.public_key || 'unknown', destinationAddress, amount, errorMessage]
                    );
                } catch (dbError) {
                    console.error('Failed to save failed transaction:', dbError);
                }

                sendError('Transaction Failed', errorMessage);
            } finally {
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
