
'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';

interface Node {
  id: number;
  hostname: string;
  ip_address: string;
  public_key: string;
  role: string | null;
  quorum_group: number | null;
  node_seed: string;
  created_at: string;
}

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nodes');
      const data = await res.json();
      setNodes(data);
    } catch (error) {
      console.error('Failed to fetch nodes', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleUpdate = async (node: Node) => {
    setSaving(node.id);
    try {
      await fetch('/api/nodes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: node.id,
          role: node.role,
          quorum_group: node.quorum_group,
        }),
      });
      alert(`Node ${node.hostname} updated!`);
    } catch (error) {
      console.error('Failed to update node', error);
      alert('Failed to update node');
    } finally {
      setSaving(null);
    }
  };

  const handleChange = (id: number, field: keyof Node, value: string | number) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === id ? { ...node, [field]: value } : node))
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400">🌌 Stellar Testnet Manager</h1>
          <button
            onClick={fetchNodes}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            <RefreshCw size={18} /> Refresh
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-xl border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-700 text-gray-300 uppercase text-sm">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Hostname</th>
                  <th className="px-6 py-3">IP Address</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Quorum Group</th>
                  <th className="px-6 py-3">Public Key (Short)</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Loading nodes...
                    </td>
                  </tr>
                ) : nodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No nodes found. Run the setup script on your machines first.
                    </td>
                  </tr>
                ) : (
                  nodes.map((node) => (
                    <tr key={node.id} className="hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-gray-400">#{node.id}</td>
                      <td className="px-6 py-4 font-medium text-white">{node.hostname}</td>
                      <td className="px-6 py-4 font-mono text-sm text-blue-300">
                        {node.ip_address || 'Pending...'}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={node.role || ''}
                          onChange={(e) => handleChange(node.id, 'role', e.target.value)}
                          className="bg-gray-900 border border-gray-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                        >
                          <option value="">Select Role</option>
                          <option value="validator">Validator</option>
                          <option value="watcher">Watcher</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={node.quorum_group || ''}
                          onChange={(e) =>
                            handleChange(node.id, 'quorum_group', parseInt(e.target.value) || 0)
                          }
                          className="bg-gray-900 border border-gray-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-20 p-2.5"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500" title={node.public_key}>
                        {node.public_key ? `${node.public_key.substring(0, 6)}...${node.public_key.substring(node.public_key.length - 6)}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleUpdate(node)}
                          disabled={saving === node.id}
                          className="text-green-400 hover:text-green-300 disabled:opacity-50 transition-colors"
                          title="Save Changes"
                        >
                          <Save size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-blue-400">Instructions</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
              <li>Run the setup script on each machine.</li>
              <li>Wait for the machine to appear in this list.</li>
              <li>Assign a <strong>Role</strong> (Validator or Watcher).</li>
              <li>Assign a <strong>Quorum Group</strong> if needed (default 0).</li>
              <li>Click the <strong>Save</strong> icon.</li>
              <li>Restart the node script if necessary to pick up changes.</li>
            </ol>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-green-400">Topology Info</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li><strong className="text-white">Validators:</strong> Connect to other local Validators + SDF nodes. Participate in consensus.</li>
              <li><strong className="text-white">Watchers:</strong> Connect to local Validators. Do not vote, but archive history.</li>
              <li><strong className="text-white">Quorum:</strong> Ensure Validators trust SDF to avoid network forks.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
