import React from 'react';
import { X, Server, Globe, Activity, Hash, Shield, Edit2 } from 'lucide-react';

interface NodeDetailsPanelProps {
  node: any;
  onClose: () => void;
  onEdit: (node: any) => void;
}

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({ node, onClose, onEdit }) => {
  if (!node) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40 transition-all duration-300 animate-in slide-in-from-bottom-10">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${node.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              <Server size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                {node.hostname}
                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 border border-gray-700 text-gray-400 font-mono">
                  #{node.id}
                </span>
              </h2>
              <div className="flex items-center gap-4 mt-1">
                <span className={`flex items-center gap-1.5 text-sm font-medium ${node.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></span>
                  {node.status === 'online' ? 'Online' : 'Offline'}
                </span>
                <span className="text-gray-600 text-sm">•</span>
                <span className="text-gray-400 text-sm font-mono">{node.ip_address}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => onEdit(node)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium transition-colors"
            >
                <Edit2 size={14} />
                Edit Configuration
            </button>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
            >
                <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Role Card */}
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
              <Shield size={14} />
              Node Role
            </div>
            <p className="text-lg font-medium text-white capitalize">{node.role || 'Unassigned'}</p>
            {node.role === 'validator' && (
              <p className="text-xs text-green-400 mt-1">Participating in consensus</p>
            )}
          </div>

          {/* Horizon Status */}
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
              <Globe size={14} />
              Horizon Status
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${node.role?.includes('watcher') ? 'bg-green-500' : 'bg-gray-600'}`}></div>
              <p className="text-lg font-medium text-white">
                {node.role?.includes('watcher') ? 'Active' : 'Disabled'}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {node.role?.includes('watcher') ? 'Ingesting ledger data' : 'Not running Horizon'}
            </p>
          </div>

          {/* Configuration */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded border border-gray-700/30">
              <span className="text-xs text-gray-400">Config Status</span>
              <span className="text-xs font-mono text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-900/30">Synced</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded border border-gray-700/30">
              <span className="text-xs text-gray-400">Protocol Version</span>
              <span className="text-xs font-mono text-gray-300">20</span>
            </div>
          </div>

          {/* Activity / Uptime */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded border border-gray-700/30">
              <span className="text-xs text-gray-400">Uptime</span>
              <span className="text-xs font-mono text-gray-300">99.9%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded border border-gray-700/30">
              <span className="text-xs text-gray-400">Latency</span>
              <span className="text-xs font-mono text-gray-300">45ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeDetailsPanel;
