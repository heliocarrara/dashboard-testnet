'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Activity, Database, Cpu, Settings, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import NetworkGraph from '@/components/NetworkGraph';
import ProvisionModal from '@/components/ProvisionModal';
import TransactionInjection from '@/components/TransactionInjection';
import Navbar from '@/components/Navbar';
import EditNodeModal from '@/components/EditNodeModal';
import NodeDetailsPanel from '@/components/NodeDetailsPanel';

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
  ordem?: number | null;
}

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'nodes' | 'settings'>('dashboard');

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

  const handleUpdate = async (node: any) => {
    try {
      await fetch('/api/nodes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: node.id,
          role: node.role,
          quorum_group: node.quorum_group,
          hostname: node.hostname,
          ip_address: node.ip_address
        }),
      });
      fetchNodes(); // Refresh list
      setEditingNode(null); // Close modal
    } catch (error) {
      console.error('Failed to update node', error);
      alert('Failed to update node');
    }
  };

  const handleDelete = async (id: number) => {
    try {
        // Assuming API supports DELETE method, though not explicitly in original code
        // If not, this might need backend implementation. 
        // Based on user request "I'm not able to delete the node", I'll try to implement the call.
        const res = await fetch(`/api/nodes?id=${id}`, {
            method: 'DELETE',
        });
        if (res.ok) {
            fetchNodes();
            setEditingNode(null);
        } else {
            alert('Failed to delete node');
        }
    } catch (error) {
        console.error('Failed to delete node', error);
    }
  };

  const validatorCount = nodes.filter(n => n.role === 'validator').length;
  const onlineCount = nodes.filter(n => n.status === 'online').length;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden font-sans">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="ml-64 flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="px-8 py-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/95 backdrop-blur z-10 shrink-0">
          <div>
             <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                {activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'nodes' ? 'Node Management' : 'System Settings'}
             </h1>
             <p className="text-gray-500 text-xs">
                 {activeTab === 'dashboard' ? 'Real-time Network Monitoring' : activeTab === 'nodes' ? 'Cluster Configuration & Inventory' : 'Platform Preferences'}
             </p>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Network Status</p>
                <div className="flex items-center justify-end gap-2">
                    <span className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <p className="text-sm font-bold text-white">{onlineCount} / {nodes.length} Online</p>
                </div>
             </div>
             <button
                onClick={fetchNodes}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white border border-gray-700"
             >
                <RefreshCw size={18} />
             </button>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 p-6 overflow-hidden">
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-12 gap-6 h-full">
                    {/* Left Column: Graph (Larger) */}
                    <div className="col-span-12 xl:col-span-7 flex flex-col bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden relative">
                        <div className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur px-3 py-1 rounded-full border border-gray-700 flex items-center gap-2">
                            <Database size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-gray-300">Topology Map</span>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                             <NetworkGraph 
                                nodes={nodes.map(n => ({ ...n, id: n.id.toString() }))} 
                                selectedNodeId={selectedNodeId}
                                onNodeSelect={setSelectedNodeId}
                             />
                        </div>
                    </div>

                    {/* Right Column: Metrics & List */}
                    <div className="col-span-12 xl:col-span-5 flex flex-col gap-6 overflow-hidden">
                        
                        {/* Metrics Cards */}
                        <div className="grid grid-cols-2 gap-4 shrink-0">
                            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Activity size={40} />
                                </div>
                                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Validators Ready</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-white">{validatorCount}</p>
                                    <span className="text-xs text-gray-500 font-medium">/ 5 Target</span>
                                </div>
                                <div className="w-full bg-gray-700 h-1.5 mt-3 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${Math.min((validatorCount / 5) * 100, 100)}%` }}></div>
                                </div>
                            </div>

                            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg flex flex-col justify-center">
                                 <TransactionInjection />
                            </div>
                        </div>

                        {/* Nodes Table (Mini) */}
                        <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden flex flex-col min-h-0">
                            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 shrink-0">
                                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Cpu size={16} className="text-purple-400" />
                                    Active Nodes
                                </h2>
                                <button onClick={() => setActiveTab('nodes')} className="text-xs text-blue-400 hover:text-blue-300">View All</button>
                            </div>
                            
                            <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-bold sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-gray-700 w-16">ID</th>
                                            <th className="px-4 py-3 border-b border-gray-700">Hostname</th>
                                            <th className="px-4 py-3 border-b border-gray-700 w-24">Status</th>
                                            <th className="px-4 py-3 border-b border-gray-700 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50 text-sm">
                                        {nodes.slice(0, 10).map((node) => (
                                            <tr key={node.id} className="hover:bg-gray-700/30 transition-colors group">
                                                <td className="px-4 py-2 font-mono text-xs text-gray-500">#{node.id}</td>
                                                <td className="px-4 py-2 font-medium text-gray-200">{node.hostname}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${node.status === 'online' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                        {node.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <button 
                                                        onClick={() => setEditingNode(node)}
                                                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                                        title="Edit Node"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'nodes' && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 shrink-0">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <Cpu size={16} className="text-purple-400" />
                            Cluster Nodes Inventory
                        </h2>
                        <span className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded border border-gray-700">{nodes.length} Total Nodes</span>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-bold sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-4 py-3 border-b border-gray-700 w-16">ID</th>
                                    <th className="px-4 py-3 border-b border-gray-700">Node Details</th>
                                    <th className="px-4 py-3 border-b border-gray-700 w-24">Role</th>
                                    <th className="px-4 py-3 border-b border-gray-700 w-16 text-center">Ord</th>
                                    <th className="px-4 py-3 border-b border-gray-700 w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50 text-sm">
                                {nodes.map((node) => (
                                    <tr key={node.id} className="hover:bg-gray-700/30 transition-colors group">
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">#{node.id}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-200">{node.hostname}</span>
                                                <span className="font-mono text-[10px] text-gray-500">{node.ip_address}</span>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                    <span className="text-[10px] text-gray-400 uppercase">{node.status}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={node.role || 'none'}
                                                onChange={(e) => handleUpdate({ ...node, role: e.target.value })}
                                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-[10px] focus:border-blue-500 outline-none w-full max-w-[120px]"
                                            >
                                                <option value="none">None</option>
                                                <option value="validator">Validator</option>
                                                <option value="watcher_horizon">Watcher (H)</option>
                                                <option value="watcher_rpc">Watcher (R)</option>
                                            </select>
                                        </td>
                                         <td className="px-4 py-3 text-center">
                                             <span className="text-xs font-mono text-gray-400">{node.ordem || '-'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => setEditingNode(node)}
                                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-1 ml-auto"
                                            >
                                                <Edit2 size={12} />
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                        <Settings size={48} className="mx-auto mb-4 opacity-20" />
                        <h2 className="text-xl font-bold text-gray-400">Settings</h2>
                        <p className="text-sm">Global configuration options will appear here.</p>
                    </div>
                </div>
            )}
        </div>

        <ProvisionModal validatorCount={validatorCount} onSuccess={fetchNodes} />
        
        <EditNodeModal 
            node={editingNode} 
            isOpen={!!editingNode} 
            onClose={() => setEditingNode(null)} 
            onSave={handleUpdate}
            onDelete={handleDelete}
        />

        <NodeDetailsPanel 
            node={selectedNodeId ? nodes.find(n => n.id.toString() === selectedNodeId) : null}
            onClose={() => setSelectedNodeId(null)}
            onEdit={(node) => setEditingNode(node)}
        />
      </main>
    </div>
  );
}
