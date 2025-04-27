"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Address, Balance } from "~~/components/scaffold-eth";
import { useFlarePrices } from "~~/hooks/flare/useFlarePrices";
import { notification } from "~~/utils/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";

const Home: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [lotteryAmount, setLotteryAmount] = useState<string>("1");
  const [totalPrizePool, setTotalPrizePool] = useState<string>("0");
  
  // Get price feeds from Flare
  const { flrUsd, btcUsd, ethUsd, refreshPrices } = useFlarePrices();

  // Get contract info
  const contractInfo = deployedContracts[114]?.VolatilityLottery;
  const contractAddress = contractInfo?.address;
  const contractAbi = contractInfo?.abi;

  // Read contract data
  const { data: lotteryEndTime, refetch: refetchLotteryEndTime } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "lotteryEndTime",
  });

  const { data: lotteryThreshold, refetch: refetchLotteryThreshold } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "lotteryThreshold",
  });

  const { data: isRoundActive, refetch: refetchIsRoundActive } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "isRoundActive",
  });

  const { data: roundId, refetch: refetchRoundId } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "roundId",
  });

  const { data: participantBalance, refetch: refetchParticipantBalance } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "participantBalances",
    args: [connectedAddress || "0x0000000000000000000000000000000000000000"],
  });

  // Write contract functions
  const { 
    writeContractAsync, 
    isPending: isWritePending, 
    data: txHash 
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed
  } = useWaitForTransactionReceipt({ 
    hash: txHash 
  });

  // Fetch contract balance to display prize pool
  useEffect(() => {
    const fetchContractBalance = async () => {
      if (contractAddress) {
        try {
          const response = await fetch(`https://coston2-api.flare.network/ext/C/rpc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_getBalance',
              params: [contractAddress, 'latest']
            })
          });
          
          const data = await response.json();
          if (data.result) {
            // Convert hex to decimal and format
            const balanceInWei = BigInt(data.result);
            setTotalPrizePool(formatEther(balanceInWei));
          }
        } catch (error) {
          console.error("Error fetching contract balance:", error);
        }
      }
    };

    fetchContractBalance();
    // Set up interval to refresh every 30 seconds
    const intervalId = setInterval(fetchContractBalance, 30000);
    
    return () => clearInterval(intervalId);
  }, [contractAddress, isConfirmed]);

  // Handle starting a new round
  const handleStartRound = async () => {
    if (!contractAddress || !contractAbi) {
      notification.error("Contract configuration not found");
      return;
    }
    
    try {
      await writeContractAsync({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'startRound',
      });
      notification.success("Round start transaction submitted!");
    } catch (error: any) {
      console.error("Error starting round:", error);
      notification.error(`Failed to start round: ${error.message}`);
    }
  };

  // Handle entering the lottery
  const handleEnterLottery = async () => {
    if (!isConnected) {
      notification.error("Please connect your wallet first");
      return;
    }

    if (!contractAddress || !contractAbi || !isRoundActive) {
      notification.error(isRoundActive ? "Contract configuration not found" : "No active round");
      return;
    }
    
    try {
      const amount = parseEther(lotteryAmount || "1");
      await writeContractAsync({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'enterLottery',
        args: [amount],
        value: amount,
      });
      notification.success(`Lottery entry transaction submitted!`);
    } catch (error: any) {
      console.error("Error entering lottery:", error);
      notification.error(`Failed to enter lottery: ${error.message}`);
    }
  };

  // Handle funding the lottery
  const handleFundLottery = async () => {
    if (!isConnected) {
      notification.error("Please connect your wallet first");
      return;
    }

    if (!contractAddress || !contractAbi) {
      notification.error("Contract configuration not found");
      return;
    }
    
    try {
      const amount = parseEther(lotteryAmount || "1");
      await writeContractAsync({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'fundLottery',
        value: amount,
      });
      notification.success(`Lottery funding transaction submitted!`);
    } catch (error: any) {
      console.error("Error funding lottery:", error);
      notification.error(`Failed to fund lottery: ${error.message}`);
    }
  };

  // Handle checking and ending round
  const handleCheckAndEndRound = async () => {
    if (!isConnected) {
      notification.error("Please connect your wallet first");
      return;
    }

    if (!contractAddress || !contractAbi) {
      notification.error("Contract configuration not found");
      return;
    }
    
    try {
      await writeContractAsync({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'checkAndEndRound',
      });
      notification.success(`Check and end round transaction submitted!`);
    } catch (error: any) {
      console.error("Error checking round:", error);
      notification.error(`Failed to check round: ${error.message}`);
    }
  };

  // Effect to refetch data when transaction is confirmed
  useEffect(() => {
    if (isConfirmed && txHash) {
      notification.success("Transaction confirmed successfully!");
      refetchLotteryEndTime();
      refetchLotteryThreshold();
      refetchParticipantBalance();
      refetchIsRoundActive();
      refetchRoundId();
      refreshPrices(); // Refresh prices when a transaction is confirmed
    }
  }, [isConfirmed, txHash, refetchLotteryEndTime, refetchLotteryThreshold, refetchParticipantBalance, refetchIsRoundActive, refetchRoundId, refreshPrices]);

  // Timer for lottery countdown
  useEffect(() => {
    if (!lotteryEndTime || lotteryEndTime === 0n) return;

    const endTime = Number(lotteryEndTime) * 1000; // Convert to milliseconds
    const now = Date.now();
    const difference = endTime - now;

    if (difference <= 0) {
      setTimeLeft(0);
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const difference = endTime - now;

      if (difference <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        return;
      }

      setTimeLeft(Math.floor(difference / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [lotteryEndTime]);

  // Format time left as minutes:seconds
  const formatTimeLeft = () => {
    if (timeLeft <= 0) return "Ended";
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Check if player has participated
  const hasParticipated = participantBalance && participantBalance > 0n;
  
  // Lottery status helpers - use isRoundActive from contract
  const lotteryActive = isRoundActive === true;
  const lotteryEnded = isRoundActive === false && lotteryEndTime && lotteryEndTime > 0n && timeLeft === 0;
  const needsEndingCheck = lotteryActive && timeLeft === 0;

  // Transaction status
  const isTransactionPending = isWritePending || isConfirming;

  // Format threshold for display
  const formattedThreshold = lotteryThreshold ? (Number(lotteryThreshold) / 1e18).toFixed(2) : "1.00";

  // Get status label and color
  const getStatusLabel = () => {
    if (lotteryActive) return { text: "Active", color: "text-success" };
    if (lotteryEnded) return { text: "Ended", color: "text-error" };
    return { text: "Not Started", color: "text-warning" };
  };

  const statusLabel = getStatusLabel();
  

  return (
    <div className="flex items-center flex-col flex-grow py-10" style={{ backgroundColor: "#fff0f5" }}>
      <div className="px-5 w-full md:max-w-4xl">
        {/* Top Section - How to Play on left, Logo and Status on right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* How to Play Card - Left */}
          <div className="card shadow-xl h-full" style={{ backgroundColor: "white" }}>
            <div className="card-body">
              <h2 className="card-title" style={{ color: "#d1456f" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "#d1456f" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How To Play
              </h2>
              
              <ol className="list-decimal list-inside space-y-2 ml-2" style={{ color: "#d1456f" }}>
                <li>Enter the lottery with FLR during an active round.</li>
                <li>A round activates when price volatility exceeds the threshold.</li>
                <li>Each round lasts 10 minutes or until manually ended.</li>
                <li>After a round ends, a random winner gets the entire prize pool.</li>
                <li>The more FLR you contribute, the higher your chance of winning!</li>
              </ol>
              
              <div className="mt-auto">
                <div className="stats shadow w-full" style={{ backgroundColor: "#ffd6e7" }}>
                  <div className="stat" style={{ backgroundColor: "white" }}>
                    <div className="stat-title" style={{ color: "#d1456f" }}>Prize Pool</div>
                    <div className="stat-value" style={{ color: "#ff4791" }}>{parseFloat(totalPrizePool).toFixed(2)} FLR</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Logo and Status Card - Right */}
          <div className="card shadow-xl h-full" style={{ backgroundColor: "white" }}>
            <div className="card-body flex flex-col items-center justify-between">
              <div className="flex flex-col items-center">
                {/* Logo */}
                <div className="mb-4">
                  <Image 
                    src="/logo_game_bg.png" 
                    alt="Volatility Lottery Logo" 
                    width={150} 
                    height={150} 
                    className="rounded-xl"
                  />
                </div>
                
                {/* Tagline */}
                <p className="text-center mb-4" style={{ color: "#d1456f" }}>
                  Win big based on real-time price volatility using Flare's secure on-chain oracles!
                </p>
              </div>
              
              {/* Current Status */}
              <div className="w-full">
                <h3 className="font-bold text-lg mb-3 text-center" style={{ color: "#d1456f" }}>Current Status</h3>
                <div className="flex justify-center mb-2">
                  <div className="badge badge-lg" style={{ backgroundColor: lotteryActive ? "#ffc2d6" : lotteryEnded ? "#ffb3c6" : "#ffd6e7", color: "#d1456f" }}>
                    {statusLabel.text}
                  </div>
                </div>
                
                <div className="divider my-1" style={{ backgroundColor: "#ffd6e7", height: "2px" }}></div>
                
                {/* Status Details */}
                <div className="space-y-2 my-2">
                  <div className="flex justify-between">
                    <span style={{ color: "#d1456f" }}>Volatility Threshold:</span>
                    <span className="font-bold" style={{ color: "#ff4791" }}>{formattedThreshold}%</span>
                  </div>

                  {lotteryActive && timeLeft > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: "#d1456f" }}>Time Remaining:</span>
                      <span className="font-mono px-2 py-1 rounded" style={{ backgroundColor: "#ffd6e7", color: "#d1456f" }}>{formatTimeLeft()}</span>
                    </div>
                  )}
                  
                  {hasParticipated && (
                    <div className="flex justify-between">
                      <span style={{ color: "#d1456f" }}>Your Entry:</span>
                      <span className="font-bold" style={{ color: "#ff4791" }}>{participantBalance ? formatEther(participantBalance) : "0"} FLR</span>
                    </div>
                  )}
                </div>
                
                {/* Connected Address */}
                {isConnected && (
                  <div className="mt-4 mb-2 p-2 rounded-lg" style={{ backgroundColor: "#fff0f5" }}>
                    <div className="flex flex-col sm:flex-row items-center justify-between text-sm">
                      <span className="mb-2 sm:mb-0" style={{ color: "#d1456f" }}>Connected:</span>
                      <div className="flex items-center" style={{ color: "#d1456f" }}>
                        <Address address={connectedAddress} size="sm" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Status */}
        {txHash && (
          <div className="alert shadow-lg mb-6" style={{ backgroundColor: "#ffd6e7" }}>
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current flex-shrink-0 w-6 h-6" style={{ color: "#d1456f" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div>
                <h3 className="font-bold" style={{ color: "#d1456f" }}>Transaction Submitted</h3>
                <div className="text-xs" style={{ color: "#d1456f" }}>
                  <a 
                    href={`https://coston2-explorer.flare.network/tx/${txHash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="link link-hover"
                    style={{ color: "#ff4791" }}
                  >
                    {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </a>
                  <div className="mt-1">
                    {isConfirming && <span className="flex items-center"><span className="loading loading-spinner loading-xs mr-1"></span>Confirming...</span>}
                    {isConfirmed && <span style={{ color: "#008000" }}>Transaction confirmed!</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid - Everything else below */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Enter Lottery Card */}
          <div className="card shadow-xl" style={{ backgroundColor: "white" }}>
            <div className="card-body">
              <h2 className="card-title" style={{ color: "#d1456f" }}>
                Enter Lottery
                {!lotteryActive && <div className="badge badge-warning" style={{ backgroundColor: "#ffd6e7", color: "#d1456f" }}>No Active Round</div>}
              </h2>
              
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-medium" style={{ color: "#d1456f" }}>Amount (FLR)</span>
                  {!isConnected && <span className="label-text-alt" style={{ color: "#ff4791" }}>Connect wallet to participate</span>}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="Enter amount in FLR" 
                    className="input input-bordered w-full" 
                    value={lotteryAmount}
                    onChange={(e) => setLotteryAmount(e.target.value)}
                    min="0.1"
                    step="0.1"
                    style={{ borderColor: "#ffd6e7", backgroundColor: "#ffd6e7", color: "#d1456f" }}
                  />
                  <button 
                    className="btn btn-xs btn-circle btn-ghost text-lg"
                    onClick={() => setLotteryAmount("1")}
                    title="Reset to 1 FLR"
                    style={{ color: "#d1456f" }}
                  >
                    ↺
                  </button>
                </div>
                <label className="label">
                  <span className="label-text-alt" style={{ color: "#d1456f" }}>Min 0.1 FLR</span>
                  <button 
                    className="label-text-alt link" 
                    onClick={() => setLotteryAmount((parseFloat(lotteryAmount) * 2).toString())}
                    style={{ color: "#ff4791" }}
                  >
                    Double Amount
                  </button>
                </label>
              </div>
              
              <div className="card-actions justify-between mt-4">
                <button 
                  className={`btn flex-1 ${isTransactionPending ? 'loading' : ''}`}
                  onClick={handleEnterLottery}
                  disabled={isTransactionPending || !lotteryActive || !isConnected}
                  style={{ backgroundColor: "#ff4791", color: "white", borderColor: "#ff4791" }}
                >
                  {isConnected ? (lotteryActive ? "Enter Lottery" : "No Active Round") : "Connect Wallet"}
                </button>
                <button 
                  className={`btn flex-1 ${isTransactionPending ? 'loading' : ''}`}
                  onClick={handleFundLottery}
                  disabled={isTransactionPending || !isConnected}
                  style={{ backgroundColor: "#ffd6e7", color: "#d1456f", borderColor: "#ffd6e7" }}
                >
                  Fund Lottery
                </button>
              </div>
              
              <div className="mt-3 text-sm" style={{ color: "#d1456f" }}>
                <p>Your entry fee will be added to the prize pool. The winner takes all after the round ends!</p>
              </div>
            </div>
          </div>

          {/* Control Panel Card */}
          <div className="card shadow-xl" style={{ backgroundColor: "white" }}>
            <div className="card-body">
              <h2 className="card-title" style={{ color: "#d1456f" }}>Control Panel</h2>
              
              <div className="alert shadow-sm" style={{ backgroundColor: "#fff0f5" }}>
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current flex-shrink-0 w-6 h-6" style={{ color: "#d1456f" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <div>
                    <h3 className="font-bold" style={{ color: "#d1456f" }}>How Rounds Work</h3>
                    <p className="text-sm" style={{ color: "#d1456f" }}>A round starts when price volatility exceeds {formattedThreshold}%. Each round lasts 10 minutes or until manually ended.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 my-2">
                {needsEndingCheck && (
                  <div className="alert" style={{ backgroundColor: "#ffd6e7" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 h-6" fill="none" viewBox="0 0 24 24" style={{ color: "#d1456f" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span style={{ color: "#d1456f" }}>Time is up! This round needs to be ended.</span>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  {/* Check & End Round button */}
                  {needsEndingCheck && (
                    <button 
                      className={`btn ${isTransactionPending ? 'loading' : ''}`}
                      onClick={handleCheckAndEndRound}
                      disabled={isTransactionPending || !isConnected}
                      style={{ backgroundColor: "#ffd6e7", color: "#d1456f", borderColor: "#ffd6e7" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      End Round & Select Winner
                    </button>
                  )}

                  {/* Start New Round button */}
                  <button 
                    className={`btn ${lotteryActive ? 'btn-disabled' : ''} ${isTransactionPending ? 'loading' : ''}`}
                    onClick={handleStartRound}
                    disabled={isTransactionPending || lotteryActive || !isConnected}
                    style={lotteryActive ? { backgroundColor: "#e0e0e0", color: "#a0a0a0" } : { backgroundColor: "#ff4791", color: "white", borderColor: "#ff4791" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    {lotteryActive ? "Round Already Active" : "Check Volatility & Start Round"}
                  </button>
                </div>
              </div>
              
              <div className="divider" style={{ backgroundColor: "#ffd6e7", height: "2px" }}>Price Feeds</div>
              
              <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#fff0f5" }}>
                <p style={{ color: "#d1456f" }}>This lottery monitors price feeds from Flare's FTSO for:</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="stat p-2 rounded-lg" style={{ backgroundColor: "white" }}>
                    <div className="stat-title text-xs" style={{ color: "#d1456f" }}>FLR/USD</div>
                    <div className="stat-value text-sm" style={{ color: "#ff4791" }}>
                      {flrUsd.isLoading ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        `$${parseFloat(flrUsd.price).toFixed(4)}`
                      )}
                    </div>
                  </div>
                  <div className="stat p-2 rounded-lg" style={{ backgroundColor: "white" }}>
                    <div className="stat-title text-xs" style={{ color: "#d1456f" }}>BTC/USD</div>
                    <div className="stat-value text-sm" style={{ color: "#ff4791" }}>
                      {btcUsd.isLoading ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        `$${parseFloat(btcUsd.price).toFixed(0)}`
                      )}
                    </div>
                  </div>
                  <div className="stat p-2 rounded-lg" style={{ backgroundColor: "white" }}>
                    <div className="stat-title text-xs" style={{ color: "#d1456f" }}>ETH/USD</div>
                    <div className="stat-value text-sm" style={{ color: "#ff4791" }}>
                      {ethUsd.isLoading ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        `$${parseFloat(ethUsd.price).toFixed(0)}`
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right mt-2">
                  <button 
                    onClick={refreshPrices}
                    className="btn btn-xs"
                    style={{ backgroundColor: "#ffd6e7", color: "#d1456f", borderColor: "#ffd6e7" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Flare Protocols Card */}
        <div className="card shadow-xl mt-6" style={{ backgroundColor: "white" }}>
          <div className="card-body">
            <h2 className="card-title" style={{ color: "#d1456f" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "#d1456f" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Built with Flare's Native Protocols
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: "#fff0f5" }}>
                <h3 className="font-bold mb-2 flex items-center" style={{ color: "#d1456f" }}>
                  <span className="badge badge-sm mr-2" style={{ backgroundColor: "#ffd6e7", color: "#d1456f" }}>FTSO</span>
                  Price Feeds
                </h3>
                <p className="text-sm" style={{ color: "#d1456f" }}>
                  Real-time price feeds with finality assurance for multiple asset pairs
                </p>
              </div>
              
              <div className="p-4 rounded-lg" style={{ backgroundColor: "#fff0f5" }}>
                <h3 className="font-bold mb-2 flex items-center" style={{ color: "#d1456f" }}>
                  <span className="badge badge-sm mr-2" style={{ backgroundColor: "#ffd6e7", color: "#d1456f" }}>FDC</span>
                  Data Verification
                </h3>
                <p className="text-sm" style={{ color: "#d1456f" }}>
                  Verifies trusted and finalized data before triggering lottery rounds
                </p>
              </div>
              
              <div className="p-4 rounded-lg" style={{ backgroundColor: "#fff0f5" }}>
                <h3 className="font-bold mb-2 flex items-center" style={{ color: "#d1456f" }}>
                  <span className="badge badge-sm mr-2" style={{ backgroundColor: "#ffd6e7", color: "#d1456f" }}>RNG</span>
                  Fair Winner Selection
                </h3>
                <p className="text-sm" style={{ color: "#d1456f" }}>
                  Secure, unbiased random number generation for selecting lottery winners
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer Link */}
        <div className="flex justify-center mt-8">
          <Link href="/debug" passHref>
            <button className="btn btn-outline" style={{ borderColor: "#ff4791", color: "#ff4791" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              View Contract Debug Interface
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;