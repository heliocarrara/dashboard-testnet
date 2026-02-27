'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wallet, RefreshCw, Copy, ExternalLink, Coins, Search, X, Server, Globe, AlertTriangle } from 'lucide-react';

interface Account {
    id: number;
    name: string;
    public_key: string;
    secret_key: string;
    created_at: string;
    balance?: string; // Fetched from Horizon
}

interface AccountsPanelProps {
    nodes?: any[];
}

export default function AccountsPanel({ nodes = [] }: AccountsPanelProps) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [funding, setFunding] = useState<number | null>(null);

    // Batch Account State
    const [batchCount, setBatchCount] = useState<number>(5);
    const [isCreatingBatch, setIsCreatingBatch] = useState(false);
    const [isFundingBatch, setIsFundingBatch] = useState(false);
    const [batchStatus, setBatchStatus] = useState<string>('');

    // Inspect Modal State
    const [inspectModalOpen, setInspectModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [manualPublicKey, setManualPublicKey] = useState<string>('');
    const [inspectSource, setInspectSource] = useState<'public' | 'node'>('public');
    const [selectedNodeIp, setSelectedNodeIp] = useState<string>('');
    const [inspectResult, setInspectResult] = useState<any>(null);
    const [inspectLoading, setInspectLoading] = useState(false);
    const [isCustomIp, setIsCustomIp] = useState(false);

    // Filter nodes that likely have Horizon (watchers or SDF validators)
    // Adjust logic based on your network setup. Usually only watchers run Horizon.
    const horizonNodes = nodes.filter(n => 
        n.role === 'watcher_horizon' || n.role === 'validator_sdf'
    );

    useEffect(() => {
        fetchAccounts();
    }, []);

    // Set default node when modal opens
    useEffect(() => {
        if (inspectModalOpen && horizonNodes.length > 0 && !selectedNodeIp) {
            setSelectedNodeIp(horizonNodes[0].ip_address);
        }
    }, [inspectModalOpen, horizonNodes, selectedNodeIp]);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/accounts');
            const data = await res.json();
            
            // Fetch balances for each account (Default to Public Horizon for list view)
            const enrichedAccounts = await Promise.all(data.map(async (acc: Account) => {
                try {
                    const horizonRes = await fetch(`https://horizon-testnet.stellar.org/accounts/${acc.public_key}`);
                    if (horizonRes.ok) {
                        const horizonData = await horizonRes.json();
                        const nativeBalance = horizonData.balances.find((b: any) => b.asset_type === 'native')?.balance;
                        return { ...acc, balance: nativeBalance || '0' };
                    }
                    return { ...acc, balance: 'Not Created' };
                } catch (e) {
                    return { ...acc, balance: 'Error' };
                }
            }));

            setAccounts(enrichedAccounts);
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAccount = async () => {
        setCreating(true);
        try {
            const name = prompt('Enter account name (optional):') || 'New Account';
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            
            if (res.ok) {
                await fetchAccounts();
            } else {
                alert('Failed to create account');
            }
        } catch (error) {
            console.error('Error creating account:', error);
        } finally {
            setCreating(false);
        }
    };

    const handleFundAccount = async (account: Account) => {
        setFunding(account.id);
        try {
            const res = await fetch('/api/accounts/fund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicKey: account.public_key })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`Account funded successfully! Transaction Hash: ${data.data.hash}`);
                await fetchAccounts();
            } else {
                alert(`Funding failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Error funding account:', error);
            alert('Error funding account');
        } finally {
            setFunding(null);
        }
    };

    const handleCreateBatch = async () => {
        if (batchCount < 1 || batchCount > 50) {
            setBatchStatus('Please enter a count between 1 and 50');
            return;
        }

        setIsCreatingBatch(true);
        setBatchStatus('Creating accounts...');
        
        try {
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: batchCount })
            });

            const data = await res.json();
            
            if (res.ok) {
                setBatchStatus(`Success! Created ${data.count} accounts.`);
                fetchAccounts();
            } else {
                setBatchStatus(`Error: ${data.error}`);
            }
        } catch (error: any) {
            setBatchStatus(`Error: ${error.message}`);
        } finally {
            setIsCreatingBatch(false);
            // Clear status after 3 seconds
            setTimeout(() => setBatchStatus(''), 3000);
        }
    };

    const handleBatchFund = async () => {
        setIsFundingBatch(true);
        setBatchStatus('Funding all unfunded accounts... This may take a while.');

        try {
            const res = await fetch('/api/accounts/fund/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();
            
            if (res.ok) {
                setBatchStatus(data.message);
                fetchAccounts();
            } else {
                setBatchStatus(`Error: ${data.error}`);
            }
        } catch (error: any) {
            setBatchStatus(`Error: ${error.message}`);
        } finally {
            setIsFundingBatch(false);
        }
    };

    const handleDeleteAccount = async (id: number) => {
        if (!confirm('Are you sure you want to delete this account?')) return;
        
        try {
            await fetch(`/api/accounts?id=${id}`, { method: 'DELETE' });
            setAccounts(accounts.filter(a => a.id !== id));
        } catch (error) {
            console.error('Error deleting account:', error);
        }
    };

    const openInspectModal = (account: Account | null = null) => {
        setSelectedAccount(account);
        setInspectResult(null);
        setInspectSource('public');
        setInspectModalOpen(true);
    };

    const handleInspect = async () => {
        const targetPublicKey = selectedAccount?.public_key || manualPublicKey;

        if (!targetPublicKey) {
            alert('Please select an account or enter a public key');
            return;
        }
        
        setInspectLoading(true);
        setInspectResult(null);

        try {
            let url = `/api/accounts/query?publicKey=${targetPublicKey}`;
            
            if (inspectSource === 'node') {
                if (!selectedNodeIp) {
                    alert('Please select a node');
                    setInspectLoading(false);
                    return;
                }
                url += `&ip=${selectedNodeIp}`;
            } else {
                url += `&ip=public`;
            }

            const res = await fetch(url);
            const data = await res.json();
            setInspectResult(data);
        } catch (error) {
            console.error('Inspect error:', error);
            setInspectResult({ error: 'Failed to inspect account' });
        } finally {
            setInspectLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Wallet className="text-blue-400" />
                        Account Manager
                    </h2>
                    <p className="text-gray-400 text-sm">Manage testnet accounts and funding.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => openInspectModal(null)} 
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors border border-gray-700"
                        title="Inspect Any Account"
                    >
                        <Search size={20} />
                    </button>
                    <button 
                        onClick={fetchAccounts} 
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors border border-gray-700"
                        title="Refresh Accounts"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button 
                        onClick={handleCreateAccount} 
                        disabled={creating}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Plus size={18} />
                        {creating ? 'Creating...' : 'Create Account'}
                    </button>
                </div>
            </div>

            {/* Batch Operations */}
            <div className="mb-6 bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Server size={14} className="text-purple-400" />
                    Batch Operations
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Create Batch */}
                    <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                        <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Create Accounts</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                min="1" 
                                max="50"
                                value={batchCount}
                                onChange={(e) => setBatchCount(parseInt(e.target.value) || 0)}
                                className="w-20 bg-gray-800 text-white text-sm rounded border border-gray-600 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <button 
                                onClick={handleCreateBatch}
                                disabled={isCreatingBatch}
                                className="flex-1 bg-blue-900/50 hover:bg-blue-900 border border-blue-800 text-blue-400 text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
                            >
                                {isCreatingBatch ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                                Create
                            </button>
                        </div>
                    </div>

                    {/* Fund Batch */}
                    <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                        <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Fund Unfunded</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleBatchFund}
                                disabled={isFundingBatch}
                                className="w-full bg-green-900/50 hover:bg-green-900 border border-green-800 text-green-400 text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
                            >
                                {isFundingBatch ? <RefreshCw className="animate-spin" size={14} /> : <Coins size={14} />}
                                Fund All
                            </button>
                        </div>
                    </div>
                </div>

                {batchStatus && (
                    <div className="text-xs text-gray-400 text-center mt-2 p-2 bg-gray-900 rounded">
                        {batchStatus}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto bg-gray-800 rounded-xl border border-gray-700 shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-bold sticky top-0 backdrop-blur-md z-10">
                        <tr>
                            <th className="px-6 py-4 border-b border-gray-700">Name</th>
                            <th className="px-6 py-4 border-b border-gray-700">Public Key</th>
                            <th className="px-6 py-4 border-b border-gray-700 text-right">Balance (XLM)</th>
                            <th className="px-6 py-4 border-b border-gray-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {loading && accounts.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    Loading accounts...
                                </td>
                            </tr>
                        ) : accounts.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    No accounts found. Create one to get started.
                                </td>
                            </tr>
                        ) : (
                            accounts.map((account) => (
                                <tr key={account.id} className="hover:bg-gray-700/30 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-white">
                                        {account.name}
                                        <div className="text-[10px] text-gray-500 font-mono mt-1">
                                            Created: {new Date(account.created_at).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 group/key">
                                            <span className="font-mono text-xs text-gray-400 truncate max-w-[200px]" title={account.public_key}>
                                                {account.public_key}
                                            </span>
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(account.public_key)}
                                                className="text-gray-600 hover:text-blue-400 opacity-0 group-hover/key:opacity-100 transition-opacity"
                                                title="Copy Public Key"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <a 
                                                href={`https://stellar.expert/explorer/testnet/account/${account.public_key}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-gray-600 hover:text-blue-400 opacity-0 group-hover/key:opacity-100 transition-opacity"
                                                title="View on Stellar.Expert"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                            <a 
                                                href={`https://testnet.stellarchain.io/address/${account.public_key}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-gray-600 hover:text-purple-400 opacity-0 group-hover/key:opacity-100 transition-opacity"
                                                title="View on StellarChain.io"
                                            >
                                                <Globe size={14} />
                                            </a>
                                        </div>
                                        <div className="text-[10px] text-gray-600 font-mono mt-1 truncate max-w-[200px]" title="Secret Key (Click to copy)">
                                            <button onClick={() => {
                                                navigator.clipboard.writeText(account.secret_key);
                                                alert('Secret Key copied to clipboard!');
                                            }} className="hover:text-red-400 transition-colors">
                                                {account.secret_key.substring(0, 10)}... (Show Secret)
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-mono font-bold ${account.balance === 'Not Created' ? 'text-red-400' : 'text-green-400'}`}>
                                            {account.balance}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => openInspectModal(account)}
                                                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                                                title="Inspect Account (Node/Explorer)"
                                            >
                                                <Search size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleFundAccount(account)}
                                                disabled={funding === account.id}
                                                className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded-lg transition-colors disabled:opacity-50"
                                                title="Fund with Friendbot (10,000 XLM)"
                                            >
                                                <Coins size={16} className={funding === account.id ? "animate-pulse" : ""} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteAccount(account.id)}
                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg transition-colors"
                                                title="Delete Account"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Inspect Modal */}
            {inspectModalOpen && selectedAccount && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 shrink-0 rounded-t-xl">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Search size={20} className="text-blue-400" />
                                Inspect Account
                            </h3>
                            <button onClick={() => setInspectModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="mb-6">
                                <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Account</label>
                                {selectedAccount ? (
                                    <>
                                        <div className="text-white font-medium text-lg">{selectedAccount.name}</div>
                                        <div className="text-gray-400 font-mono text-xs break-all bg-gray-900/50 p-2 rounded border border-gray-700 mt-1">
                                            {selectedAccount.public_key}
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-2">
                                        <select 
                                            onChange={(e) => {
                                                const acc = accounts.find(a => a.public_key === e.target.value);
                                                if (acc) {
                                                    setSelectedAccount(acc);
                                                    setManualPublicKey('');
                                                } else {
                                                    setSelectedAccount(null);
                                                }
                                            }}
                                            className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-3 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">Select a known account...</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.public_key}>
                                                    {acc.name} ({acc.public_key.substring(0, 8)}...)
                                                </option>
                                            ))}
                                        </select>
                                        <div className="text-center text-xs text-gray-500 font-bold uppercase">- OR -</div>
                                        <input 
                                            type="text" 
                                            placeholder="Enter Public Key manually (G...)"
                                            value={manualPublicKey}
                                            onChange={(e) => {
                                                setManualPublicKey(e.target.value);
                                                setSelectedAccount(null);
                                            }}
                                            className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-3 focus:ring-blue-500 focus:border-blue-500 font-mono"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* External Links */}
                            {(selectedAccount || manualPublicKey.length >= 50) && (
                                <div className="flex gap-3 mb-6">
                                    <a 
                                        href={`https://testnet.stellarchain.io/address/${selectedAccount?.public_key || manualPublicKey}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 p-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-bold text-sm"
                                    >
                                        <Globe size={16} />
                                        View on StellarChain.io
                                    </a>
                                    <a 
                                        href={`https://stellar.expert/explorer/testnet/account/${selectedAccount?.public_key || manualPublicKey}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 p-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-bold text-sm"
                                    >
                                        <ExternalLink size={16} />
                                        View on Stellar.Expert
                                    </a>
                                </div>
                            )}

                            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 mb-6">
                                <label className="text-xs text-gray-500 uppercase font-bold mb-3 block">Data Source</label>
                                <div className="flex flex-col gap-3">
                                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${inspectSource === 'public' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-800/80'}`}>
                                        <input 
                                            type="radio" 
                                            name="source" 
                                            value="public" 
                                            checked={inspectSource === 'public'} 
                                            onChange={() => setInspectSource('public')}
                                            className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                                <Globe size={16} className="text-green-400" />
                                                Public API (Stellar.org)
                                            </div>
                                            <div className="text-xs text-gray-400">Query official Testnet Horizon</div>
                                        </div>
                                    </label>

                                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${inspectSource === 'node' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-800/80'}`}>
                                        <input 
                                            type="radio" 
                                            name="source" 
                                            value="node" 
                                            checked={inspectSource === 'node'} 
                                            onChange={() => setInspectSource('node')}
                                            className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                                <Server size={16} className="text-purple-400" />
                                                Specific Node
                                            </div>
                                            <div className="text-xs text-gray-400">Query a specific node's Horizon instance</div>
                                        </div>
                                    </label>

                                    {inspectSource === 'node' && (
                                        <div className="ml-7 mt-1 space-y-2">
                                            {!isCustomIp ? (
                                                <select 
                                                    value={selectedNodeIp}
                                                    onChange={(e) => setSelectedNodeIp(e.target.value)}
                                                    className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    <option value="" disabled>Select a node...</option>
                                                    {horizonNodes.map(node => (
                                                        <option key={node.id} value={node.ip_address}>
                                                            {node.hostname} ({node.ip_address})
                                                        </option>
                                                    ))}
                                                    {horizonNodes.length === 0 && (
                                                        <option disabled>No Horizon nodes available</option>
                                                    )}
                                                </select>
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    value={selectedNodeIp}
                                                    placeholder="Enter IP (e.g. 127.0.0.1) or Hostname"
                                                    className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-700 p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                                    onChange={(e) => setSelectedNodeIp(e.target.value)}
                                                />
                                            )}
                                            
                                            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isCustomIp}
                                                    onChange={(e) => {
                                                        setIsCustomIp(e.target.checked);
                                                        if (e.target.checked) {
                                                            setSelectedNodeIp(''); // Clear when switching to custom
                                                        } else if (horizonNodes.length > 0) {
                                                            setSelectedNodeIp(horizonNodes[0].ip_address); // Reset to first node
                                                        }
                                                    }}
                                                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/50"
                                                />
                                                Use Custom IP / Localhost
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button 
                                onClick={handleInspect}
                                disabled={inspectLoading || (inspectSource === 'node' && !selectedNodeIp)}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {inspectLoading ? <RefreshCw size={20} className="animate-spin" /> : <Search size={20} />}
                                {inspectLoading ? 'Fetching Data...' : 'Search Account Details'}
                            </button>

                            {inspectResult && (
                                <div className="mt-6 bg-black/30 rounded-lg border border-gray-700 overflow-hidden">
                                    <div className="px-4 py-2 bg-gray-900 border-b border-gray-700 text-xs font-bold text-gray-400 uppercase flex justify-between items-center">
                                        <span>Response Data</span>
                                        {inspectResult.error ? (
                                            <span className="text-red-400 flex items-center gap-1"><XCircleIcon size={12}/> Error</span>
                                        ) : (
                                            <span className="text-green-400 flex items-center gap-1"><CheckCircleIcon size={12}/> Success</span>
                                        )}
                                    </div>
                                    
                                    {inspectResult.error === 'Connection Timeout' && (
                                        <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-200 text-xs flex items-start gap-2">
                                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                            <div>
                                                <strong>Timeout Warning:</strong> The node is not responding.
                                                <ul className="list-disc ml-4 mt-1 space-y-0.5 text-yellow-200/80">
                                                    <li>Ensure the node is running and online.</li>
                                                    <li>Check if port 8000 is open in the firewall (AWS Security Groups / Local Firewall).</li>
                                                    <li>If running locally, try using the local IP instead of the public IP.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto custom-scrollbar max-h-[300px]">
                                        {JSON.stringify(inspectResult, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Simple icons for status
const XCircleIcon = ({size}: {size: number}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
);

const CheckCircleIcon = ({size}: {size: number}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
