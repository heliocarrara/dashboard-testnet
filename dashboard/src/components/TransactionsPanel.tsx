'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Send, Play, Server, RefreshCw, Activity } from 'lucide-react';

interface Account {
    id: number;
    name: string;
    public_key: string;
    secret_key: string;
    created_at: string;
    balance?: string;
}

interface TransactionsPanelProps {
    nodes?: any[];
}

export default function TransactionsPanel({ nodes = [] }: TransactionsPanelProps) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Manual Transaction State
    const [sourceAccount, setSourceAccount] = useState<string>('');
    const [destinationAccount, setDestinationAccount] = useState<string>('');
    const [amount, setAmount] = useState<string>('10');
    const [selectedNode, setSelectedNode] = useState<string>('');
    const [txStatus, setTxStatus] = useState<{type: 'success' | 'error' | 'loading' | null, message: string}>({ type: null, message: '' });

    // Batch Generator State
    const [genCount, setGenCount] = useState<number>(10);
    const [isGenerating, setIsGenerating] = useState(false);
    const [genProgress, setGenProgress] = useState<{current: number, total: number, success: number, fail: number} | null>(null);

    // Transaction Log State
    const [logs, setLogs] = useState<Array<{
        id: string, 
        timestamp: string, 
        type: 'info' | 'success' | 'error' | 'warning', 
        message: string
    }>>([]);

    const addLog = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
        setLogs(prev => [{
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toLocaleTimeString(),
            type,
            message
        }, ...prev].slice(0, 100)); // Keep last 100 logs
    };

    const horizonNodes = nodes.filter(n => 
        n.role === 'watcher_horizon' || n.role === 'validator_sdf'
    );

    useEffect(() => {
        fetchAccounts();
        if (horizonNodes.length > 0) {
            setSelectedNode(horizonNodes[0].ip_address);
        }
    }, [nodes]);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/accounts');
            const data = await res.json();
            setAccounts(data);
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
            addLog('error', 'Failed to fetch accounts list');
        } finally {
            setLoading(false);
        }
    };

    const handleSendTransaction = async () => {
        if (!sourceAccount || !destinationAccount || !amount || !selectedNode) {
            setTxStatus({ type: 'error', message: 'Please fill all fields' });
            addLog('warning', 'Transaction attempt failed: Missing fields');
            return;
        }

        setTxStatus({ type: 'loading', message: 'Submitting transaction...' });
        addLog('info', `Initiating transaction: ${amount} XLM from Account #${sourceAccount} to ${destinationAccount.substring(0, 8)}...`);

        try {
            addLog('info', 'Building transaction envelope...');
            
            // Simulate step delay for visualization if desired, or just log
            await new Promise(r => setTimeout(r, 500));
            addLog('info', `Signing transaction with Source Account Secret Key...`);
            
            await new Promise(r => setTimeout(r, 500));
            addLog('info', `Submitting to node: ${selectedNode}...`);

            const res = await fetch('/api/transactions/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceId: sourceAccount,
                    destinationAddress: destinationAccount,
                    amount,
                    nodeIp: selectedNode
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Transaction failed');
            }

            addLog('success', `Transaction Confirmed! Hash: ${data.hash}`);
            addLog('info', `Result Code: ${data.result?.result_xdr ? 'tx_success' : 'unknown'}`); // Simplified

            setTxStatus({ type: 'success', message: `Transaction successful! Hash: ${data.hash.substring(0, 15)}...` });
            fetchAccounts(); 
        } catch (error: any) {
            setTxStatus({ type: 'error', message: error.message });
            addLog('error', `Transaction Failed: ${error.message}`);
            if (error.details) {
                addLog('error', `Details: ${error.details}`);
            }
        }
    };

    const handleGenerateTraffic = async () => {
        if (accounts.length < 2) {
            setTxStatus({ type: 'error', message: 'Need at least 2 accounts to generate traffic' });
            addLog('warning', 'Traffic generation aborted: Insufficient accounts');
            return;
        }

        setIsGenerating(true);
        addLog('info', `Starting Traffic Generator: ${genCount} transactions...`);
        setGenProgress({ current: 0, total: genCount, success: 0, fail: 0 });

        let success = 0;
        let fail = 0;

        for (let i = 0; i < genCount; i++) {
            // Pick random source and destination
            const source = accounts[Math.floor(Math.random() * accounts.length)];
            let dest = accounts[Math.floor(Math.random() * accounts.length)];
            
            // Ensure distinct
            while (dest.id === source.id) {
                dest = accounts[Math.floor(Math.random() * accounts.length)];
            }

            addLog('info', `[${i+1}/${genCount}] sending ${amount} XLM from ${source.name} to ${dest.name}...`);

            try {
                // Determine node (randomly from available)
                const node = horizonNodes.length > 0 
                    ? horizonNodes[Math.floor(Math.random() * horizonNodes.length)].ip_address
                    : selectedNode;

                const res = await fetch('/api/transactions/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sourceId: source.id,
                        destinationAddress: dest.public_key,
                        amount: (Math.random() * 10 + 1).toFixed(2), // Random amount 1-10
                        nodeIp: node
                    })
                });

                if (res.ok) {
                    success++;
                    addLog('success', `[${i+1}/${genCount}] Success`);
                } else {
                    fail++;
                    addLog('error', `[${i+1}/${genCount}] Failed`);
                }
            } catch (e: any) {
                fail++;
                addLog('error', `[${i+1}/${genCount}] Error: ${e.message}`);
            }

            setGenProgress({ current: i + 1, total: genCount, success, fail });
            // Small delay
            await new Promise(r => setTimeout(r, 200));
        }

        addLog('info', `Traffic Generation Completed. Success: ${success}, Fail: ${fail}`);
        setIsGenerating(false);
    };

    return (
        <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar">
            
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <ArrowRightLeft className="text-orange-400" />
                        Transaction Manager
                    </h2>
                    <p className="text-gray-400 text-sm">Manage transfers and generate network traffic</p>
                </div>
                <button 
                    onClick={fetchAccounts}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* Left Column: Manual Transaction */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Send size={20} className="text-blue-400" />
                        Manual Transfer
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Source Account (DB)</label>
                            <select 
                                value={sourceAccount}
                                onChange={(e) => setSourceAccount(e.target.value)}
                                className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-3 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select Source Account</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name} ({acc.public_key.substring(0, 8)}...)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destination Address</label>
                            <div className="flex gap-2">
                                <select 
                                    onChange={(e) => setDestinationAccount(e.target.value)}
                                    className="w-1/3 bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-3 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select DB Account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.public_key}>
                                            {acc.name}
                                        </option>
                                    ))}
                                </select>
                                <input 
                                    type="text" 
                                    value={destinationAccount}
                                    onChange={(e) => setDestinationAccount(e.target.value)}
                                    placeholder="G..."
                                    className="flex-1 bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-3 focus:ring-blue-500 focus:border-blue-500 font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (XLM)</label>
                                <input 
                                    type="number" 
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-3 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Node</label>
                                <select 
                                    value={selectedNode}
                                    onChange={(e) => setSelectedNode(e.target.value)}
                                    className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-3 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select Node</option>
                                    {horizonNodes.map(node => (
                                        <option key={node.id} value={node.ip_address}>
                                            {node.hostname} ({node.ip_address})
                                        </option>
                                    ))}
                                    <option value="custom">Custom IP...</option>
                                </select>
                            </div>
                        </div>

                        <button 
                            onClick={handleSendTransaction}
                            disabled={txStatus.type === 'loading'}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {txStatus.type === 'loading' ? <RefreshCw className="animate-spin" /> : <Send size={18} />}
                            Send Transaction
                        </button>

                        {txStatus.message && (
                            <div className={`p-3 rounded-lg text-sm border ${txStatus.type === 'success' ? 'bg-green-900/30 border-green-800 text-green-400' : txStatus.type === 'error' ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-blue-900/30 border-blue-800 text-blue-400'}`}>
                                {txStatus.message}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Generators & Logs */}
                <div className="flex flex-col gap-6">
                    
                    {/* Traffic Generator */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col gap-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Activity size={20} className="text-purple-400" />
                            Traffic Generator
                        </h3>
                        <p className="text-gray-400 text-sm">Generate random transactions between existing accounts.</p>
                        
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Transaction Count</label>
                                <input 
                                    type="number" 
                                    value={genCount}
                                    onChange={(e) => setGenCount(parseInt(e.target.value))}
                                    className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-3"
                                />
                            </div>
                            <button 
                                onClick={handleGenerateTraffic}
                                disabled={isGenerating}
                                className="mt-5 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isGenerating ? <RefreshCw className="animate-spin" /> : <Play size={18} />}
                                Start
                            </button>
                        </div>

                        {genProgress && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>Progress: {genProgress.current} / {genProgress.total}</span>
                                    <span>Success: {genProgress.success} | Fail: {genProgress.fail}</span>
                                </div>
                                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-purple-500 h-full transition-all duration-300"
                                        style={{ width: `${(genProgress.current / genProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Transaction Log Console */}
                    <div className="bg-gray-900 rounded-xl border border-gray-700 flex flex-col flex-1 overflow-hidden h-[300px]">
                        <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Server size={14} className="text-green-400" />
                                Transaction Log
                            </h3>
                            <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-white">
                                Clear
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs custom-scrollbar bg-black/50">
                            {logs.length === 0 && (
                                <div className="text-gray-600 italic text-center mt-10">No logs available...</div>
                            )}
                            {logs.map(log => (
                                <div key={log.id} className="flex gap-3">
                                    <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
                                    <span className={`${
                                        log.type === 'error' ? 'text-red-400' : 
                                        log.type === 'success' ? 'text-green-400' : 
                                        log.type === 'warning' ? 'text-yellow-400' : 
                                        'text-blue-300'
                                    }`}>
                                        {log.type === 'info' && '> '}
                                        {log.type === 'success' && '✓ '}
                                        {log.type === 'error' && '✗ '}
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}