import { useState, useEffect, useCallback } from 'react';
import { formatEther } from 'viem';

// Define feed IDs for price pairs
const FLR_USD_ID = "0x01464c522f55534400000000000000000000000000"; 
const BTC_USD_ID = "0x014254432f55534400000000000000000000000000";
const ETH_USD_ID = "0x014554482f55534400000000000000000000000000";

// Direct TestFtsoV2 address on Coston2 testnet
const FTSO_ADDRESS = "0x6D861767198e7D7a33E459f41e4809C350FaA627";

// RPC URL for Coston2 testnet
const RPC_URL = "https://coston2-api.flare.network/ext/C/rpc";

interface PriceData {
  price: string;
  timestamp: number;
  isLoading: boolean;
  error: string | null;
}

interface FlarePrices {
  flrUsd: PriceData;
  btcUsd: PriceData;
  ethUsd: PriceData;
  refreshPrices: () => Promise<void>;
}

// Empty price data object for initialization
const emptyPriceData: PriceData = { 
  price: "0", 
  timestamp: 0, 
  isLoading: true, 
  error: null 
};

export const useFlarePrices = (): FlarePrices => {
  const [flrUsd, setFlrUsd] = useState<PriceData>({...emptyPriceData});
  const [btcUsd, setBtcUsd] = useState<PriceData>({...emptyPriceData});
  const [ethUsd, setEthUsd] = useState<PriceData>({...emptyPriceData});

  const fetchPrice = useCallback(async (feedId: string): Promise<{price: string, timestamp: number, error: string | null}> => {
    try {
      // Function selector for getFeedByIdInWei(bytes21)
      const selector = "4bb89ea6";
      
      // Ensure feedId is 42 characters (0x + 40 hex chars)
      const feedIdHex = feedId.startsWith('0x') ? feedId.slice(2) : feedId;
      
      // Create properly formatted input for bytes21 parameter (21 bytes = 42 hex chars)
      // bytes21 needs to be padded to 32 bytes for the ABI encoding
      const paddedFeedId = feedIdHex.padEnd(64, '0');
      
      console.log(`Fetching price for ${feedId} from ${FTSO_ADDRESS} using ${RPC_URL}`);
      console.log(`Data: 0x${selector}${paddedFeedId}`);
      
      const requestBody = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: FTSO_ADDRESS,
            data: `0x${selector}${paddedFeedId}`
          },
          'latest'
        ]
      });
      
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });
      
      if (!response.ok) {
        console.error(`HTTP error! Status: ${response.status}`);
        return { 
          price: "0", 
          timestamp: 0, 
          error: `HTTP error! Status: ${response.status}` 
        };
      }

      const data = await response.json();
      console.log("Full response:", JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.error("RPC error:", JSON.stringify(data.error));
        return { 
          price: "0", 
          timestamp: 0, 
          error: data.error.message || "Unknown RPC error" 
        };
      }
      
      if (data.result) {
        // Check if the result is a valid hex string
        if (!data.result.startsWith('0x') || data.result.length < 130) {
          console.error("Invalid result format:", data.result);
          return { price: "0", timestamp: 0, error: "Invalid result format" };
        }
        
        const decodedData = decodeResult(data.result);
        console.log(`Decoded data for ${feedId}:`, decodedData);
        
        // Check if the price is valid
        if (decodedData.price === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          return { price: "0", timestamp: 0, error: "Feed not available" };
        }
        
        try {
          const price = formatEther(BigInt(decodedData.price));
          const timestamp = parseInt(decodedData.timestamp, 16);
          
          console.log(`Formatted price for ${feedId}: ${price}, timestamp: ${timestamp}`);
          
          return {
            price,
            timestamp,
            error: null
          };
        } catch (err) {
          console.error("Error formatting price:", err);
          return { price: "0", timestamp: 0, error: "Error formatting price" };
        }
      }
      
      return { price: "0", timestamp: 0, error: "No result data" };
    } catch (error) {
      console.error(`Error fetching price for feed ${feedId}:`, error);
      return { 
        price: "0", 
        timestamp: 0, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }, []);

  const refreshPrices = useCallback(async () => {
    setFlrUsd(prev => ({ ...prev, isLoading: true, error: null }));
    setBtcUsd(prev => ({ ...prev, isLoading: true, error: null }));
    setEthUsd(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Using individual try/catch for each price feed to prevent one failing feed from affecting others
      let flrPrice = { price: "0", timestamp: 0, error: null as string | null };
      let btcPrice = { price: "0", timestamp: 0, error: null as string | null };
      let ethPrice = { price: "0", timestamp: 0, error: null as string | null };
      
      try {
        flrPrice = await fetchPrice(FLR_USD_ID);
      } catch (error) {
        console.error("Error fetching FLR price:", error);
        flrPrice.error = error instanceof Error ? error.message : "Unknown error";
      }
      
      try {
        btcPrice = await fetchPrice(BTC_USD_ID);
      } catch (error) {
        console.error("Error fetching BTC price:", error);
        btcPrice.error = error instanceof Error ? error.message : "Unknown error";
      }
      
      try {
        ethPrice = await fetchPrice(ETH_USD_ID);
      } catch (error) {
        console.error("Error fetching ETH price:", error);
        ethPrice.error = error instanceof Error ? error.message : "Unknown error";
      }

      setFlrUsd({ ...flrPrice, isLoading: false });
      setBtcUsd({ ...btcPrice, isLoading: false });
      setEthUsd({ ...ethPrice, isLoading: false });
    } catch (error) {
      console.error("Error during price refresh:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch prices";
      
      setFlrUsd(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      setBtcUsd(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      setEthUsd(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    }
  }, [fetchPrice]);

  // Initial fetch on component mount
  useEffect(() => {
    refreshPrices();
    
    // Set up interval to refresh prices every 30 seconds
    const intervalId = setInterval(refreshPrices, 30000);
    
    return () => clearInterval(intervalId);
  }, [refreshPrices]);

  return { flrUsd, btcUsd, ethUsd, refreshPrices };
};

// Utility function to decode the result
function decodeResult(hexString: string): { price: string, timestamp: string } {
  // Remove '0x' prefix if present
  const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  
  // Price is first 32 bytes (64 characters)
  const price = '0x' + hex.slice(0, 64);
  
  // Timestamp is next 32 bytes
  const timestamp = '0x' + hex.slice(64, 128);

  return { price, timestamp };
}
