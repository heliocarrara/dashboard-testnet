import React, { useState, useEffect, useRef } from 'react';
import { Activity, X, Server, Database, CheckCircle, XCircle, Clock, Copy, Check, Play, Pause, HelpCircle } from 'lucide-react';

interface MonitoringModalProps {
  node: any; // Using any for simplicity as Node type is in page.tsx
  onClose: () => void;
}

const Tooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-1">
        <HelpCircle size={12} className="text-gray-500 hover:text-gray-300 cursor-help" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-xs text-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
        </div>
    </div>
);

const MonitoringModal: React.FC<MonitoringModalProps> = ({ node, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [metricsResult, setMetricsResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const isMonitoringRef = useRef(isMonitoring);
  const metricsLoadingRef = useRef(metricsLoading);

  // Update refs when state changes
  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  useEffect(() => {
    metricsLoadingRef.current = metricsLoading;
  }, [metricsLoading]);

  // Clean up interval when component unmounts
  useEffect(() => {
    return () => {
      setIsMonitoring(false);
    };
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
  };

  const copyLogs = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    setLogs([]); // Clear logs for manual test
    
    try {
      addLog(`Starting connection test for node: ${node.hostname}`);
      addLog(`Target IP: ${node.ip_address}`);
      addLog('Initiating request to internal proxy API...');
      
      const res = await fetch(`/api/monitoring/horizon?ip=${node.ip_address}`);
      
      addLog(`Response received. Status: ${res.status} ${res.statusText}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      addLog('Parsing JSON response...');
      const data = await res.json();
      
      addLog(`Data parsed successfully. Node Status: ${data.status}`);
      if (data.status === 'online') {
        addLog(`Latest Ledger (Core): ${data.core_latest_ledger}`);
        addLog(`Latest Ledger (History): ${data.history_latest_ledger}`);
      } else {
        addLog(`Error reported by node: ${data.status} - ${data.error || 'Unknown error'}`);
      }
      
      setResult(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch monitoring data';
      addLog(`TEST FAILED: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
      addLog('Test sequence completed.');
    }
  };

  const fetchMetrics = async () => {
    // Avoid multiple overlapping requests
    if (metricsLoadingRef.current) return;
    
    setMetricsLoading(true);
    setError(null);

    try {
      addLog(`Fetching metrics for node: ${node.hostname}...`);

      const res = await fetch(`/api/monitoring/horizon/metrics?ip=${node.ip_address}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data.status === 'online') {
        addLog(`Metrics: Latency ${data.latency_ms}ms, Ledger #${data.latest_ledger?.sequence}`);
      } else {
        addLog(`Error fetching metrics: ${data.error}`);
      }

      setMetricsResult(data);

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch metrics';
      addLog(`METRICS FAILED: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Effect to handle the monitoring loop
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isMonitoring) {
      addLog("Starting continuous monitoring loop (every 5s)...");
      // Execute immediately
      fetchMetrics();
      
      // Then set interval
      intervalId = setInterval(() => {
        if (isMonitoringRef.current) {
          fetchMetrics();
        }
      }, 5000);
    } else {
      // If we just stopped, log it
      if (intervalId!) { 
         // This check is a bit tricky inside useEffect, but logic holds: 
         // if we were monitoring and now we are not, the cleanup function runs or this block runs on next render
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isMonitoring]);

  const toggleMonitoring = () => {
    if (isMonitoring) {
      setIsMonitoring(false);
      addLog("Monitoring stopped by user.");
    } else {
      // Start monitoring
      // We clear previous results to have a clean slate if desired, or keep them.
      // User said "monitorar log", so let's keep previous logs but maybe clear result state if needed.
      // Actually, keeping old result until new one arrives is better UI.
      setMetricsResult(null); 
      setLogs([]); // Clear logs to start fresh session
      setIsMonitoring(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
            <X size={20} />
        </button>

        <div className="p-6 border-b border-gray-800 bg-gray-800/50">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="text-blue-500" />
                Node Monitor
            </h3>
            <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded border border-gray-700">
                    {node.hostname}
                </span>
                <span className="text-xs text-gray-500">
                    {node.ip_address}:8000
                </span>
            </div>
        </div>
        
        <div className="p-6 space-y-6">
            <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Target Node</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="block text-[10px] text-gray-500 uppercase">Role</span>
                        <span className="text-sm font-medium text-white capitalize">{node.role}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-gray-500 uppercase">Status (DB)</span>
                        <span className={`text-sm font-medium ${node.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                            {node.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={handleTest}
                    disabled={loading || metricsLoading}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            Testing...
                        </>
                    ) : (
                        <>
                            <Activity size={18} />
                            Test Horizon API
                        </>
                    )}
                </button>

                <button
                    onClick={toggleMonitoring}
                    className={`
                        font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2
                        ${isMonitoring 
                            ? 'bg-red-600 hover:bg-red-500 text-white' 
                            : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }
                    `}
                >
                    {isMonitoring ? (
                        <>
                            <Pause size={18} />
                            Stop Monitoring
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            Start Monitoring
                        </>
                    )}
                </button>
            </div>

            {/* Logs Area */}
            {logs.length > 0 && (
                <div className="relative">
                    <div className="bg-black/50 p-3 rounded-lg border border-gray-800 font-mono text-[10px] text-gray-400 h-32 overflow-y-auto">
                        {logs.map((log, index) => (
                            <div key={index} className="mb-1 border-b border-gray-800/50 pb-0.5 last:border-0">
                                {log}
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={copyLogs}
                        className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors border border-gray-700"
                        title="Copy logs"
                    >
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                </div>
            )}

            {/* Metrics Results Area */}
            {metricsResult && (
                <div className="animate-in slide-in-from-bottom-2 duration-300">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Metrics Results</h4>
                    
                    <div className={`p-4 rounded-lg border ${metricsResult.status === 'online' ? 'bg-purple-900/20 border-purple-800' : 'bg-red-900/20 border-red-800'}`}>
                        {metricsResult.status === 'online' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-800/50 rounded-lg">
                                    <div className="flex items-center mb-1">
                                        <span className="text-[10px] uppercase text-gray-400 font-bold">Latency</span>
                                        <Tooltip text="Time taken for the node to respond to a request" />
                                    </div>
                                    <span className="text-2xl font-mono font-bold text-white">{metricsResult.latency_ms}<span className="text-sm text-gray-500 ml-1">ms</span></span>
                                </div>
                                <div className="p-3 bg-gray-800/50 rounded-lg">
                                    <div className="flex items-center mb-1">
                                        <span className="text-[10px] uppercase text-gray-400 font-bold">Avg Close Time</span>
                                        <Tooltip text="Average time between the last 6 ledgers" />
                                    </div>
                                    <span className="text-2xl font-mono font-bold text-white">{metricsResult.avg_ledger_close_time_s}<span className="text-sm text-gray-500 ml-1">s</span></span>
                                </div>
                                
                                {metricsResult.latest_ledger && (
                                    <div className="col-span-2 p-3 bg-gray-800/50 rounded-lg">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center">
                                                <span className="text-[10px] uppercase text-gray-400 font-bold">Latest Ledger Details</span>
                                                <Tooltip text="Information about the most recent ledger processed by the node" />
                                            </div>
                                            <span className="text-xs font-mono text-purple-400">#{metricsResult.latest_ledger.sequence}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <span className="block text-lg font-bold text-white">{metricsResult.latest_ledger.tx_count}</span>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-[10px] text-gray-500 uppercase">TXs</span>
                                                    <Tooltip text="Total transactions in this ledger" />
                                                </div>
                                            </div>
                                            <div>
                                                <span className="block text-lg font-bold text-green-400">{metricsResult.latest_ledger.successful_tx_count}</span>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-[10px] text-gray-500 uppercase">Success</span>
                                                    <Tooltip text="Transactions executed successfully" />
                                                </div>
                                            </div>
                                            <div>
                                                <span className="block text-lg font-bold text-red-400">{metricsResult.latest_ledger.failed_tx_count}</span>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-[10px] text-gray-500 uppercase">Failed</span>
                                                    <Tooltip text="Transactions that failed during execution" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <XCircle className="text-red-500" size={24} />
                                <div>
                                    <h5 className="font-bold text-red-400">Metrics Unavailable</h5>
                                    <p className="text-xs text-red-300 mt-1">{metricsResult.error}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Connection Test Results Area */}
            {result && (
                <div className="animate-in slide-in-from-bottom-2 duration-300">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Test Results</h4>
                    
                    <div className={`p-4 rounded-lg border ${result.status === 'online' ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            {result.status === 'online' ? (
                                <CheckCircle className="text-green-500" size={24} />
                            ) : (
                                <XCircle className="text-red-500" size={24} />
                            )}
                            <div>
                                <h5 className={`font-bold ${result.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                                    {result.status === 'online' ? 'Online & Syncing' : 'Offline / Unreachable'}
                                </h5>
                                {result.error && (
                                    <p className="text-xs text-red-300 mt-1">{result.error}</p>
                                )}
                            </div>
                        </div>

                        {result.status === 'online' && (
                            <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-green-800/30 pt-4">
                                <div>
                                    <div className="flex items-center gap-1.5 text-green-300/70 mb-1">
                                        <Database size={12} />
                                        <span className="text-[10px] uppercase font-bold">Core Ledger</span>
                                        <Tooltip text="Latest ledger ingested by Stellar Core" />
                                    </div>
                                    <span className="text-lg font-mono font-bold text-white">
                                        {result.core_latest_ledger}
                                    </span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5 text-green-300/70 mb-1">
                                        <Clock size={12} />
                                        <span className="text-[10px] uppercase font-bold">History Ledger</span>
                                        <Tooltip text="Latest ledger ingested by Horizon History" />
                                    </div>
                                    <span className="text-lg font-mono font-bold text-white">
                                        {result.history_latest_ledger}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <div className="flex items-center gap-1.5 text-green-300/70 mb-1">
                                        <Server size={12} />
                                        <span className="text-[10px] uppercase font-bold">Core Version</span>
                                        <Tooltip text="Version of the Stellar Core software running" />
                                    </div>
                                    <span className="text-xs font-mono text-gray-300 break-all">
                                        {result.core_version}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {error && !result && (
                <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-sm flex items-center gap-2">
                    <XCircle size={16} />
                    {error}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MonitoringModal;
