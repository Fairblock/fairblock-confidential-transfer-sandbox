
'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useConfidentialClient } from './hooks/useConfidentialClient';
import { Toaster, toast } from 'sonner';
import { supportedChains } from './Providers';

export default function Dashboard() {
  const { login, logout, authenticated, user } = usePrivy();
  const { 
      config,
      setConfig,
      ensureAccount, 
      fetchBalances, 
      confidentialDeposit, 
      confidentialTransfer, 
      withdraw, 
      balances, 
      userKeys,
      loading, 
      error,
      tokenSymbol, 
      lastTxHash,
  } = useConfidentialClient();

  const [depositAmount, setDepositAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Helper to handle transactions with toast notifications
  const handleTransaction = async (
    actionName: string, 
    action: () => Promise<{ hash: string }>
  ) => {
    const toastId = toast.loading(`Processing ${actionName}...`);
    try {
      const { hash } = await action();
      toast.success(`${actionName} Successful!`, {
        id: toastId,
        description: (
          <a 
            href={`${config.explorerUrl}${hash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline text-blue-600 hover:text-blue-800"
          >
            View on Explorer
          </a>
        ),
        duration: 5000,
      });
      // Clear inputs
      setDepositAmount('');
      setTransferAmount('');
      setWithdrawAmount('');
    } catch (err: any) {
      toast.error(`${actionName} Failed`, {
        id: toastId,
        description: err.message || 'Unknown error occurred',
      });
    }
  };

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold mb-8">@fairblock/stabletrust-demo</h1>
        <button onClick={login} className="btn-primary text-xl px-8 py-4">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <Toaster position="top-right" />
      
      <header className="flex justify-between items-center mb-6 border-b border-black pb-4">
        <div>
            <h1 className="text-2xl font-bold">@fairblock/stabletrust-demo</h1>
            <a 
              href="https://www.npmjs.com/package/@fairblock/stabletrust" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline hover:text-blue-800"
            >
              npm package
            </a>
            <p className="text-xs text-gray-500 mt-1">
                Connected: {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
            </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
             <span className="text-gray-500 mr-1">Network:</span>
             {supportedChains.find(c => c.id === config.chainId)?.name || `Unknown (${config.chainId})`}
          </div>
          <button 
            onClick={() => setShowConfig(!showConfig)} 
            className="text-sm underline text-gray-600 hover:text-black"
          >
            {showConfig ? 'Hide Config' : 'Configure Chain'}
          </button>
          <button onClick={logout} className="btn-secondary text-sm">
            Disconnect
          </button>
        </div>
      </header>

      {showConfig && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold mb-1">RPC URL</label>
                <input 
                    className="input-primary text-xs" 
                    value={config.rpcUrl}
                    onChange={(e) => setConfig({...config, rpcUrl: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-xs font-bold mb-1">Contract Address</label>
                <input 
                    className="input-primary text-xs" 
                    value={config.contractAddress}
                    onChange={(e) => setConfig({...config, contractAddress: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-xs font-bold mb-1">Token Address</label>
                <input 
                    className="input-primary text-xs" 
                    value={config.tokenAddress}
                    onChange={(e) => setConfig({...config, tokenAddress: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-xs font-bold mb-1">Explorer URL</label>
                <input 
                    className="input-primary text-xs" 
                    value={config.explorerUrl}
                    onChange={(e) => setConfig({...config, explorerUrl: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-xs font-bold mb-1">Chain ID</label>
                <input 
                    className="input-primary text-xs" 
                    type="number"
                    value={config.chainId}
                    onChange={(e) => setConfig({...config, chainId: parseInt(e.target.value) || 0})}
                />
            </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="text-2xl font-bold animate-pulse">Processing...</div>
        </div>
      )}

      {lastTxHash && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded relative mb-6 text-center">
              <span className="font-bold mr-2">Latest Transaction:</span>
              <a 
                href={`${config.explorerUrl}${lastTxHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-green-900 break-all"
              >
                {lastTxHash}
              </a>
          </div>
      )}

      {!userKeys ? (
        <div className="card text-center py-12">
          <h2 className="text-xl mb-4">Initialize Confidential Account</h2>
          <p className="mb-6 text-gray-600">You need to derive keys to access confidential features.</p>
          <button onClick={ensureAccount} className="btn-primary" disabled={loading}>
            Create / Access Account
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Balances Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm text-gray-500 mb-1">Public Balance</h3>
              <p className="text-2xl font-mono">{balances.public} {tokenSymbol}</p>
            </div>
            <div className="card">
              <h3 className="text-sm text-gray-500 mb-1">Confidential Balance</h3>
              <p className="text-2xl font-mono">{balances.confidential} {tokenSymbol}</p>
            </div>
             <button onClick={() => fetchBalances()} className="btn-secondary w-full md:col-span-2" disabled={loading}>
                Refresh Balances
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Deposit Section */}
            <div className="card">
              <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">Deposit</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">Amount</label>
                  <input 
                    type="number" 
                    value={depositAmount} 
                    onChange={(e) => setDepositAmount(e.target.value)} 
                    className="input-primary" 
                    placeholder="0.0" 
                  />
                </div>
                <button 
                  onClick={() => handleTransaction('Deposit', () => confidentialDeposit(depositAmount))} 
                  disabled={loading || !depositAmount} 
                  className="btn-primary w-full"
                >
                  Deposit to Confidential
                </button>
              </div>
            </div>

            {/* Transfer Section */}
             <div className="card">
              <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">Transfer</h2>
              <div className="space-y-4">
                <div>
                   <label className="block text-sm mb-1">Recipient Address</label>
                   <input 
                     type="text" 
                     value={recipient} 
                     onChange={(e) => setRecipient(e.target.value)} 
                     className="input-primary" 
                     placeholder="0x..." 
                   />
                </div>
                <div>
                  <label className="block text-sm mb-1">Amount</label>
                  <input 
                    type="number" 
                    value={transferAmount} 
                    onChange={(e) => setTransferAmount(e.target.value)} 
                    className="input-primary" 
                    placeholder="0.0" 
                  />
                </div>
                <button 
                  onClick={() => handleTransaction('Transfer', () => confidentialTransfer(recipient, transferAmount))} 
                  disabled={loading || !transferAmount || !recipient} 
                  className="btn-primary w-full"
                >
                  Transfer Confidentially
                </button>
                <div className="pt-2 border-t border-gray-200 mt-2">
                    <button
                        onClick={() => {
                            setRecipient("0x30626CD95A17fD54A5e3291c2daFDf46D2786425");
                            const amount = "0.01";
                            setTransferAmount(amount);
                            // small delay to allow state update before transaction? 
                            // actually handleTransaction takes a function, so we can just call it directly with values
                            // BUT confidentialTransfer takes args. 
                            // The cleanest way is to just set state and let user click, OR perform it immediately.
                            // Request says "send the taransaction", implying immediate action or easy filling.
                            // "just a small buttion to send the taransaction" -> implies action.
                            // I will make it perform the transaction immediately for "Send to Demo" feeling.
                            handleTransaction('Demo Transfer', () => confidentialTransfer("0x30626CD95A17fD54A5e3291c2daFDf46D2786425", "0.01"));
                        }}
                        className="text-xs text-blue-600 underline hover:text-blue-800 w-full text-center"
                    >
                        Send 0.01 to Demo Account
                    </button>
                </div>
              </div>
            </div>
             {/* Withdraw Section */}
             <div className="card md:col-span-2">
              <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">Withdraw</h2>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm mb-1">Amount</label>
                  <input 
                    type="number" 
                    value={withdrawAmount} 
                    onChange={(e) => setWithdrawAmount(e.target.value)} 
                    className="input-primary" 
                    placeholder="0.0" 
                  />
                </div>
                <button 
                  onClick={() => handleTransaction('Withdraw', () => withdraw(withdrawAmount))} 
                  disabled={loading || !withdrawAmount} 
                  className="btn-secondary w-auto whitespace-nowrap"
                >
                  Withdraw to Public
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
