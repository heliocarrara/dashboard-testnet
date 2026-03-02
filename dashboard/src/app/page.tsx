'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Activity, Database, Cpu, Settings, MoreVertical, Edit2, Trash2, Menu, FileCode, Copy, X } from 'lucide-react';
import NetworkGraph from '@/components/NetworkGraph';
import ProvisionModal from '@/components/ProvisionModal';
import TransactionInjection from '@/components/TransactionInjection';
import Navbar from '@/components/Navbar';
import EditNodeModal from '@/components/EditNodeModal';
import NodeDetailsPanel from '@/components/NodeDetailsPanel';
import AccountsPanel from '@/components/AccountsPanel';
import TransactionsPanel from '../components/TransactionsPanel';
import MonitoringModal from '@/components/MonitoringModal';

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
  peers?: number[];
}

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [monitoringNode, setMonitoringNode] = useState<Node | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewingDockerCompose, setViewingDockerCompose] = useState<Node | null>(null);
  const [composeTemplate, setComposeTemplate] = useState<{template: string, variables: Record<string, string>} | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'nodes' | 'settings' | 'accounts' | 'transactions'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    // Fetch template once on mount
    fetch('/api/setup-template')
        .then(res => res.json())
        .then(data => {
            if (data.template) {
                setComposeTemplate(data);
            }
        })
        .catch(err => console.error('Failed to load compose template', err));
  }, []);

  const generateDockerCompose = (node: Node) => {
    if (!composeTemplate) return 'Loading template...';

    const { template, variables } = composeTemplate;

    const services = node.role === 'validator' ? 'core' 
                   : node.role === 'watcher_horizon' ? 'core,horizon' 
                   : node.role === 'watcher_rpc' ? 'core,rpc' 
                   : 'core';
    
    const isValidator = node.role === 'validator';
    
    // Find peers (assuming node.peers contains IDs of connected peers)
    const peerNodes = node.peers 
        ? node.peers.map(peerId => nodes.find(n => n.id === peerId)).filter(Boolean)
        : [];
        
    const preferredPeers = peerNodes.map(p => `${p?.ip_address}:11625`).join(',');
    
    // Validators for Quorum Set (All validators in the network)
    const validators = nodes
        .filter(n => n.role === 'validator' && n.public_key)
        .map(n => `"${n.public_key}"`)
        .join(',');
        
    const quorumSet = `[{"threshold_percent": 66, "validators": ["$SELF", ${validators}]}]`;

    // Replace variables in template
    let content = template;

    // Replace Script Variables (from setup-node.sh definitions)
    const varsToExclude = ['QUORUM_SET', 'PREFERRED_PEERS', 'SECRET_SEED', 'IS_VALIDATOR', 'SERVICES_TO_ENABLE'];
    Object.entries(variables).forEach(([key, value]) => {
        if (varsToExclude.includes(key)) return;
        // Replace $VAR and ${VAR}
        const regex = new RegExp(`\\$${key}|\\$\{${key}\}`, 'g');
              content = content.replace(regex, () => value);
          });

    // Replace Runtime Variables (calculated here)
    const runtimeVars: Record<string, string> = {
        'NODE_SEED': node.node_seed,
        'PREFERRED_PEERS': preferredPeers,
        'QUORUM_SET': quorumSet,
        'IS_VALIDATOR': isValidator.toString(),
        'SERVICES_TO_ENABLE': services,
        // Hostname is used in container_name: stellar-node-${node.hostname} (likely not a var in script but useful)
    };
    
    // Replace the specific vars we care about
    Object.entries(runtimeVars).forEach(([key, value]) => {
         const regex = new RegExp(`\\$${key}|\\$\{${key}\}`, 'g');
         content = content.replace(regex, () => value);
    });

    return content;
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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden font-sans transition-colors duration-300">
      <Navbar 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="md:ml-64 ml-0 flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300">
        {/* Header */}
        <header className="px-8 py-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white/95 dark:bg-gray-900/95 backdrop-blur z-10 shrink-0 transition-colors">
          <div className="flex items-center gap-4">
             <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
             >
                <Menu size={24} />
             </button>
             <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                {activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'nodes' ? 'Node Management' : 'System Settings'}
             </h1>
             <p className="text-gray-500 dark:text-gray-400 text-xs">
                 {activeTab === 'dashboard' ? 'Real-time Network Monitoring' : activeTab === 'nodes' ? 'Cluster Configuration & Inventory' : 'Platform Preferences'}
             </p>
             </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase font-bold tracking-wider">Network Status</p>
                <div className="flex items-center justify-end gap-2">
                    <span className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{onlineCount} / {nodes.length} Online</p>
                </div>
             </div>
             <button
                onClick={fetchNodes}
                className="p-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700"
             >
                <RefreshCw size={18} />
             </button>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 p-6 overflow-hidden">
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-12 gap-6 h-full overflow-y-auto xl:overflow-hidden">
                    {/* Left Column: Graph (Larger) */}
                    <div className="col-span-12 xl:col-span-7 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-xl overflow-hidden relative min-h-[500px] transition-colors">
                        <div className="absolute top-4 left-4 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                            <Database size={14} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Topology Map</span>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                             <NetworkGraph 
                                nodes={nodes} 
                                selectedNodeId={selectedNodeId}
                                onNodeSelect={setSelectedNodeId}
                             />
                        </div>
                    </div>

                    {/* Right Column: Metrics & List */}
                    <div className="col-span-12 xl:col-span-5 flex flex-col gap-6 overflow-hidden">
                        
                        {/* Metrics Cards */}
                        <div className="grid grid-cols-2 gap-4 shrink-0">
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-lg relative overflow-hidden group transition-colors">
                                <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Activity size={40} className="text-gray-900 dark:text-white" />
                                </div>
                                <p className="text-gray-500 dark:text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Validators Ready</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{validatorCount}</p>
                                    <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">/ 5 Target</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 mt-3 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${Math.min((validatorCount / 5) * 100, 100)}%` }}></div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-lg flex flex-col justify-center transition-colors">
                                 <TransactionInjection nodes={nodes} />
                            </div>
                        </div>

                        {/* Nodes Table (Mini) or Details Panel */}
                        {selectedNodeId ? (
                             <NodeDetailsPanel 
                                node={nodes.find(n => n.id.toString() === selectedNodeId)} 
                                onClose={() => setSelectedNodeId(null)}
                                onEdit={setEditingNode}
                                onMonitor={setMonitoringNode}
                             />
                        ) : (
                        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-xl overflow-hidden flex flex-col min-h-0 animate-in fade-in duration-200 transition-colors">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800 shrink-0 transition-colors">
                                <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Cpu size={16} className="text-purple-600 dark:text-purple-400" />
                                    Active Nodes
                                </h2>
                                <button onClick={() => setActiveTab('nodes')} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">View All</button>
                            </div>
                            
                            <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-16">Num</th>
                                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Hostname</th>
                                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">IP</th>
                                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-24">Status</th>
                                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50 text-sm">
                                        {nodes.slice(0, 10).map((node) => (
                                            <tr key={node.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                                <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-500">{node.ordem || '-'}</td>
                                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-200">{node.hostname}</td>
                                                <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">{node.ip_address}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${node.status === 'online' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                                                        {node.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <button 
                                                        onClick={() => setEditingNode(node)}
                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
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
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'nodes' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-xl overflow-hidden flex flex-col h-full transition-colors">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800 shrink-0 transition-colors">
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Cpu size={16} className="text-purple-600 dark:text-purple-400" />
                            Cluster Nodes Inventory
                        </h2>
                        <span className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">{nodes.length} Total Nodes</span>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-16">ID</th>
                                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Node Details</th>
                                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-24">Role</th>
                                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-16 text-center">Ord</th>
                                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-32">Monitoring</th>
                                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-32">Docker Compose</th>
                                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50 text-sm">
                                {nodes.map((node) => (
                                    <tr key={node.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-500">#{node.id}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900 dark:text-gray-200">{node.hostname}</span>
                                                <span className="font-mono text-[10px] text-gray-500 dark:text-gray-500">{node.ip_address}</span>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' || node.role === 'validator_sdf' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">
                                                        {node.role === 'validator_sdf' ? 'online' : node.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {(() => {
                                                switch(node.role) {
                                                    case 'validator':
                                                        return (
                                                            <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20 uppercase tracking-wider shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                                                                Validator
                                                            </span>
                                                        );
                                                    case 'validator_sdf':
                                                        return (
                                                            <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 uppercase tracking-wider shadow-[0_0_10px_rgba(251,191,36,0.1)]">
                                                                SDF Validator
                                                            </span>
                                                        );
                                                    case 'watcher_horizon':
                                                        return (
                                                            <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20 uppercase tracking-wider shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                                                                Watcher (H)
                                                            </span>
                                                        );
                                                    case 'watcher_rpc':
                                                        return (
                                                            <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                                                Watcher (R)
                                                            </span>
                                                        );
                                                    default:
                                                        return (
                                                            <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 border-gray-200 dark:border-gray-700 uppercase tracking-wider">
                                                                Unassigned
                                                            </span>
                                                        );
                                                }
                                            })()}
                                        </td>
                                         <td className="px-4 py-3 text-center">
                                             <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{node.ordem || '-'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {node.role ? (
                                                <button
                                                    onClick={() => setMonitoringNode(node)}
                                                    className="bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                                                >
                                                    <Activity size={14} />
                                                    Monitor
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 dark:text-gray-600 text-xs italic">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setViewingDockerCompose(node)}
                                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-600 dark:text-blue-300 transition-colors flex items-center gap-2"
                                            >
                                                <FileCode size={14} />
                                                View Config
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => setEditingNode(node)}
                                                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1 ml-auto"
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
                        <h2 className="text-xl font-bold text-gray-400 dark:text-gray-400">Settings</h2>
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

        {monitoringNode && (
            <MonitoringModal
                node={monitoringNode}
                onClose={() => setMonitoringNode(null)}
            />
        )}

        {viewingDockerCompose && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] transition-colors">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FileCode size={20} className="text-blue-600 dark:text-blue-400" />
                            Docker Compose Configuration
                        </h3>
                        <button onClick={() => setViewingDockerCompose(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-0 overflow-auto custom-scrollbar flex-1 bg-gray-50 dark:bg-[#1e1e1e]">
                        <pre className="text-sm font-mono text-gray-800 dark:text-gray-300 p-4 leading-relaxed whitespace-pre-wrap break-all">
                            {generateDockerCompose(viewingDockerCompose)}
                        </pre>
                    </div>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 transition-colors">
                        <button 
                            onClick={() => setViewingDockerCompose(null)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                        >
                            Close
                        </button>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(generateDockerCompose(viewingDockerCompose));
                                alert('Copied to clipboard!');
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2"
                        >
                            <Copy size={16} />
                            Copy Configuration
                        </button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'accounts' && (
                  <AccountsPanel nodes={nodes} />
                )}

                {activeTab === 'transactions' && (
                  <TransactionsPanel nodes={nodes} />
                )}
      </main>
    </div>
  );
}
