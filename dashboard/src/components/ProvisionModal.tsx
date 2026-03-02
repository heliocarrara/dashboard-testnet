'use client';

import React, { useState } from 'react';

interface ProvisionModalProps {
  validatorCount: number;
  onSuccess: () => void;
}

const ProvisionModal: React.FC<ProvisionModalProps> = ({ validatorCount, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProvision = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/provision', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to provision');
      onSuccess();
    } catch (err) {
      setError('Error provisioning nodes');
    } finally {
      setLoading(false);
    }
  };

  if (validatorCount >= 5) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
      <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-white">Auto-Configure Core</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Current Validators: <span className="font-bold">{validatorCount}/5</span></p>
      
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-2 mb-4">
        <p className="text-xs text-yellow-700 dark:text-yellow-400">Need at least 5 validators to launch the network.</p>
      </div>

      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      
      <button
        onClick={handleProvision}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50 transition-colors"
      >
        {loading ? 'Provisioning...' : 'Auto-Provision 5 Validators'}
      </button>
    </div>
  );
};

export default ProvisionModal;
