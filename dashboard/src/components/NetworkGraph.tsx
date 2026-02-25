'use client';

import React, { useCallback, useMemo } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface NetworkNode {
  id: string;
  hostname: string;
  role: string | null;
  quorum_group: number | null;
  status: string;
  config_status: string;
}

interface NetworkGraphProps {
  nodes: NetworkNode[];
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ nodes }) => {
  // Define SDF Nodes (Layer 1)
  const sdfNodes: Node[] = [
    { id: 'sdf-1', position: { x: 100, y: 0 }, data: { label: 'SDF Core 1' }, type: 'input', style: { background: '#eee', color: '#333', border: '1px solid #777' } },
    { id: 'sdf-2', position: { x: 300, y: 0 }, data: { label: 'SDF Core 2' }, type: 'input', style: { background: '#eee', color: '#333', border: '1px solid #777' } },
    { id: 'sdf-3', position: { x: 500, y: 0 }, data: { label: 'SDF Core 3' }, type: 'input', style: { background: '#eee', color: '#333', border: '1px solid #777' } },
  ];

  // Process Local Nodes
  const validatorNodes = nodes.filter(n => n.role === 'validator');
  const watcherNodes = nodes.filter(n => n.role === 'watcher');
  const unconfiguredNodes = nodes.filter(n => !n.role || n.role === 'none');

  // Layer 2: Validators
  const layer2Nodes: Node[] = validatorNodes.map((node, index) => ({
    id: `node-${node.id}`,
    position: { x: 100 + (index * 150), y: 200 },
    data: { label: `${node.hostname} (Validator)` },
    style: { 
      background: node.status === 'online' ? '#10B981' : '#F59E0B', 
      color: '#fff', 
      border: '1px solid #777',
      width: 150
    },
  }));

  // Layer 3: Watchers
  const layer3Nodes: Node[] = watcherNodes.map((node, index) => ({
    id: `node-${node.id}`,
    position: { x: 100 + (index * 150), y: 400 },
    data: { label: `${node.hostname} (Watcher)` },
    style: { background: '#3B82F6', color: '#fff', width: 150 },
  }));

  // Unconfigured Nodes (floating somewhere or ignored? Maybe distinct layer)
  const unconfiguredLayerNodes: Node[] = unconfiguredNodes.map((node, index) => ({
    id: `node-${node.id}`,
    position: { x: 100 + (index * 150), y: 600 },
    data: { label: `${node.hostname} (Unconfigured)` },
    style: { background: '#9CA3AF', color: '#fff', width: 150 },
  }));

  const flowNodes: Node[] = [...sdfNodes, ...layer2Nodes, ...layer3Nodes, ...unconfiguredLayerNodes];

  // Edges
  // Connect SDF to Validators
  const sdfEdges: Edge[] = [];
  layer2Nodes.forEach(vNode => {
    sdfNodes.forEach(sdfNode => {
      sdfEdges.push({ id: `e-${sdfNode.id}-${vNode.id}`, source: sdfNode.id, target: vNode.id, animated: true, style: { stroke: '#ccc' } });
    });
  });

  // Connect Validators to each other (mesh)
  const validatorEdges: Edge[] = [];
  for (let i = 0; i < layer2Nodes.length; i++) {
    for (let j = i + 1; j < layer2Nodes.length; j++) {
      validatorEdges.push({
        id: `e-${layer2Nodes[i].id}-${layer2Nodes[j].id}`,
        source: layer2Nodes[i].id,
        target: layer2Nodes[j].id,
        style: { stroke: '#10B981' },
      });
    }
  }

  // Connect Watchers to Validators
  const watcherEdges: Edge[] = [];
  layer3Nodes.forEach(wNode => {
    layer2Nodes.forEach(vNode => {
      watcherEdges.push({
        id: `e-${vNode.id}-${wNode.id}`,
        source: vNode.id,
        target: wNode.id,
        animated: true,
        style: { stroke: '#3B82F6' },
      });
    });
  });

  const edges: Edge[] = [...sdfEdges, ...validatorEdges, ...watcherEdges];

  return (
    <div style={{ height: '600px', width: '100%', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
      <ReactFlow nodes={flowNodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default NetworkGraph;
