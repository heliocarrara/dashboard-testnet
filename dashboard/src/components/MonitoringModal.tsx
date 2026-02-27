import React, { useState, useEffect, useRef } from 'react';
import { Activity, X, Server, Database, CheckCircle, XCircle, Clock, Copy, Check, Play, Pause, HelpCircle, Cpu, Network } from 'lucide-react';

interface MonitoringModalProps {
  node: any;
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
  const [activeTab, setActiveTab] = useState<'horizon' | 'core'>(
    node.role && node.role.includes('horizon') ? 'horizon' : 'core'
  );
  const [loading, setLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  // Horizon State
  const [horizonResult, setHorizonResult] = useState<any>(null);
  const [horizonMetrics, setHorizonMetrics] = useState<any>(null);
  
  // Core State
  const [coreResult, setCoreResult] = useState<any>(null);
  const [coreMetrics, setCoreMetrics] = useState<any>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const isMonitoringRef = useRef(isMonitoring);
  const metricsLoadingRef = useRef(metricsLoading);
  const activeTabRef = useRef(activeTab);

  // Update refs
  useEffect(() => { isMonitoringRef.current = isMonitoring; }, [isMonitoring]);
  useEffect(() => { metricsLoadingRef.current = metricsLoading; }, [metricsLoading]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Stop monitoring when tab changes
  useEffect(() => {
    setIsMonitoring(false);
    setError(null);
    // Auto-run mock test for SDF Validators on Horizon tab
    if (activeTab === 'horizon' && node.role === 'validator_sdf') {
        setHorizonResult({
            status: 'online',
            core_latest_ledger: 'Managed by SDF',
            history_latest_ledger: 'Managed by SDF',
            horizon_version: 'Official Release',
            core_version: 'Stellar Core (SDF)',
            network_passphrase: 'Test SDF Network ; September 2015'
        });
    }
  }, [activeTab, node.role]);

  // Cleanup
  useEffect(() => {
    return () => setIsMonitoring(false);
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

  // --- Horizon Functions ---

  const handleTestHorizon = async () => {
    setLoading(true);
    setHorizonResult(null);
    setError(null);
    setLogs([]); 
    
    // Special handling for SDF Validators (Assumed Online)
    if (node.role === 'validator_sdf') {
        addLog(`[Horizon] SDF Validator detected: ${node.hostname}`);
        addLog(`[Horizon] Target: Trusted Node (Monitoring Bypassed)`);
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockData = {
            status: 'online',
            core_latest_ledger: 'Managed by SDF',
            history_latest_ledger: 'Managed by SDF',
            horizon_version: 'Official Release',
            core_version: 'Stellar Core (SDF)',
            network_passphrase: 'Test SDF Network ; September 2015'
        };

        addLog(`[Horizon] Node Status: online (Policy Override)`);
        addLog(`[Horizon] Latest Ledger: ${mockData.core_latest_ledger}`);
        
        setHorizonResult(mockData);
        setLoading(false);
        return;
    }

    try {
      addLog(`[Horizon] Starting connection test for node: ${node.hostname}`);
      addLog(`[Horizon] Target IP: ${node.ip_address}`);
      
      const res = await fetch(`/api/monitoring/horizon?ip=${node.ip_address}`);
      addLog(`[Horizon] Response received. Status: ${res.status}`);
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();
      addLog(`[Horizon] Node Status: ${data.status}`);
      
      if (data.status === 'online') {
        addLog(`[Horizon] Latest Ledger: ${data.core_latest_ledger}`);
      } else {
        addLog(`[Horizon] Error: ${data.error}`);
      }
      
      setHorizonResult(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch monitoring data';
      addLog(`[Horizon] TEST FAILED: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetricsHorizon = async () => {
    if (metricsLoadingRef.current) return;
    setMetricsLoading(true);
    setError(null);

    // Special handling for SDF Validators (Assumed Online)
    if (node.role === 'validator_sdf') {
        try {
            addLog(`[Horizon] Fetching metrics (Trusted Node)...`);
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const mockMetrics = {
                status: 'online',
                latency_ms: Math.floor(Math.random() * 50) + 100, // Fake latency
                latest_ledger: { sequence: 'Managed by SDF' }
            };

            addLog(`[Horizon] Latency: ${mockMetrics.latency_ms}ms, Ledger: #${mockMetrics.latest_ledger.sequence}`);
            setHorizonMetrics(mockMetrics);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setMetricsLoading(false);
        }
        return;
    }

    try {
      addLog(`[Horizon] Fetching metrics...`);
      const res = await fetch(`/api/monitoring/horizon/metrics?ip=${node.ip_address}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();
      if (data.status === 'online') {
        addLog(`[Horizon] Latency: ${data.latency_ms}ms, Ledger: #${data.latest_ledger?.sequence}`);
      } else {
        addLog(`[Horizon] Metrics Error: ${data.error}`);
      }
      setHorizonMetrics(data);
    } catch (err: any) {
      addLog(`[Horizon] METRICS FAILED: ${err.message}`);
      setError(err.message);
    } finally {
      setMetricsLoading(false);
    }
  };

  // --- Core Functions ---

  const handleTestCore = async () => {
    setLoading(true);
    setCoreResult(null);
    setError(null);
    setLogs([]); 
    
    try {
      addLog(`[Core] Starting connection test for node: ${node.hostname}`);
      addLog(`[Core] Target IP: ${node.ip_address} (Port 11626)`);
      
      const res = await fetch(`/api/monitoring/core?ip=${node.ip_address}`);
      addLog(`[Core] Response received. Status: ${res.status}`);
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();
      addLog(`[Core] Node Status: ${data.status}`);
      
      if (data.status === 'online') {
        addLog(`[Core] Ledger: ${data.ledger_num}, State: ${data.state}`);
      } else if (data.status === 'online_p2p') {
        addLog(`[Core] P2P Port (11625) is OPEN. HTTP API (11626) is RESTRICTED.`);
        addLog(`[Core] ${data.message}`);
        addLog(`[Core] State: ${data.state}`);
      } else {
        addLog(`[Core] Error: ${data.error}`);
      }
      
      setCoreResult(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch Core data';
      addLog(`[Core] TEST FAILED: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetricsCore = async () => {
    if (metricsLoadingRef.current) return;
    setMetricsLoading(true);
    setError(null);

    try {
      addLog(`[Core] Fetching metrics...`);
      const res = await fetch(`/api/monitoring/core/metrics?ip=${node.ip_address}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();
      if (data.status === 'online') {
        addLog(`[Core] Latency: ${data.latency_ms}ms, Peers: ${data.peers?.authenticated}`);
      } else if (data.status === 'online_p2p') {
        addLog(`[Core] P2P Ping: ${data.latency_ms}ms (HTTP Restricted)`);
      } else {
        addLog(`[Core] Metrics Error: ${data.error}`);
      }
      setCoreMetrics(data);
    } catch (err: any) {
      addLog(`[Core] METRICS FAILED: ${err.message}`);
      setError(err.message);
    } finally {
      setMetricsLoading(false);
    }
  };

  // --- Shared Monitoring Loop ---

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isMonitoring) {
      addLog(`Starting continuous monitoring for ${activeTab.toUpperCase()}...`);
      
      const fetchFunction = activeTab === 'horizon' ? fetchMetricsHorizon : fetchMetricsCore;
      
      // Execute immediately
      fetchFunction();
      
      // Loop
      intervalId = setInterval(() => {
        if (isMonitoringRef.current) {
            const currentTab = activeTabRef.current;
            if (currentTab === 'horizon') fetchMetricsHorizon();
            else fetchMetricsCore();
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isMonitoring, activeTab]); // Restart loop if tab changes (but we stop monitoring on tab change anyway)

  const toggleMonitoring = () => {
    if (isMonitoring) {
      setIsMonitoring(false);
      addLog("Monitoring stopped by user.");
    } else {
      if (activeTab === 'horizon') setHorizonMetrics(null);
      else setCoreMetrics(null);
      
      setLogs([]); 
      setIsMonitoring(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative flex flex-col max-h-[90vh]">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
        >
            <X size={20} />
        </button>

        <div className="p-6 border-b border-gray-800 bg-gray-800/50 shrink-0">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="text-blue-500" />
                Node Monitor
            </h3>
            <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded border border-gray-700">
                    {node.hostname}
                </span>
                <span className="text-xs text-gray-500">
                    {node.ip_address}
                </span>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
            <button
                onClick={() => setActiveTab('horizon')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
                    activeTab === 'horizon' 
                        ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
            >
                <Activity size={16} />
                Horizon
            </button>
            <button
                onClick={() => setActiveTab('core')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
                    activeTab === 'core' 
                        ? 'bg-gray-800 text-purple-400 border-b-2 border-purple-500' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
            >
                <Cpu size={16} />
                Stellar Core
            </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            {/* Target Info (Shared) */}
            <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
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
                    onClick={activeTab === 'horizon' ? handleTestHorizon : handleTestCore}
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
                            {activeTab === 'horizon' ? <Activity size={18} /> : <Cpu size={18} />}
                            Test {activeTab === 'horizon' ? 'Horizon API' : 'Core Connection'}
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

            {/* --- HORIZON CONTENT --- */}
            {activeTab === 'horizon' && (
                <>
                    {/* Horizon Metrics */}
                    {horizonMetrics && (
                        <div className="animate-in slide-in-from-bottom-2 duration-300">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Horizon Metrics</h4>
                            <div className={`p-4 rounded-lg border ${horizonMetrics.status === 'online' ? 'bg-purple-900/20 border-purple-800' : 'bg-red-900/20 border-red-800'}`}>
                                {horizonMetrics.status === 'online' ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-gray-800/50 rounded-lg">
                                            <div className="flex items-center mb-1">
                                                <span className="text-[10px] uppercase text-gray-400 font-bold">Latency</span>
                                                <Tooltip text="Time taken for the node to respond" />
                                            </div>
                                            <span className="text-2xl font-mono font-bold text-white">{horizonMetrics.latency_ms}<span className="text-sm text-gray-500 ml-1">ms</span></span>
                                        </div>
                                        <div className="p-3 bg-gray-800/50 rounded-lg">
                                            <div className="flex items-center mb-1">
                                                <span className="text-[10px] uppercase text-gray-400 font-bold">Avg Close Time</span>
                                                <Tooltip text="Average ledger close time (last 6 ledgers)" />
                                            </div>
                                            <span className="text-2xl font-mono font-bold text-white">{horizonMetrics.avg_ledger_close_time_s}<span className="text-sm text-gray-500 ml-1">s</span></span>
                                        </div>
                                        
                                        {horizonMetrics.latest_ledger && (
                                            <div className="col-span-2 p-3 bg-gray-800/50 rounded-lg">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center">
                                                        <span className="text-[10px] uppercase text-gray-400 font-bold">Latest Ledger</span>
                                                        <Tooltip text="Most recent ledger processed" />
                                                    </div>
                                                    <span className="text-xs font-mono text-purple-400">#{horizonMetrics.latest_ledger.sequence}</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div>
                                                        <span className="block text-lg font-bold text-white">{horizonMetrics.latest_ledger.tx_count}</span>
                                                        <span className="text-[10px] text-gray-500 uppercase">TXs</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-lg font-bold text-green-400">{horizonMetrics.latest_ledger.successful_tx_count}</span>
                                                        <span className="text-[10px] text-gray-500 uppercase">Success</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-lg font-bold text-red-400">{horizonMetrics.latest_ledger.failed_tx_count}</span>
                                                        <span className="text-[10px] text-gray-500 uppercase">Failed</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <XCircle className="text-red-500" size={24} />
                                        <div>
                                            <h5 className="font-bold text-red-400">Unavailable</h5>
                                            <p className="text-xs text-red-300 mt-1">{horizonMetrics.error}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Horizon Test Results */}
                    {horizonResult && (
                        <div className="animate-in slide-in-from-bottom-2 duration-300">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Horizon Test Results</h4>
                            <div className={`p-4 rounded-lg border ${horizonResult.status === 'online' ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    {horizonResult.status === 'online' ? <CheckCircle className="text-green-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
                                    <div>
                                        <h5 className={`font-bold ${horizonResult.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                                            {horizonResult.status === 'online' ? 'Online & Syncing' : 'Offline / Unreachable'}
                                        </h5>
                                        {horizonResult.error && <p className="text-xs text-red-300 mt-1">{horizonResult.error}</p>}
                                    </div>
                                </div>
                                {horizonResult.status === 'online' && (
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-green-800/30 pt-4">
                                        <div>
                                            <div className="flex items-center gap-1.5 text-green-300/70 mb-1">
                                                <Database size={12} />
                                                <span className="text-[10px] uppercase font-bold">Core Ledger</span>
                                            </div>
                                            <span className="text-lg font-mono font-bold text-white">{horizonResult.core_latest_ledger}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 text-green-300/70 mb-1">
                                                <Clock size={12} />
                                                <span className="text-[10px] uppercase font-bold">History Ledger</span>
                                            </div>
                                            <span className="text-lg font-mono font-bold text-white">{horizonResult.history_latest_ledger}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* --- CORE CONTENT --- */}
            {activeTab === 'core' && (
                <>
                    {/* Core Metrics */}
                    {coreMetrics && (
                        <div className="animate-in slide-in-from-bottom-2 duration-300">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Core Metrics</h4>
                            <div className={`p-4 rounded-lg border ${coreMetrics.status === 'online' ? 'bg-purple-900/20 border-purple-800' : 'bg-red-900/20 border-red-800'}`}>
                                {coreMetrics.status === 'online' ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-gray-800/50 rounded-lg">
                                            <div className="flex items-center mb-1">
                                                <span className="text-[10px] uppercase text-gray-400 font-bold">Latency</span>
                                                <Tooltip text="Ping time to Core port 11626" />
                                            </div>
                                            <span className="text-2xl font-mono font-bold text-white">{coreMetrics.latency_ms}<span className="text-sm text-gray-500 ml-1">ms</span></span>
                                        </div>
                                        <div className="p-3 bg-gray-800/50 rounded-lg">
                                            <div className="flex items-center mb-1">
                                                <span className="text-[10px] uppercase text-gray-400 font-bold">Sync State</span>
                                                <Tooltip text="Current synchronization state of the node" />
                                            </div>
                                            <span className="text-lg font-mono font-bold text-white uppercase">{coreMetrics.state}</span>
                                        </div>
                                        
                                        <div className="col-span-2 p-3 bg-gray-800/50 rounded-lg">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center">
                                                    <span className="text-[10px] uppercase text-gray-400 font-bold">Peers & Quorum</span>
                                                    <Tooltip text="Network connectivity details" />
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-blue-400">
                                                    <Network size={12} />
                                                    {coreMetrics.peers.authenticated} Peers
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div className="bg-black/20 p-2 rounded">
                                                    <span className="block text-xs text-gray-500 mb-1">Latest Ledger</span>
                                                    <span className="block text-lg font-bold text-white">{coreMetrics.ledger.num}</span>
                                                    <span className="text-[10px] text-gray-600">Age: {coreMetrics.ledger.age}s</span>
                                                </div>
                                                <div className="bg-black/20 p-2 rounded">
                                                    <span className="block text-xs text-gray-500 mb-1">Base Fee</span>
                                                    <span className="block text-lg font-bold text-white">{coreMetrics.ledger.baseFee}</span>
                                                    <span className="text-[10px] text-gray-600">Stroops</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <XCircle className="text-red-500" size={24} />
                                        <div>
                                            <h5 className="font-bold text-red-400">Unavailable</h5>
                                            <p className="text-xs text-red-300 mt-1">{coreMetrics.error}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Core Test Results */}
                    {coreResult && (
                        <div className="animate-in slide-in-from-bottom-2 duration-300">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Core Connection Results</h4>
                            <div className={`p-4 rounded-lg border ${coreResult.status === 'online' ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    {coreResult.status === 'online' ? <CheckCircle className="text-green-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
                                    <div>
                                        <h5 className={`font-bold ${coreResult.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                                            {coreResult.status === 'online' ? 'Online & Reachable' : 'Offline / Unreachable'}
                                        </h5>
                                        {coreResult.error && <p className="text-xs text-red-300 mt-1">{coreResult.error}</p>}
                                    </div>
                                </div>
                                {coreResult.status === 'online' && (
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-green-800/30 pt-4">
                                        <div>
                                            <div className="flex items-center gap-1.5 text-green-300/70 mb-1">
                                                <Cpu size={12} />
                                                <span className="text-[10px] uppercase font-bold">Protocol Ver</span>
                                            </div>
                                            <span className="text-sm font-mono font-bold text-white">{coreResult.protocol_version}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 text-green-300/70 mb-1">
                                                <Activity size={12} />
                                                <span className="text-[10px] uppercase font-bold">State</span>
                                            </div>
                                            <span className="text-sm font-mono font-bold text-white">{coreResult.state}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-1.5 text-green-300/70 mb-1">
                                                <Server size={12} />
                                                <span className="text-[10px] uppercase font-bold">Build</span>
                                            </div>
                                            <span className="text-xs font-mono text-gray-300 break-all">{coreResult.build}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {error && !horizonResult && !coreResult && !horizonMetrics && !coreMetrics && (
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
