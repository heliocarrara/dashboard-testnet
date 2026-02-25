'use client';

import React, { useState } from 'react';

const TransactionInjection: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleInject = async () => {
    setLoading(true);
    setStatus('Injecting transactions...');
    try {
      const res = await fetch('/api/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'G...', // Placeholder
          destination: 'G...', // Placeholder
          amount: '100',
          batchSize: 100
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.message);
      } else {
        setStatus('Failed to inject transactions');
      }
    } catch (err) {
      console.error(err);
      setStatus('Error connecting to server');
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mt-4">
      <h3 className="text-lg font-bold mb-2 text-gray-800">Transaction Injection (Stress Test)</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
            <label className="block text-sm font-medium text-gray-700">Source Account</label>
            <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="G..." disabled />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700">Destination Account</label>
            <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="G..." disabled />
        </div>
      </div>
      <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700">Batch Size</label>
            <input type="number" className="mt-1 block w-24 border border-gray-300 rounded-md shadow-sm p-2" defaultValue={100} />
          </div>
          <button
            onClick={handleInject}
            disabled={loading}
            className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Injecting...' : 'Inject Transactions'}
          </button>
      </div>
      {status && <p className="text-green-600 text-sm mt-2">{status}</p>}
    </div>
  );
};

export default TransactionInjection;
