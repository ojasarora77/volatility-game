"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Address, Balance } from "~~/components/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";

const Home: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [lotteryAmount, setLotteryAmount] = useState<string>("1");

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
        value: amount as any, // Type casting to fix the TypeScript error
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
        value: amount as any, // Type casting to fix the TypeScript error
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
    }
  }, [isConfirmed, txHash, refetchLotteryEndTime, refetchLotteryThreshold, refetchParticipantBalance, refetchIsRoundActive, refetchRoundId]);

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

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5 w-full md:max-w-3xl">
        {/* Header */}
        <h1 className="text-center mb-6">
          <span className="block text-4xl font-bold mb-2">Volatility Lottery</span>
          <span className="block text-2xl">Win big on crypto price volatility!</span>
        </h1>

        <div className="flex justify-center items-center space-x-2 mb-4">
          <p className="font-medium">Connected Address:</p>
          <Address address={connectedAddress} />
        </div>

        {/* Transaction Status Display */}
        {txHash && (
          <div className="mb-4 p-3 bg-secondary text-secondary-content rounded-xl">
            <p>Transaction Hash: 
              <a 
                href={`https://coston2-explorer.flare.network/tx/${txHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 underline"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </a>
            </p>
            {isConfirming && <p>Confirming transaction...</p>}
            {isConfirmed && <p>Transaction confirmed!</p>}
          </div>
        )}

        {/* Main Card */}
        <div className="bg-base-100 border border-base-300 rounded-3xl shadow-md shadow-secondary p-6 mt-4">
          {/* Price Information */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Price Feeds</h2>
            <div className="bg-base-200 p-4 rounded-xl mb-4">
              <p className="mb-2">
                This lottery monitors price feeds from Flare's FTSO for FLR/USD, BTC/USD, and ETH/USD.
              </p>
              <p>
                When price volatility exceeds <span className="font-bold">{formattedThreshold}%</span>, a lottery round begins!
              </p>
            </div>
          </div>

          {/* Lottery Status */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Lottery Status</h2>
            <div className="bg-base-200 p-4 rounded-xl mb-4">
              <p>
                <span className="font-bold">Status:</span> {lotteryActive ? "Active" : lotteryEnded ? "Ended" : "Not Started"}
              </p>
              {roundId && (
                <p><span className="font-bold">Round ID:</span> {roundId.toString()}</p>
              )}
              {lotteryActive && timeLeft > 0 && (
                <p><span className="font-bold">Time Left:</span> {formatTimeLeft()}</p>
              )}
              <p>
                <span className="font-bold">Volatility Threshold:</span> {formattedThreshold}%
              </p>
              {hasParticipated && (
                <p><span className="font-bold">Your Entry:</span> {participantBalance ? formatEther(participantBalance) : "0"} ETH</p>
              )}
            </div>
          </div>

          {/* Entry Form */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Enter Lottery</h2>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Amount (ETH)</span>
              </label>
              <input 
                type="number" 
                placeholder="Enter amount in ETH" 
                className="input input-bordered" 
                value={lotteryAmount}
                onChange={(e) => setLotteryAmount(e.target.value)}
                min="0.1"
                step="0.1"
              />
              <label className="label">
                <span className="label-text-alt text-info">You will need to send this exact amount of ETH</span>
              </label>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <button 
                className={`btn btn-primary flex-1 ${isTransactionPending ? 'loading' : ''}`}
                onClick={handleEnterLottery}
                disabled={isTransactionPending || !lotteryActive}
              >
                {lotteryActive ? "Enter Lottery" : "No Active Round"}
              </button>
              <button 
                className={`btn btn-secondary flex-1 ${isTransactionPending ? 'loading' : ''}`}
                onClick={handleFundLottery}
                disabled={isTransactionPending}
              >
                Fund Lottery
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {/* Show Check & End Round button if needed */}
            {needsEndingCheck && (
              <button 
                className={`btn btn-warning ${isTransactionPending ? 'loading' : ''}`}
                onClick={handleCheckAndEndRound}
                disabled={isTransactionPending}
              >
                Check & End Round
              </button>
            )}

            {/* Start Round Button */}
            <button 
              className={`btn btn-accent ${isTransactionPending ? 'loading' : ''}`}
              onClick={handleStartRound}
              disabled={isTransactionPending || lotteryActive}
            >
              {lotteryActive ? "Round Already Active" : "Check Volatility & Start Round"}
            </button>
          </div>
        </div>

        {/* Game Rules */}
        <div className="bg-base-200 rounded-3xl p-6 mt-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-3">How To Play</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Enter the lottery with ETH during an active round.</li>
            <li>A round activates when price volatility exceeds the threshold.</li>
            <li>Each round lasts 10 minutes or until manually ended.</li>
            <li>After a round ends, a random winner gets the entire prize pool.</li>
            <li>The more ETH you contribute, the higher your chance of winning!</li>
          </ol>
        </div>
        
        {/* Footer Link */}
        <div className="flex justify-center mt-6">
          <Link href="/debug" passHref className="link link-primary">
            View Contract Debugging Interface
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;