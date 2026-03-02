'use client';

import React, { useState } from 'react';
import { Zap, X, Server } from 'lucide-react';

interface Node {
    id: number;
    hostname: string;
    ip_address: string;
    role: string | null;
    status: string;
}

interface TransactionInjectionProps {
    nodes: Node[];
}

const TransactionInjection: React.FC<TransactionInjectionProps> = ({ nodes }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [targetNodeIp, setTargetNodeIp] = useState<string>('');

  // Filter for available Horizon nodes (watchers or validators that have horizon enabled - assuming validators might not have it exposed but watchers do)
  // Based on docker-compose, watcher_horizon has 'horizon' service enabled.
  const horizonNodes = nodes.filter(n => n.role === 'watcher_horizon' && n.status === 'online');

  const handleInject = async () => {
    setLoading(true);
    setStatus('Injecting transactions...');
    try {
      const res = await fetch('/api/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'G...', // Placeholder
          destination: 'G...', // Placeholder
          amount: '100',
          batchSize: 100,
          horizonUrl: targetNodeIp ? `http://${targetNodeIp}:8000` : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.message);
      } else {
        setStatus('Failed to inject transactions');
      }
    } catch (err) {
      console.error(err);
      setStatus('Error connecting to server');
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  if (!isOpen) {
    return (
        <button 
            onClick={() => setIsOpen(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-red-900/20"
        >
            <Zap size={20} />
            <span>Launch Stress Test</span>
        </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white"
        >
            <X size={20} />
        </button>

        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Zap className="text-red-500" />
                Transaction Injection
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure and launch network stress tests.</p>
        </div>
        
        <div className="p-6 space-y-6">
            
            {/* Target Node Selection */}
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-500 uppercase mb-2 flex items-center gap-2">
                    <Server size={12} />
                    Target Horizon Node
                </label>
                <select 
                    value={targetNodeIp}
                    onChange={(e) => setTargetNodeIp(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-red-500 outline-none appearance-none"
                >
                    <option value="">Auto-detect / Default</option>
                    {horizonNodes.map(node => (
                        <option key={node.id} value={node.ip_address}>
                            {node.hostname} ({node.ip_address})
                        </option>
                    ))}
                </select>
                {horizonNodes.length === 0 && (
                    <p className="text-[10px] text-yellow-600 dark:text-yellow-500 mt-1">
                        No online Horizon watchers detected. Test may fail if no default is configured.
                    </p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-500 uppercase mb-2">Source Account</label>
                    <input type="text" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white font-mono text-sm focus:border-red-500 outline-none" placeholder="G..." disabled />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-500 uppercase mb-2">Destination Account</label>
                    <input type="text" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white font-mono text-sm focus:border-red-500 outline-none" placeholder="G..." disabled />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-500 uppercase mb-2">Batch Size (Tx)</label>
                <div className="flex items-center gap-4">
                    <input type="number" className="w-24 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white font-bold focus:border-red-500 outline-none" defaultValue={100} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Transactions per batch</span>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                    onClick={handleInject}
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                    {loading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            Running Test...
                        </>
                    ) : (
                        'Start Injection'
                    )}
                </button>
                {status && (
                    <div className={`mt-4 p-3 rounded text-center text-sm font-medium ${status.includes('Failed') || status.includes('Error') ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200'}`}>
                        {status}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionInjection;