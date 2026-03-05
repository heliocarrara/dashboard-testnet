'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';

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

interface EditNodeModalProps {
  node: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (node: Node) => void;
  onDelete: (id: number) => void;
}

const EditNodeModal: React.FC<EditNodeModalProps> = ({ node, isOpen, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState<Node | null>(null);

  useEffect(() => {
    if (node) {
      setFormData({ ...node });
    }
  }, [node]);

  if (!isOpen || !formData) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
        // Convert quorum_group to number if it's a string from input
        const processedData = {
            ...formData,
            ordem: formData.ordem ? Number(formData.ordem) : null
        };
        onSave(processedData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white"
        >
            <X size={20} />
        </button>

        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Node Configuration</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ID: <span className="font-mono text-blue-500 dark:text-blue-400">#{formData.id}</span></p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Hostname</label>
                <input 
                    name="hostname"
                    value={formData.hostname}
                    onChange={handleChange}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white font-mono text-sm focus:border-blue-500 outline-none" 
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">IP Address</label>
                <input 
                    name="ip_address"
                    value={formData.ip_address}
                    onChange={handleChange}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white font-mono text-sm focus:border-blue-500 outline-none" 
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Role</label>
                    <select
                        name="role"
                        value={formData.role || 'none'}
                        onChange={handleChange}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none appearance-none"
                    >
                        <option value="none">None</option>
                        <option value="validator">Validator</option>
                        <option value="validator_sdf">SDF Validator</option>
                        <option value="watcher_horizon">Watcher (Horizon)</option>
                        <option value="watcher_rpc">Watcher (RPC)</option>
                    </select>
                </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Order</label>
                        <input 
                            type="number"
                            name="ordem"
                            value={formData.ordem || 0}
                            onChange={handleChange}
                            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white font-mono text-sm focus:border-blue-500 outline-none text-center" 
                        />
                    </div>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex gap-3">
                <button
                    type="button"
                    onClick={() => {
                        if (confirm('Are you sure you want to delete this node?')) {
                            onDelete(formData.id);
                        }
                    }}
                    className="flex-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={18} />
                    Delete
                </button>
                <button
                    type="submit"
                    className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <Save size={18} />
                    Save Changes
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default EditNodeModal;
