'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Activity, Database, Cpu } from 'lucide-react';
import NetworkGraph from '@/components/NetworkGraph';
import ProvisionModal from '@/components/ProvisionModal';
import TransactionInjection from '@/components/TransactionInjection';

interface Node {
  id: number;
  hostname: string;
  ip_address: string;
  public_key: string;
  role: string | null;
  quorum_group: number | null;
  node_seed: string;
  created_at: string;
  status: string;
  config_status: string;
  last_seen: string;
}

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/nodes');
      const data = await res.json();
      setNodes(data);
    } catch (error) {
      console.error('Failed to fetch nodes', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async (node: Node) => {
    try {
      await fetch('/api/nodes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: node.id,
          role: node.role,
          quorum_group: node.quorum_group,
        }),
      });
      // Optionally show a toast
    } catch (error) {
      console.error('Failed to update node', error);
      alert('Failed to update node');
    }
  };

  const validatorCount = nodes.filter(n => n.role === 'validator').length;
  const onlineCount = nodes.filter(n => n.status === 'online').length;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
          <div>
             <h1 className="text-3xl font-bold text-blue-400 flex items-center gap-2">
                <Activity /> Stellar Testnet Manager
             </h1>
             <p className="text-gray-400 text-sm mt-1">Laboratory Cluster Dashboard</p>
          </div>
          <div className="flex gap-4">
             <div className="text-right">
                <p className="text-xs text-gray-400 uppercase">Network Status</p>
                <p className="text-lg font-bold text-green-400">{onlineCount} Online / {nodes.length} Total</p>
             </div>
             <button
                onClick={fetchNodes}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
             >
                <RefreshCw size={18} />
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Left: Graph */}
            <div className="lg:col-span-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Database size={20} /> Network Topology</h2>
                <NetworkGraph nodes={nodes.map(n => ({ ...n, id: n.id.toString() }))} />
            </div>

            {/* Right: Metrics & Actions */}
            <div className="space-y-8">
                <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Cpu size={20} /> Cluster Metrics</h2>
                    <div className="space-y-4">
                        <div className="bg-gray-700 p-4 rounded">
                            <p className="text-gray-400 text-xs uppercase">Validators Ready</p>
                            <p className="text-2xl font-bold">{validatorCount} <span className="text-gray-500 text-sm">/ 5 Required</span></p>
                            <div className="w-full bg-gray-600 h-2 mt-2 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full" style={{ width: `${Math.min((validatorCount / 5) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        {/* Placeholder for Storage */}
                         <div className="bg-gray-700 p-4 rounded">
                            <p className="text-gray-400 text-xs uppercase">Total Storage Used</p>
                            <p className="text-2xl font-bold">12.4 GB <span className="text-gray-500 text-sm">(Estimated)</span></p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6">
                     <h2 className="text-xl font-bold mb-4">Actions</h2>
                     <TransactionInjection />
                </div>
            </div>
        </div>

        {/* Bottom: Node List (Console) */}
        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-xl border border-gray-700">
          <div className="p-4 border-b border-gray-700">
             <h2 className="text-lg font-bold">Cluster Nodes</h2>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left">
              <thead className="bg-gray-700 text-gray-300 uppercase text-sm">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Hostname</th>
                  <th className="px-6 py-3">IP Address</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Quorum Group</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {nodes.map((node) => (
                  <tr key={node.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-gray-400">#{node.id}</td>
                    <td className="px-6 py-4 font-medium">{node.hostname}</td>
                    <td className="px-6 py-4 text-gray-400">{node.ip_address}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${node.status === 'online' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                            {node.status || 'offline'}
                        </span>
                    </td>
                     <td className="px-6 py-4">
                      <select
                        value={node.role || 'none'}
                        onChange={(e) => {
                             const updatedNodes = nodes.map(n => n.id === node.id ? { ...n, role: e.target.value } : n);
                             setNodes(updatedNodes);
                             handleUpdate({ ...node, role: e.target.value });
                        }}
                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                      >
                        <option value="none">None</option>
                        <option value="validator">Validator</option>
                        <option value="watcher_horizon">Watcher (Horizon)</option>
                        <option value="watcher_rpc">Watcher (RPC)</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                         <input
                            type="number"
                            value={node.quorum_group || 0}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                const updatedNodes = nodes.map(n => n.id === node.id ? { ...n, quorum_group: val } : n);
                                setNodes(updatedNodes);
                                handleUpdate({ ...node, quorum_group: val });
                            }}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm w-16 focus:border-blue-500 outline-none"
                        />
                    </td>
                    <td className="px-6 py-4 text-right">
                       {/* Actions */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ProvisionModal validatorCount={validatorCount} onSuccess={fetchNodes} />
      </div>
    </div>
  );
}
