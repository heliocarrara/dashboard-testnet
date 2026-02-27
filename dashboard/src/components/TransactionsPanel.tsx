'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Send, Play, Server, RefreshCw, Activity, Filter, CheckCircle, XCircle, Info, Clock, Hash, ExternalLink, Download } from 'lucide-react';

interface Account {
    id: number;
    name: string;
    public_key: string;
    secret_key: string;
    created_at: string;
    balance?: string;
}

interface Node {
    id: number;
    hostname: string;
    ip_address: string;
    role: string | null;
}

interface TransactionRecord {
    id: string;
    timestamp: Date;
    source: string;
    destination: string;
    amount: string;
    status: 'success' | 'error' | 'pending';
    hash?: string;
    message?: string;
    node?: string;
    type: 'manual' | 'auto';
}

interface TransactionsPanelProps {
    nodes?: Node[];
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

    // Transaction History State
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
    const [filterType, setFilterType] = useState<'all' | 'manual' | 'auto'>('all');

    // Logs (Ephemeral console)
    const [logs, setLogs] = useState<Array<{
        id: string, 
        timestamp: string, 
        type: 'info' | 'success' | 'error' | 'warning', 
        message: string,
        details?: any
    }>>([]);
    
    // View Mode State
    const [viewMode, setViewMode] = useState<'generator' | 'manual'>('generator');

    const addLog = (type: 'info' | 'success' | 'error' | 'warning', message: string, details?: any) => {
        setLogs(prev => [{
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toLocaleTimeString(),
            type,
            message,
            details
        }, ...prev].slice(0, 200)); 
    };

    const addTransaction = (tx: TransactionRecord) => {
        setTransactions(prev => [tx, ...prev]);
    };

    const horizonNodes = nodes.filter(n => 
        n.role === 'watcher_horizon' || n.role === 'validator_sdf'
    );

    useEffect(() => {
        fetchAccounts();
        fetchHistory();
        if (horizonNodes.length > 0) {
            setSelectedNode(horizonNodes[0].ip_address);
        }
    }, [nodes]);

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/transactions/history?limit=50');
            const data = await res.json();
            
            if (data.transactions) {
                const mappedHistory: TransactionRecord[] = data.transactions.map((tx: any) => ({
                    id: tx.id.toString(),
                    timestamp: new Date(tx.created_at),
                    source: tx.source_account, // Name mapping happens in render or needs account list
                    destination: tx.destination_account,
                    amount: tx.amount,
                    status: tx.status,
                    hash: tx.hash,
                    message: tx.error_message || (tx.status === 'success' ? 'Confirmed' : 'Failed'),
                    type: 'auto' // DB doesn't distinguish yet, assume auto or generic
                }));
                setTransactions(mappedHistory);
            }
        } catch (error) {
            console.error('Failed to fetch transaction history:', error);
        }
    };

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

    const streamTransaction = async (payload: any, logPrefix: string = '') => {
        const res = await fetch('/api/transactions/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult = null;
        let errorMsg = null;

        if (!reader) throw new Error('Response body is null');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const msg = JSON.parse(line);
                    if (msg.type === 'log') {
                        addLog('info', `${logPrefix}${msg.message}`);
                    } else if (msg.type === 'result') {
                        finalResult = msg.data;
                    } else if (msg.type === 'error') {
                        errorMsg = msg.error;
                        // Detailed error handling if needed
                        if (msg.details) {
                             addLog('error', `${logPrefix}Details: ${msg.details}`);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing stream line:', line);
                }
            }
        }
        
        if (errorMsg) throw new Error(errorMsg);
        if (!finalResult && !res.ok) throw new Error('Transaction failed');
        
        return finalResult;
    };

    const handleSendTransaction = async () => {
        if (!sourceAccount || !destinationAccount || !amount || !selectedNode) {
            setTxStatus({ type: 'error', message: 'Please fill all fields' });
            addLog('warning', 'Transaction attempt failed: Missing fields');
            return;
        }

        const sourceAccName = accounts.find(a => a.id.toString() === sourceAccount)?.name || sourceAccount;
        
        setTxStatus({ type: 'loading', message: 'Submitting transaction...' });
        addLog('info', `Initiating transaction: ${amount} XLM from ${sourceAccName} to ${destinationAccount.substring(0, 8)}...`);

        const txId = Math.random().toString(36).substring(7);
        const newTx: TransactionRecord = {
            id: txId,
            timestamp: new Date(),
            source: sourceAccName,
            destination: destinationAccount,
            amount: amount,
            status: 'pending',
            node: selectedNode,
            type: 'manual'
        };

        try {
            // Use streaming helper instead of direct fetch
            const data = await streamTransaction({
                sourceId: sourceAccount,
                destinationAddress: destinationAccount,
                amount,
                nodeIp: selectedNode
            });

            addLog('success', `Transaction Confirmed! Hash: ${data.hash}`);
            addLog('info', `Result Code: ${data.result?.result_xdr ? 'tx_success' : 'unknown'}`, data.result);

            setTxStatus({ type: 'success', message: `Transaction successful! Hash: ${data.hash.substring(0, 15)}...` });
            
            addTransaction({
                ...newTx,
                status: 'success',
                hash: data.hash,
                message: 'Confirmed'
            });

            fetchAccounts(); 
        } catch (error: unknown) {
            const err = error as any;
            setTxStatus({ type: 'error', message: err.message || 'Unknown error' });
            addLog('error', `Transaction Failed: ${err.message || 'Unknown error'}`, err.details);
            
            addTransaction({
                ...newTx,
                status: 'error',
                message: err.message || 'Unknown error'
            });
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
            const source = accounts[Math.floor(Math.random() * accounts.length)];
            let dest = accounts[Math.floor(Math.random() * accounts.length)];
            
            while (dest.id === source.id) {
                dest = accounts[Math.floor(Math.random() * accounts.length)];
            }

            const currentAmount = (Math.random() * 10 + 1).toFixed(2);
            
            // Determine node (randomly from available)
            const node = horizonNodes.length > 0 
                ? horizonNodes[Math.floor(Math.random() * horizonNodes.length)].ip_address
                : selectedNode;

            const txId = Math.random().toString(36).substring(7);
            const newTx: TransactionRecord = {
                id: txId,
                timestamp: new Date(),
                source: source.name,
                destination: dest.name, // Using name for readability in auto-gen
                amount: currentAmount,
                status: 'pending',
                node: node,
                type: 'auto'
            };

            addLog('info', `[${i+1}/${genCount}] sending ${currentAmount} XLM from ${source.name} to ${dest.name}...`);

            try {
                const data = await streamTransaction({
                    sourceId: source.id,
                    destinationAddress: dest.public_key,
                    amount: currentAmount,
                    nodeIp: node
                }, `[${i+1}/${genCount}] `);

                success++;
                addLog('success', `[${i+1}/${genCount}] Success. Hash: ${data.hash?.substring(0,10)}...`);
                addTransaction({
                    ...newTx,
                    status: 'success',
                    hash: data.hash,
                    message: 'Success'
                });
            } catch (e: unknown) {
                fail++;
                const err = e as Error;
                addLog('error', `[${i+1}/${genCount}] Error: ${err.message || 'Unknown error'}`);
                addTransaction({
                    ...newTx,
                    status: 'error',
                    message: err.message
                });
            }

            setGenProgress({ current: i + 1, total: genCount, success, fail });
            await new Promise(r => setTimeout(r, 200));
        }

        addLog('info', `Traffic Generation Completed. Success: ${success}, Fail: ${fail}`);
        setIsGenerating(false);
    };

    // Filter Logic
    const filteredTransactions = transactions.filter(tx => {
        if (filterStatus !== 'all' && tx.status !== filterStatus) return false;
        if (filterType !== 'all' && tx.type !== filterType) return false;
        return true;
    });

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

            <div className="flex flex-col gap-6">
                
                {/* Control Tabs */}
                <div className="flex gap-4 border-b border-gray-700 pb-2">
                    <button 
                        onClick={() => setViewMode('generator')}
                        className={`flex items-center gap-2 pb-2 px-4 border-b-2 transition-colors ${viewMode === 'generator' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        <Activity size={18} />
                        Traffic Generator
                    </button>
                    <button 
                        onClick={() => setViewMode('manual')}
                        className={`flex items-center gap-2 pb-2 px-4 border-b-2 transition-colors ${viewMode === 'manual' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        <Send size={18} />
                        Manual Transfer
                    </button>
                </div>

                {/* View Content */}
                {viewMode === 'manual' ? (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
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
                ) : (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
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
                )}
            </div>

            {/* Transaction History & Detailed Logs */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[400px]">
                
                {/* Transaction History Table */}
                <div className="xl:col-span-2 bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Clock size={20} className="text-green-400" />
                            Transaction History
                        </h3>
                        <div className="flex gap-2">
                            <select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="bg-gray-900 text-white text-xs rounded border border-gray-600 p-1"
                            >
                                <option value="all">All Status</option>
                                <option value="success">Success</option>
                                <option value="error">Error</option>
                            </select>
                            <select 
                                value={filterType} 
                                onChange={(e) => setFilterType(e.target.value as any)}
                                className="bg-gray-900 text-white text-xs rounded border border-gray-600 p-1"
                            >
                                <option value="all">All Types</option>
                                <option value="manual">Manual</option>
                                <option value="auto">Auto</option>
                            </select>
                            <button onClick={() => setTransactions([])} className="p-1 hover:bg-gray-700 rounded text-gray-400">
                                <XCircle size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left text-sm text-gray-400">
                            <thead className="bg-gray-900/50 text-gray-200 sticky top-0">
                                <tr>
                                    <th className="p-3">Time</th>
                                    <th className="p-3">From - To</th>
                                    <th className="p-3">Amount</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Hash / Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                                            No transactions recorded in this session.
                                        </td>
                                    </tr>
                                )}
                                {filteredTransactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="p-3 font-mono text-xs">{tx.timestamp.toLocaleTimeString()}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1 text-xs text-white" title={tx.source}>
                                                    <span className="text-gray-500 text-[10px] w-8">From:</span>
                                                    {accounts.find(a => a.public_key === tx.source || a.name === tx.source)?.name || (tx.source.length > 20 ? tx.source.substring(0, 8) + '...' : tx.source)}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-white" title={tx.destination}>
                                                    <span className="text-gray-500 text-[10px] w-8">To:</span>
                                                    {accounts.find(a => a.public_key === tx.destination || a.name === tx.destination)?.name || (tx.destination.length > 20 ? tx.destination.substring(0, 8) + '...' : tx.destination)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-white font-mono">{tx.amount} XLM</td>
                                        <td className="p-3">
                                            {tx.status === 'success' ? (
                                                <span className="inline-flex items-center gap-1 text-green-400 text-xs bg-green-900/20 px-2 py-1 rounded-full">
                                                    <CheckCircle size={12} /> Success
                                                </span>
                                            ) : tx.status === 'error' ? (
                                                <span className="inline-flex items-center gap-1 text-red-400 text-xs bg-red-900/20 px-2 py-1 rounded-full">
                                                    <XCircle size={12} /> Error
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-yellow-400 text-xs bg-yellow-900/20 px-2 py-1 rounded-full">
                                                    <Activity size={12} className="animate-spin" /> Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono text-xs max-w-[200px] truncate" title={tx.hash || tx.message}>
                                            {tx.hash ? (
                                                <a href={`https://testnet.stellarchain.io/transaction/${tx.hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                                                    {tx.hash.substring(0, 12)}... <ExternalLink size={10} />
                                                </a>
                                            ) : (
                                                <span className="text-red-400">{tx.message}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detailed Log Console */}
                <div className="bg-gray-900 rounded-xl border border-gray-700 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Server size={14} className="text-green-400" />
                            Live Logs
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
                            <div key={log.id} className="flex flex-col gap-1 border-b border-gray-800/50 pb-2 last:border-0">
                                <div className="flex gap-2">
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
                                {log.details && (
                                    <div className="pl-20 text-gray-500 text-[10px] whitespace-pre-wrap">
                                        {JSON.stringify(log.details, null, 2)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}