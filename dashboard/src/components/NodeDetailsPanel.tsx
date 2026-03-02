import React from 'react';
import { X, Server, Shield, Edit2, Activity } from 'lucide-react';

interface NodeDetailsPanelProps {
  node: any;
  onClose: () => void;
  onEdit: (node: any) => void;
  onMonitor: (node: any) => void;
}

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({ node, onClose, onEdit, onMonitor }) => {
  if (!node) return null;

  const isOnline = node.status === 'online' || node.role === 'validator_sdf';
  const roleDisplay = node.role === 'validator_sdf' ? 'SDF Validator' : (node.role || 'Unassigned');

  return (
    <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden flex flex-col min-h-0 h-full animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800 shrink-0">
             <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <Server size={16} className="text-blue-500 dark:text-blue-400" />
                 Node Details
             </h2>
             <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                 <X size={16} />
             </button>
        </div>
        
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
            <div className="flex items-center gap-4 mb-6">
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOnline ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'}`}>
                      <Server size={24} />
                 </div>
                 <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{node.hostname}</h3>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-mono">#{node.id}</span>
                          <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded ${isOnline ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'}`}>
                               <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                               {isOnline ? 'Online' : 'Offline'}
                          </span>
                      </div>
                 </div>
            </div>

            <div className="space-y-4">
                 {/* Role Card */}
                 <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700/50">
                     <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                         <Shield size={14} />
                         Node Role
                     </div>
                     <p className="text-base font-medium text-gray-900 dark:text-white capitalize pl-6">{roleDisplay}</p>
                 </div>

                 {/* Network Details */}
                 <div className="grid grid-cols-1 gap-3">
                     <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/50">
                         <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">IP Address</span>
                         <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{node.ip_address}</span>
                     </div>
                     <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/50">
                         <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Public Key</span>
                         <span className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{node.public_key || 'Not Available'}</span>
                     </div>
                 </div>

                 {/* Actions */}
                 <div className="grid grid-cols-2 gap-3 pt-2">
                     <button 
                         onClick={() => onEdit(node)}
                         className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition-colors border border-gray-300 dark:border-gray-600"
                     >
                         <Edit2 size={16} />
                         Configure
                     </button>
                     {node.role && (
                         <button
                             onClick={() => onMonitor(node)}
                             className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-blue-100 dark:bg-blue-600/20 hover:bg-blue-200 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-sm font-medium transition-colors"
                         >
                             <Activity size={16} />
                             Monitor
                         </button>
                     )}
                 </div>
            </div>
        </div>
    </div>
  );
};

export default NodeDetailsPanel;