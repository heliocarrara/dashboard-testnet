'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface NetworkNode {
  id: number;
  hostname: string;
  ip_address: string;
  role: string | null;
  status: string;
  config_status: string;
  ordem?: number | null;
  peers?: number[];
}

interface NetworkGraphProps {
  nodes: NetworkNode[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ nodes, selectedNodeId, onNodeSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 });

  useEffect(() => {
    const updateDimensions = () => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.offsetWidth,
                height: containerRef.current.offsetHeight
            });
        }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Filter nodes by role
  const validators = nodes.filter(n => n.role === 'validator');
  const watchers = nodes.filter(n => n.role?.startsWith('watcher'));
  const sdfNodes = nodes.filter(n => n.role === 'sdf_validator' || n.role === 'validator_sdf');
  const unassigned = nodes.filter(n => !n.role || n.role === 'none');

  // Dynamic Center and Radius
  const CENTER_X = dimensions.width / 2;
  const CENTER_Y = dimensions.height / 2;
  
  // Scale down radius if screen is small
  const minDim = Math.min(dimensions.width, dimensions.height);
  const isMobile = dimensions.width < 600;
  const scale = isMobile ? minDim / 400 : 1; // More aggressive scaling for mobile
  
  // Adjusted radii for mobile to prevent overlap
  const VALIDATOR_RADIUS = isMobile ? 80 * scale : 130;
  const SDF_RADIUS = isMobile ? 160 * scale : 280;
  const WATCHER_OFFSET_Y = isMobile ? 180 * scale : 280;

  // Helper to calculate position
  const getPosition = (index: number, total: number, radius: number, offsetAngle: number = 0) => {
    // For mobile, we might want an oval shape or just tighter packing
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2 + offsetAngle;
    return {
      x: CENTER_X + (isMobile ? radius * 0.8 : radius) * Math.cos(angle), // Compress width in mobile
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
    let bgColor = 'bg-gray-200 dark:bg-gray-800';
    let borderColor = 'border-gray-300 dark:border-gray-700';
    // Dynamic size based on screen width
    let size = isMobile ? 'w-12 h-12' : 'w-20 h-20';
    let labelColor = 'text-gray-500 dark:text-gray-400';
    let textColor = 'text-gray-800 dark:text-white';
    
    if (type === 'sdf') {
        bgColor = 'bg-blue-100 dark:bg-blue-900/10';
        borderColor = 'border-blue-500/40 dark:border-blue-500/20 border-dashed';
        size = isMobile ? 'w-10 h-10' : 'w-14 h-14';
        labelColor = 'text-blue-600 dark:text-blue-400';
        textColor = 'text-blue-700 dark:text-blue-300';
    } else if (assignedNode) {
        if (isOnline) {
            bgColor = type === 'validator' ? 'bg-green-500' : 'bg-purple-600';
            borderColor = type === 'validator' ? 'border-green-600' : 'border-purple-700';
            textColor = 'text-white';
        } else {
            bgColor = 'bg-red-500';
            borderColor = 'border-red-600';
            textColor = 'text-white';
        }
    }

    // Determine the label to show inside the circle
    let circleLabel = '?';
    if (type === 'sdf') {
        circleLabel = 'SDF';
    } else if (assignedNode && assignedNode.ordem) {
        // Use the new 'ordem' field if available, prefixed by role
        if (type === 'validator') circleLabel = `V${assignedNode.ordem}`;
        else if (type === 'watcher') circleLabel = `W${assignedNode.ordem}`;
        else circleLabel = assignedNode.ordem.toString();
    } else if (type === 'validator') {
        // Fallback: Extract the number from the title "Validator X"
        const match = title.match(/Validator (\d+)/);
        circleLabel = match ? `V${match[1]}` : (assignedNode ? `V${assignedNode.id}` : '?');
    } else if (type === 'watcher') {
        // Fallback for watcher
        const match = title.match(/Watcher (\d+)/);
        circleLabel = match ? `W${match[1]}` : (assignedNode ? `W${assignedNode.id}` : '?');
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
            ${isSelected ? 'ring-4 ring-white dark:ring-gray-300 scale-110 z-30' : 'hover:scale-105'} 
            ${bgColor} ${borderColor} relative
        `}>
            {type === 'sdf' ? (
                <span className={`text-[10px] ${textColor} font-bold opacity-70 ${isMobile ? 'text-[8px]' : ''}`}>SDF</span>
            ) : (
                <span className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold ${textColor} leading-none`}>{circleLabel}</span>
            )}

            {/* Online Indicator */}
            {assignedNode && type !== 'sdf' && (
                <div className={`absolute -top-1 -right-1 ${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></div>
            )}
        </div>

        {/* Label */}
        <div className={`mt-2 bg-white/90 dark:bg-gray-900/90 px-2 py-1 rounded text-center backdrop-blur-sm border border-gray-200 dark:border-gray-800 min-w-[90px] ${type === 'sdf' ? 'opacity-70' : ''} ${isMobile ? 'scale-75 origin-top' : ''}`}>
            <p className={`text-[9px] font-bold uppercase tracking-wider ${labelColor}`}>{title}</p>
            {assignedNode && (
                <p className="text-[10px] text-gray-900 dark:text-white font-mono truncate max-w-[110px]">{assignedNode.hostname}</p>
            )}
        </div>
      </div>
    );
  };


  // Generate Positions & Map Nodes to Coordinates
  const nodePositions: Record<string, { x: number, y: number }> = {};
  
  // 1. Validators
  const validatorPositions = Array.from({ length: 5 }).map((_, i) => getPosition(i, 5, VALIDATOR_RADIUS));
  validators.forEach((v, i) => {
      if (validatorPositions[i]) {
        nodePositions[v.id] = validatorPositions[i];
      }
  });

  // 2. SDF Nodes
  const sdfPositions = [
      getPosition(0, 1, SDF_RADIUS, -Math.PI/4),
      getPosition(0, 1, SDF_RADIUS, 0),
      getPosition(0, 1, SDF_RADIUS, Math.PI/4)
  ];
  sdfNodes.forEach((s, i) => {
      if (sdfPositions[i]) {
          nodePositions[s.id] = sdfPositions[i];
      }
  });

  // 3. Watchers
  const manualWatcherPositions = isMobile ? [
      { x: CENTER_X - 100 * scale, y: CENTER_Y + WATCHER_OFFSET_Y }, // Closer horizontal
      { x: CENTER_X,               y: CENTER_Y + WATCHER_OFFSET_Y + 40 * scale }, // Adjusted Y
      { x: CENTER_X + 100 * scale, y: CENTER_Y + WATCHER_OFFSET_Y }, // Closer horizontal
  ] : [
      { x: CENTER_X - 180, y: CENTER_Y + WATCHER_OFFSET_Y },
      { x: CENTER_X,       y: CENTER_Y + WATCHER_OFFSET_Y + 40 },
      { x: CENTER_X + 180, y: CENTER_Y + WATCHER_OFFSET_Y },
  ];
  watchers.forEach((w, i) => {
      if (manualWatcherPositions[i]) {
          nodePositions[w.id] = manualWatcherPositions[i];
      }
  });


  // Helper to determine line visibility based on selection
  const isConnectionVisible = (id1: string, id2: string) => {
      if (!selectedNodeId) return true;
      
      const selectedNode = nodes.find(n => n.id.toString() === selectedNodeId);
      if (!selectedNode) return false;

      // If SDF is selected, show incoming connections (who connects TO this SDF node)
      if (selectedNode.role === 'sdf_validator' || selectedNode.role === 'validator_sdf') {
          return selectedNodeId === id2;
      } 
      // If Validator is selected, show outgoing connections (peers) AND incoming from watchers
      else if (selectedNode.role === 'validator') {
          // Is it an outgoing connection? (selected -> peer)
          if (selectedNodeId === id1) return true;

          // Is it an incoming connection from a watcher? (watcher -> selected)
          const sourceNode = nodes.find(n => n.id.toString() === id1);
          if (sourceNode && sourceNode.role?.startsWith('watcher') && id2 === selectedNodeId) {
              return true;
          }

          return false;
      }
      // Otherwise (Watcher/Unassigned), show outgoing connections (who this node connects TO)
      else {
          return selectedNodeId === id1;
      }
  };

  // Helper to determine line opacity based on selection
  const getLineOpacity = (id1: string, id2: string, defaultOpacity: number) => {
    if (!selectedNodeId) return defaultOpacity;
    return isConnectionVisible(id1, id2) ? 1 : 0.05;
  };

  const getLineColor = (id1: string, id2: string, defaultColor: string) => {
      if (selectedNodeId && isConnectionVisible(id1, id2)) return '#FFFFFF'; // Highlight color
      return defaultColor;
  };
  
  const getLineWidth = (id1: string, id2: string, defaultWidth: string) => {
      if (selectedNodeId && isConnectionVisible(id1, id2)) return '2';
      return defaultWidth;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white dark:bg-gray-950 overflow-hidden">
      
      {/* Title Overlay */}
      <div className="absolute top-16 left-8 z-30 pointer-events-none">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Consensus Topology</h2>
        <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <p className="text-xs text-green-600 dark:text-green-400 font-mono">LIVE NETWORK</p>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">Click nodes to see connections • Double-click for details</p>
      </div>

      {/* Unassigned List (Bottom Right Floating) - Adjusted position to not overlap with panel */}
      {unassigned.length > 0 && (
          <div className="absolute bottom-32 right-4 bg-white/90 dark:bg-gray-900/90 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl z-30 max-w-xs backdrop-blur-md">
             <h4 className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                New Nodes Detected
             </h4>
             <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                 {unassigned.map(node => (
                     <div key={node.id} className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded" onClick={(e) => handleNodeClick(node.id.toString(), e)}>
                         <div className="flex flex-col">
                            <span className="font-bold text-gray-900 dark:text-white">{node.hostname}</span>
                            <span className="font-mono text-[10px] text-gray-500">{node.id}</span>
                         </div>
                         <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300 border border-gray-200 dark:border-gray-700">{node.ip_address}</span>
                     </div>
                 ))}
             </div>
          </div>
      )}

      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit={true}
        limitToBounds={false}
      >
        <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full">
            <div 
                className="relative" 
                style={{ width: dimensions.width, height: dimensions.height }}
                onClick={() => onNodeSelect(null)}
            >
                {/* Background Grid */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#4b5563_1px,transparent_1px)]" style={{ backgroundSize: '30px 30px' }}></div>
                <div 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-200 dark:border-blue-900/20 border-dashed pointer-events-none"
                    style={{ width: SDF_RADIUS * 2, height: SDF_RADIUS * 2 }}
                ></div>
                <div 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full border border-green-200 dark:border-green-900/20 pointer-events-none"
                    style={{ width: VALIDATOR_RADIUS * 2, height: VALIDATOR_RADIUS * 2 }}
                ></div>

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

                    {/* Draw Connections based on 'peers' data */}
                    {nodes.map(node => {
                        if (!node.peers || node.peers.length === 0) return null;
                        const sourcePos = nodePositions[node.id];
                        if (!sourcePos) return null;

                        return node.peers.map(peerId => {
                            const targetPos = nodePositions[peerId];
                            if (!targetPos) return null;

                            // Unique key for line
                            const key = `link-${node.id}-${peerId}`;
                            
                            // Determine style based on roles involved
                            const isSdfLink = node.role === 'sdf_validator' || node.role === 'validator_sdf' || 
                                              nodes.find(n => n.id.toString() === peerId.toString())?.role === 'sdf_validator' || 
                                              nodes.find(n => n.id.toString() === peerId.toString())?.role === 'validator_sdf';
                            
                            return (
                                <line 
                                    key={key}
                                    x1={sourcePos.x} y1={sourcePos.y}
                                    x2={targetPos.x} y2={targetPos.y}
                                    stroke={getLineColor(node.id.toString(), peerId.toString(), isSdfLink ? "#3B82F6" : "#10B981")}
                                    strokeWidth={getLineWidth(node.id.toString(), peerId.toString(), "1.5")}
                                    strokeOpacity={getLineOpacity(node.id.toString(), peerId.toString(), isSdfLink ? 0.3 : 0.2)}
                                    strokeDasharray={isSdfLink ? "4,4" : undefined}
                                    className="transition-all duration-300"
                                />
                            );
                        });
                    })}

                </svg>

                {/* Render SDF Nodes */}
                {sdfNodes.map((node, i) => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;
                    return (
                        <React.Fragment key={`sdf-node-${node.id}`}>
                            {renderNode(`SDF Core ${i+1}`, node, 'sdf', pos.x, pos.y, node.id.toString())}
                        </React.Fragment>
                    );
                })}

                {/* Render Validators */}
                {validators.map((node, i) => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;
                    return (
                        <React.Fragment key={`v-node-${node.id}`}>
                            {renderNode(`Validator ${i + 1}`, node, 'validator', pos.x, pos.y, node.id.toString())}
                        </React.Fragment>
                    );
                })}
                
                {/* If we have empty validator slots (less than 5), render placeholders */}
                {Array.from({ length: 5 - validators.length }).map((_, i) => {
                    const idx = validators.length + i;
                    const pos = validatorPositions[idx];
                    return (
                        <div 
                            key={`v-placeholder-${idx}`}
                            className="absolute w-20 h-20 rounded-full border-4 border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900/50 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
                            style={{ left: pos.x, top: pos.y }}
                        >
                            <span className="text-gray-400 dark:text-gray-700 font-bold text-2xl">?</span>
                        </div>
                    );
                })}

                {/* Render Watchers */}
                {watchers.map((node, i) => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;
                    return (
                        <React.Fragment key={`w-node-${node.id}`}>
                            {renderNode(`Watcher ${i + 1}`, node, 'watcher', pos.x, pos.y, node.id.toString())}
                        </React.Fragment>
                    );
                })}
            </div>
        </TransformComponent>
      </TransformWrapper>

    </div>
  );
};

export default NetworkGraph;