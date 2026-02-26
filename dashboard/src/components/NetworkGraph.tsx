'use client';

import React, { useState } from 'react';

interface NetworkNode {
  id: string;
  hostname: string;
  ip_address: string;
  role: string | null;
  status: string;
  config_status: string;
  ordem?: number | null;
}

interface NetworkGraphProps {
  nodes: NetworkNode[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ nodes, selectedNodeId, onNodeSelect }) => {
  // Filter nodes by role
  const validators = nodes.filter(n => n.role === 'validator');
  const watchers = nodes.filter(n => n.role?.startsWith('watcher'));
  const unassigned = nodes.filter(n => !n.role || n.role === 'none');

  // Constants for Circular Layout
  const CENTER_X = 400;
  const CENTER_Y = 320;
  const VALIDATOR_RADIUS = 130;
  const SDF_RADIUS = 280;
  const WATCHER_OFFSET_Y = 280;

  // Helper to calculate position
  const getPosition = (index: number, total: number, radius: number, offsetAngle: number = 0) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2 + offsetAngle;
    return {
      x: CENTER_X + radius * Math.cos(angle),
      y: CENTER_Y + radius * Math.sin(angle),
    };
  };

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeSelect(selectedNodeId === id ? null : id);
  };

  const renderNode = (
    title: string, 
    assignedNode: NetworkNode | undefined, 
    type: 'validator' | 'watcher' | 'sdf', 
    x: number, 
    y: number,
    nodeIdForSelection: string
  ) => {
    const isOnline = assignedNode?.status === 'online';
    const isSelected = selectedNodeId === nodeIdForSelection;
    
    // Style logic
    let bgColor = 'bg-gray-800';
    let borderColor = 'border-gray-700';
    let size = 'w-20 h-20';
    let labelColor = 'text-gray-400';
    
    if (type === 'sdf') {
        bgColor = 'bg-blue-900/10';
        borderColor = 'border-blue-500/20 border-dashed';
        size = 'w-14 h-14';
        labelColor = 'text-blue-400';
    } else if (assignedNode) {
        if (isOnline) {
            bgColor = type === 'validator' ? 'bg-green-500' : 'bg-purple-600';
            borderColor = type === 'validator' ? 'border-green-600' : 'border-purple-700';
        } else {
            bgColor = 'bg-red-500';
            borderColor = 'border-red-600';
        }
    }

    // Determine the label to show inside the circle
    let circleLabel = '?';
    if (type === 'sdf') {
        circleLabel = 'SDF';
    } else if (assignedNode && assignedNode.ordem) {
        // Use the new 'ordem' field if available
        circleLabel = assignedNode.ordem.toString();
    } else if (type === 'validator') {
        // Fallback: Extract the number from the title "Validator X"
        const match = title.match(/Validator (\d+)/);
        circleLabel = match ? match[1] : (assignedNode?.id.toString() || '?');
    } else if (assignedNode) {
        circleLabel = assignedNode.id.toString();
    }

    return (
      <div 
        className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-20 cursor-pointer"
        style={{ left: x, top: y }}
        onClick={(e) => {
            handleNodeClick(nodeIdForSelection, e);
        }}
      >
        {/* Node Circle */}
        <div className={`
            ${size} rounded-full flex items-center justify-center border-4 shadow-lg transition-all duration-300 
            ${isSelected ? 'ring-4 ring-white scale-110 z-30' : 'hover:scale-105'} 
            ${bgColor} ${borderColor} relative
        `}>
            {type === 'sdf' ? (
                <span className="text-[10px] text-blue-300 font-bold opacity-70">SDF</span>
            ) : (
                <span className="text-2xl font-bold text-white leading-none">{circleLabel}</span>
            )}

            {/* Online Indicator */}
            {assignedNode && type !== 'sdf' && (
                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></div>
            )}
        </div>

        {/* Label */}
        <div className={`mt-2 bg-gray-900/90 px-2 py-1 rounded text-center backdrop-blur-sm border border-gray-800 min-w-[90px] ${type === 'sdf' ? 'opacity-70' : ''}`}>
            <p className={`text-[9px] font-bold uppercase tracking-wider ${labelColor}`}>{title}</p>
            {assignedNode && (
                <p className="text-[10px] text-white font-mono truncate max-w-[110px]">{assignedNode.hostname}</p>
            )}
        </div>
      </div>
    );
  };


  // Generate Positions
  const validatorPositions = Array.from({ length: 5 }).map((_, i) => getPosition(i, 5, VALIDATOR_RADIUS));
  const sdfPositions = [
      getPosition(0, 1, SDF_RADIUS, -Math.PI/4),
      getPosition(0, 1, SDF_RADIUS, 0),
      getPosition(0, 1, SDF_RADIUS, Math.PI/4)
  ];
  const manualWatcherPositions = [
      { x: CENTER_X - 180, y: CENTER_Y + WATCHER_OFFSET_Y },
      { x: CENTER_X,       y: CENTER_Y + WATCHER_OFFSET_Y + 40 },
      { x: CENTER_X + 180, y: CENTER_Y + WATCHER_OFFSET_Y },
  ];

  // IDs for connection logic
  const getValidatorId = (idx: number) => validators[idx]?.id || `v-slot-${idx}`;
  const getSdfId = (idx: number) => `sdf-${idx}`;
  const getWatcherId = (idx: number) => watchers[idx]?.id || `w-slot-${idx}`;

  // Helper to determine line opacity based on selection
  const getLineOpacity = (id1: string, id2: string, defaultOpacity: number) => {
    if (!selectedNodeId) return defaultOpacity;
    if (selectedNodeId === id1 || selectedNodeId === id2) return 1;
    return 0.05; // Dim unconnected lines
  };

  const getLineColor = (id1: string, id2: string, defaultColor: string) => {
      if (selectedNodeId && (selectedNodeId === id1 || selectedNodeId === id2)) return '#FFFFFF'; // Highlight color
      return defaultColor;
  };
  
  const getLineWidth = (id1: string, id2: string, defaultWidth: string) => {
      if (selectedNodeId && (selectedNodeId === id1 || selectedNodeId === id2)) return '2';
      return defaultWidth;
  };

  return (
    <div className="relative w-full h-full bg-gray-950 overflow-hidden" onClick={() => onNodeSelect(null)}>
      
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full border border-blue-900/20 border-dashed pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] rounded-full border border-green-900/20 pointer-events-none"></div>

      {/* Title Overlay */}
      <div className="absolute top-6 left-8 z-30 pointer-events-none">
        <h2 className="text-xl font-bold text-white tracking-tight">Consensus Topology</h2>
        <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <p className="text-xs text-green-400 font-mono">LIVE NETWORK</p>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">Click nodes to see connections • Double-click for details</p>
      </div>

      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <defs>
            <linearGradient id="gradValidator" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{stopColor: '#10B981', stopOpacity: 0.4}} />
                <stop offset="100%" style={{stopColor: '#34D399', stopOpacity: 0.1}} />
            </linearGradient>
            <linearGradient id="gradSDF" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: '#3B82F6', stopOpacity: 0.2}} />
                <stop offset="100%" style={{stopColor: '#1E40AF', stopOpacity: 0.0}} />
            </linearGradient>
        </defs>

        {/* 1. Draw Mesh Connections between Validators */}
        {validatorPositions.map((pos1, i) => (
            validatorPositions.map((pos2, j) => {
                if (i < j) { 
                    const id1 = getValidatorId(i);
                    const id2 = getValidatorId(j);
                    return (
                        <line 
                            key={`v-${i}-${j}`}
                            x1={pos1.x} y1={pos1.y}
                            x2={pos2.x} y2={pos2.y}
                            stroke={getLineColor(id1, id2, "#10B981")}
                            strokeWidth={getLineWidth(id1, id2, "1.5")}
                            strokeOpacity={getLineOpacity(id1, id2, 0.2)}
                            className="transition-all duration-300"
                        />
                    );
                }
                return null;
            })
        ))}

        {/* 2. Connect Validators to SDF Satellites */}
        {sdfPositions.map((sdfPos, i) => (
            validatorPositions.map((vPos, j) => {
                const id1 = getSdfId(i);
                const id2 = getValidatorId(j);
                return (
                    <line 
                        key={`sdf-link-${i}-${j}`}
                        x1={sdfPos.x} y1={sdfPos.y}
                        x2={vPos.x} y2={vPos.y}
                        stroke={selectedNodeId && (selectedNodeId === id1 || selectedNodeId === id2) ? '#3B82F6' : "url(#gradSDF)"}
                        strokeWidth={getLineWidth(id1, id2, "1")}
                        strokeDasharray="4,4"
                        strokeOpacity={getLineOpacity(id1, id2, 1)} // Default full opacity for gradient unless dimmed
                        className="transition-all duration-300"
                    />
                );
            })
        ))}

        {/* 3. Connect Watchers to Validators */}
        {manualWatcherPositions.map((wPos, i) => (
             validatorPositions.map((vPos, j) => {
                const id1 = getWatcherId(i);
                const id2 = getValidatorId(j);
                return (
                    <line 
                        key={`w-link-${i}-${j}`}
                        x1={wPos.x} y1={wPos.y}
                        x2={vPos.x} y2={vPos.y}
                        stroke={getLineColor(id1, id2, "#8B5CF6")}
                        strokeWidth={getLineWidth(id1, id2, "1")}
                        strokeOpacity={getLineOpacity(id1, id2, 0.15)}
                        className="transition-all duration-300"
                    />
                );
             })
        ))}
      </svg>

      {/* Render SDF Satellites */}
      {sdfPositions.map((pos, i) => (
          <React.Fragment key={`sdf-node-${i}`}>
            {renderNode(`SDF Core ${i+1}`, { id: `S${i+1}`, hostname: 'stellar.org', ip_address: '192.168.1.1', role: 'sdf', status: 'online', config_status: 'ok' }, 'sdf', pos.x, pos.y, getSdfId(i))}
          </React.Fragment>
      ))}

      {/* Render Validators */}
      {validatorPositions.map((pos, i) => (
          <React.Fragment key={`v-node-${i}`}>
            {renderNode(`Validator ${i + 1}`, validators[i], 'validator', pos.x, pos.y, getValidatorId(i))}
          </React.Fragment>
      ))}

      {/* Render Watchers */}
      {manualWatcherPositions.map((pos, i) => (
          <React.Fragment key={`w-node-${i}`}>
            {renderNode(`Watcher ${i + 1}`, watchers[i], 'watcher', pos.x, pos.y, getWatcherId(i))}
          </React.Fragment>
      ))}

      {/* Unassigned List (Bottom Right Floating) - Adjusted position to not overlap with panel */}
      {unassigned.length > 0 && (
          <div className="absolute bottom-32 right-4 bg-gray-900/90 p-4 rounded-lg border border-gray-700 shadow-xl z-30 max-w-xs backdrop-blur-md">
             <h4 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                New Nodes Detected
             </h4>
             <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                 {unassigned.map(node => (
                     <div key={node.id} className="flex justify-between items-center text-sm text-gray-300 border-b border-gray-800 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-gray-800 p-1 rounded" onClick={(e) => handleNodeClick(node.id, e)}>
                         <div className="flex flex-col">
                            <span className="font-bold text-white">{node.hostname}</span>
                            <span className="font-mono text-[10px] text-gray-500">{node.id}</span>
                         </div>
                         <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-blue-300 border border-gray-700">{node.ip_address}</span>
                     </div>
                 ))}
             </div>
          </div>
      )}

    </div>
  );
};

export default NetworkGraph;
