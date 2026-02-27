'use client';

import React from 'react';
import { Activity, LayoutGrid, Server, Settings, X, Wallet } from 'lucide-react';

interface NavbarProps {
    activeTab: 'dashboard' | 'nodes' | 'settings' | 'accounts';
    onTabChange: (tab: 'dashboard' | 'nodes' | 'settings' | 'accounts') => void;
    isOpen?: boolean;
    onClose?: () => void;
}

export default function Navbar({ activeTab, onTabChange, isOpen = false, onClose }: NavbarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <nav className={`
        fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col z-50
        transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-10 px-2">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-500 w-8 h-8" />
            <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Stellar Lab</h1>
                <p className="text-xs text-gray-500">Testnet Manager</p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={onClose}
            className="md:hidden p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>

      <div className="space-y-2 flex-1">
        <button 
            onClick={() => onTabChange('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-gray-800 text-white border border-gray-700' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
        >
            <LayoutGrid size={20} className={activeTab === 'dashboard' ? "text-blue-400" : ""} />
            <span className="font-medium">Dashboard</span>
        </button>
        <button 
            onClick={() => onTabChange('nodes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'nodes' ? 'bg-gray-800 text-white border border-gray-700' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
        >
            <Server size={20} className={activeTab === 'nodes' ? "text-purple-400" : ""} />
            <span className="font-medium">Nodes</span>
        </button>
        <button 
            onClick={() => onTabChange('accounts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'accounts' ? 'bg-gray-800 text-white border border-gray-700' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
        >
            <Wallet size={20} className={activeTab === 'accounts' ? "text-green-400" : ""} />
            <span className="font-medium">Accounts</span>
        </button>
        <button 
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-gray-800 text-white border border-gray-700' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
        >
            <Settings size={20} className={activeTab === 'settings' ? "text-gray-400" : ""} />
            <span className="font-medium">Settings</span>
        </button>
      </div>

      <div className="mt-auto pt-6 border-t border-gray-800">
          <div className="px-2">
              <p className="text-xs text-gray-500 uppercase font-bold mb-2">System Status</p>
              <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-sm text-gray-300">Operational</span>
              </div>
          </div>
      </div>
    </nav>
    </>
  );
}
