
'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useConfidentialClient } from './hooks/useConfidentialClient';
import { parseError } from './utils/errorParser';
import { Toaster, toast } from 'sonner';
import { supportedChains } from './Providers';

export default function Dashboard() {
  const { login, logout, authenticated, user } = usePrivy();
  const { 
      config,

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

  const [faucetLoading, setFaucetLoading] = useState(false);

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
      console.error(err); // Log full error for debugging
      const errorMessage = parseError(err);
      toast.error(`${actionName} Failed`, {
        id: toastId,
        description: errorMessage,
      });
    }
  };

  const handleFaucetRequest = async () => {
    if (!user?.wallet?.address) return;
    setFaucetLoading(true);
    const toastId = toast.loading('Requesting 0.25 USDT0...');
    try {
        const response = await fetch('/api/faucet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: user.wallet.address }),
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Faucet request failed');
        
        toast.success('Funds Received!It will take a few seconds to appear in your wallet', {
            id: toastId,
            description: (
                <a 
                  href={`${config.explorerUrl}${data.hash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline text-blue-600 hover:text-blue-800"
                >
                  View Transaction
                </a>
            ),
            duration: 5000,
        });
        // Refresh balances to update UI
        fetchBalances();
        // Retry fetching after a few seconds to allow for indexing
        setTimeout(fetchBalances, 3000);
        setTimeout(fetchBalances, 6000);
    } catch (err: any) {
        const errorMessage = parseError(err);
        toast.error('Faucet Failed', {
            id: toastId,
            description: errorMessage,
        });
    } finally {
        setFaucetLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold mb-8">Fairblock Confidential Transfer Sandbox</h1>
        <button onClick={login} className="btn-primary text-xl px-8 py-4">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <Toaster position="top-right" />
      
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-black pb-4 gap-4 md:gap-0">
        <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold">Fairblock Confidential Transfer Sandbox</h1>
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
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
          <button 
            onClick={handleFaucetRequest}
            disabled={faucetLoading}
            className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full border border-yellow-200 hover:bg-yellow-200 disabled:opacity-50 whitespace-nowrap"
          >
            Get 0.25 USDT0
          </button>
          <div className="text-sm font-medium bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200 whitespace-nowrap flex items-center">
             <span className="text-gray-500 mr-1">Network:</span>
             {supportedChains.find(c => c.id === config.chainId)?.name || `Unknown (${config.chainId})`}
          </div>

          <button onClick={logout} className="btn-secondary text-sm px-4 py-1.5">
            Disconnect
          </button>
        </div>
      </header>



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
            {parseFloat(balances.native) < 0.01 ? (
                <>
                    <h2 className="text-xl mb-4">Insufficient Funds</h2>
                    <p className="mb-6 text-gray-600">You need testnet tokens (USDT0/ETH) to pay for gas fees.</p>
                    <button 
                        onClick={handleFaucetRequest} 
                        className="btn-primary bg-green-600 hover:bg-green-700 border-green-700"
                        disabled={faucetLoading}
                    >
                        {faucetLoading ? 'Sending funds...' : 'Get 0.25 USDT0 Now'}
                    </button>
                     <p className="mt-4 text-xs text-gray-400">
                        Funds are sent directly to your wallet on the Stable Testnet.
                    </p>
                </>
            ) : (
                <>
                    <h2 className="text-xl mb-4">Initialize Confidential Account</h2>
                    <p className="mb-6 text-gray-600">You need to derive keys to access confidential features.</p>
                    <button onClick={ensureAccount} className="btn-primary" disabled={loading}>
                        Create / Access Account
                    </button>
                </>
            )}
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
              {parseFloat(balances.confidential) <= 0 ? (
                  <div className="text-center py-8 text-gray-500">
                      <p>You need a confidential balance to transfer.</p>
                      <p className="text-sm mt-1">Please deposit funds first.</p>
                  </div>
              ) : (
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
                                // Just fill the inputs, don't auto-submit to let user review
                                setTransferAmount("0.01");
                            }}
                            className="text-xs text-blue-600 underline hover:text-blue-800 w-full text-center"
                        >
                            Fill Demo Transfer (0.01 to Alice)
                        </button>
                    </div>
                </div>
              )}
            </div>

             {/* Withdraw Section */}
             <div className="card md:col-span-2">
              <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">Withdraw</h2>
               {parseFloat(balances.confidential) <= 0 ? (
                  <div className="text-center py-4 text-gray-500">
                      <p>You need a confidential balance to withdraw.</p>
                  </div>
              ) : (
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
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
