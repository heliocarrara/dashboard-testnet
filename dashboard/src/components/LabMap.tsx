'use client';

import React, { useState, useEffect } from 'react';
import { Save, Server, LayoutGrid, RotateCcw, X, Check } from 'lucide-react';

interface Node {
  id: number;
  hostname: string;
  ip_address: string;
  status: string;
  role: string | null;
}

interface Machine {
  id: string;
  row: number;
  col: number;
  active: boolean;
  hostname?: string;
  ip_address?: string;
  node_id?: number;
}

interface LabMapConfig {
  rows: number;
  machinesPerRow: number;
  machines: Machine[];
}

export default function LabMap({ nodes = [], readOnly = false }: { nodes?: Node[], readOnly?: boolean }) {
  const [config, setConfig] = useState<LabMapConfig>({
    rows: 3,
    machinesPerRow: 5, // Default to 5 as requested (2 + 3)
    machines: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<{row: number, col: number} | null>(null);

  useEffect(() => {
    fetch('/api/lab-map')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.rows === 'number') {
          setConfig(data);
        }
      })
      .catch((err) => console.error('Failed to load lab map:', err))
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/lab-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (field: keyof LabMapConfig, value: number) => {
    setConfig((prev) => ({
      ...prev,
      [field]: Math.max(1, value),
    }));
  };

  const getMachine = (row: number, col: number) => {
    return config.machines.find((m) => m.id === `r${row}-c${col}`);
  };

  const isMachineActive = (row: number, col: number) => {
    return getMachine(row, col)?.active || false;
  };

  const assignNodeToMachine = (node: Node) => {
    if (!selectedMachine) return;
    
    setConfig((prev) => {
      const { row, col } = selectedMachine;
      const id = `r${row}-c${col}`;
      const existingIndex = prev.machines.findIndex((m) => m.id === id);
      const newMachines = [...prev.machines];
      
      const machineData = {
        id,
        row,
        col,
        active: true, // Auto-activate on assignment
        hostname: node.hostname,
        ip_address: node.ip_address,
        node_id: node.id
      };

      if (existingIndex >= 0) {
        newMachines[existingIndex] = machineData;
      } else {
        newMachines.push(machineData);
      }
      
      return { ...prev, machines: newMachines };
    });
    setSelectedMachine(null);
  };

  const clearMachineAssignment = () => {
    if (!selectedMachine) return;
    
    setConfig((prev) => {
      const { row, col } = selectedMachine;
      const id = `r${row}-c${col}`;
      const existingIndex = prev.machines.findIndex((m) => m.id === id);
      
      if (existingIndex >= 0) {
        const newMachines = [...prev.machines];
        // Keep active but remove node info
        newMachines[existingIndex] = {
            ...newMachines[existingIndex],
            hostname: undefined,
            ip_address: undefined,
            node_id: undefined
        };
        return { ...prev, machines: newMachines };
      }
      return prev;
    });
    setSelectedMachine(null);
  };

  const toggleMachineActive = () => {
     if (!selectedMachine) return;
     
     setConfig((prev) => {
      const { row, col } = selectedMachine;
      const id = `r${row}-c${col}`;
      const existingIndex = prev.machines.findIndex((m) => m.id === id);
      const newMachines = [...prev.machines];
      
      if (existingIndex >= 0) {
        newMachines[existingIndex] = {
          ...newMachines[existingIndex],
          active: !newMachines[existingIndex].active,
        };
      } else {
        newMachines.push({ id, row, col, active: true });
      }
      return { ...prev, machines: newMachines };
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500">Loading map configuration...</div>;
  }

  return (
    <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-transparent text-gray-900 dark:text-gray-100 transition-colors duration-300 relative">
      
      {/* Node Selection Modal */}
      {selectedMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Configure Machine (Row {selectedMachine.row + 1}, Pos {selectedMachine.col + 1})</h3>
                    <button onClick={() => setSelectedMachine(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="mb-4">
                        <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Status</h4>
                        <button 
                            onClick={toggleMachineActive}
                            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${isMachineActive(selectedMachine.row, selectedMachine.col) 
                                ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200' 
                                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'}`}
                        >
                            {isMachineActive(selectedMachine.row, selectedMachine.col) ? 'Active Machine' : 'Inactive Machine'}
                        </button>
                    </div>

                    <div className="mb-4">
                         <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold uppercase text-gray-500">Assign Node</h4>
                            <button onClick={clearMachineAssignment} className="text-xs text-red-500 hover:text-red-600">Clear Assignment</button>
                         </div>
                         <div className="space-y-2">
                            {nodes && nodes.length > 0 ? (
                                nodes.map(node => {
                                    const isAssigned = config.machines.some(m => m.node_id === node.id && m.id !== `r${selectedMachine.row}-c${selectedMachine.col}`);
                                    const isCurrent = getMachine(selectedMachine.row, selectedMachine.col)?.node_id === node.id;
                                    
                                    return (
                                        <button
                                            key={node.id}
                                            disabled={isAssigned}
                                            onClick={() => assignNodeToMachine(node)}
                                            className={`w-full text-left p-3 rounded-lg border flex items-center justify-between group transition-all
                                                ${isCurrent 
                                                    ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20 dark:border-indigo-500 ring-1 ring-indigo-500' 
                                                    : isAssigned
                                                        ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                }
                                            `}
                                        >
                                            <div>
                                                <div className="font-bold text-sm">{node.hostname}</div>
                                                <div className="text-xs font-mono text-gray-500">{node.ip_address}</div>
                                            </div>
                                            {isCurrent && <Check size={16} className="text-indigo-600" />}
                                            {isAssigned && <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-500">Assigned</span>}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="text-sm text-gray-500 text-center py-4">No nodes available to assign</div>
                            )}
                         </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Header */}
      {!readOnly && (
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <LayoutGrid className="text-indigo-500 dark:text-indigo-400" />
            Laboratory Map
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Configure the physical layout of the laboratory machines</p>
        </div>
        <button 
          onClick={saveConfig}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? <RotateCcw className="animate-spin" size={18} /> : <Save size={18} />}
          <span>Save Layout</span>
        </button>
      </div>
      )}

      {/* Controls */}
      {!readOnly && (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-wrap gap-8 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Rows (Bancadas)</label>
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => handleConfigChange('rows', config.rows - 1)}
                 className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
               >-</button>
               <span className="text-xl font-mono font-bold w-8 text-center">{config.rows}</span>
               <button 
                 onClick={() => handleConfigChange('rows', config.rows + 1)}
                 className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
               >+</button>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Machines per Row</label>
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => handleConfigChange('machinesPerRow', config.machinesPerRow - 1)}
                 className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
               >-</button>
               <span className="text-xl font-mono font-bold w-8 text-center">{config.machinesPerRow}</span>
               <button 
                 onClick={() => handleConfigChange('machinesPerRow', config.machinesPerRow + 1)}
                 className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
               >+</button>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto text-sm text-gray-500">
             <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]"></div>
                <span>Active</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"></div>
                <span>Inactive</span>
             </div>
          </div>
        </div>
      </div>
      )}

      {/* Grid Visualization */}
      <div className="flex-1 bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-auto flex items-center justify-center">
        <div className="flex flex-col gap-8">
          {Array.from({ length: config.rows }).map((_, rowIndex) => {
            // Check if row has any machines associated (only in readOnly mode)
            if (readOnly) {
                const hasAssociatedMachines = Array.from({ length: config.machinesPerRow }).some((_, colIndex) => {
                    const machine = getMachine(rowIndex, colIndex);
                    return machine?.ip_address || machine?.node_id;
                });
                if (!hasAssociatedMachines) return null;
            }

            return (
            <div key={rowIndex} className="flex items-center gap-4">
              <div className="w-8 text-xs font-bold text-gray-400 uppercase -ml-12 text-right">Row {rowIndex + 1}</div>
              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                {Array.from({ length: config.machinesPerRow }).map((_, colIndex) => {
                  const machine = getMachine(rowIndex, colIndex);
                  const isActive = machine?.active || false;
                  
                  // Layout gap: After 2nd machine (index 1), add extra margin
                  const isGap = colIndex === 1;

                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => setSelectedMachine({ row: rowIndex, col: colIndex })}
                      className={`
                        relative w-16 h-16 rounded-lg flex items-center justify-center transition-all duration-200
                        ${isGap ? 'mr-12' : ''}
                        ${isActive 
                          ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] transform hover:scale-105' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                        }
                      `}
                      title={`Row ${rowIndex + 1}, Machine ${colIndex + 1}`}
                    >
                      <Server size={24} className={machine?.ip_address ? "opacity-20" : ""} />
                      
                      {machine?.ip_address && (
                          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold font-mono">
                              .{machine.ip_address.split('.').pop()}
                          </span>
                      )}

                      <span className="absolute bottom-1 right-2 text-[10px] font-mono opacity-60">
                        {colIndex + 1}
                      </span>
                      
                      {machine?.ip_address && (
                          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity z-10">
                              {machine.ip_address}
                          </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
          })}
        </div>
      </div>

    </div>
  );
}