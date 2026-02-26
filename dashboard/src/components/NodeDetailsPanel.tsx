import React from 'react';
import { X, Server, Shield, Edit2 } from 'lucide-react';

interface NodeDetailsPanelProps {
  node: any;
  onClose: () => void;
  onEdit: (node: any) => void;
}

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({ node, onClose, onEdit }) => {
  if (!node) return null;

  return (
    <div className="absolute bottom-4 left-4 w-[400px] bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-40 transition-all duration-300 animate-in slide-in-from-bottom-10 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${node.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              <Server size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {node.hostname}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 border border-gray-700 text-gray-400 font-mono">
                  #{node.id}
                </span>
                <span className={`flex items-center gap-1 text-[10px] font-medium ${node.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></span>
                  {node.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
                onClick={() => onEdit(node)}
                className="p-1.5 hover:bg-blue-900/30 rounded text-blue-400 hover:text-blue-300 transition-colors"
                title="Edit Configuration"
            >
                <Edit2 size={14} />
            </button>
            <button 
                onClick={onClose}
                className="p-1.5 hover:bg-gray-800 rounded text-gray-500 hover:text-white transition-colors"
            >
                <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Role Card */}
          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-2 mb-1 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
              <Shield size={12} />
              Node Role
            </div>
            <p className="text-sm font-medium text-white capitalize">{node.role || 'Unassigned'}</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2">
             <div className="p-2.5 bg-gray-800/30 rounded border border-gray-700/30">
                <span className="text-[10px] text-gray-400 block mb-1">IP Address</span>
                <span className="text-xs font-mono text-gray-300 break-all">{node.ip_address}</span>
             </div>
             <div className="p-2.5 bg-gray-800/30 rounded border border-gray-700/30">
                <span className="text-[10px] text-gray-400 block mb-1">Config Status</span>
                <span className="text-[10px] font-mono text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/30 inline-block">Synced</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeDetailsPanel;
