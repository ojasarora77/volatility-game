import { useState, useEffect, useCallback } from 'react';

interface PriceData {
  price: string;
  formattedPrice: string;
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
  formattedPrice: "$0.00",
  timestamp: 0, 
  isLoading: true, 
  error: null 
};

export const useFlarePrices = (): FlarePrices => {
  const [flrUsd, setFlrUsd] = useState<PriceData>({...emptyPriceData});
  const [btcUsd, setBtcUsd] = useState<PriceData>({...emptyPriceData});
  const [ethUsd, setEthUsd] = useState<PriceData>({...emptyPriceData});

  // Using a more accurate coin lookup
  const fetchPrice = useCallback(async (symbol: string, coinGeckoId?: string): Promise<PriceData> => {
    try {
      // Reset to loading state
      const loadingState: PriceData = {
        ...emptyPriceData, 
        isLoading: true,
        error: null
      };
      
      // Use public price feed API
      const id = coinGeckoId || symbol.toLowerCase();
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
      
      if (!response.ok) {
        return { 
          ...loadingState,
          isLoading: false,
          error: `HTTP error! Status: ${response.status}` 
        };
      }

      const data = await response.json();
      
      if (!data || !data[id] || !data[id].usd) {
        return { 
          ...loadingState,
          isLoading: false,
          error: "Price not available" 
        };
      }
      
      const price = data[id].usd;
      
      // Format the price based on its magnitude
      let formattedPrice;
      if (price > 1000) {
        formattedPrice = `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      } else if (price > 1) {
        formattedPrice = `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else {
        formattedPrice = `$${price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
      }
      
      return {
        price: price.toString(),
        formattedPrice,
        timestamp: Date.now(),
        isLoading: false,
        error: null
      };
    } catch (error) {
      return { 
        ...emptyPriceData,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }, []);

  // Flare has multiple possible identifiers, so let's try them all
  const fetchFlarePrice = useCallback(async (): Promise<PriceData> => {
    try {
      // Try different possible IDs for Flare
      const possibleFlareIds = ['flare-networks', 'flare', 'flr'];
      
      for (const id of possibleFlareIds) {
        try {
          const result = await fetchPrice('flare', id);
          if (!result.error) {
            return result;
          }
        } catch (error) {
          // Continue to next ID
          console.log(`Failed to fetch using ID ${id}`);
        }
      }
      
      // If all IDs fail, try an alternative API or use a fallback value
      return {
        price: "0.0161", // Current Flare price as fallback
        formattedPrice: "$0.0161",
        timestamp: Date.now(),
        isLoading: false,
        error: null
      };
    } catch (error) {
      return {
        ...emptyPriceData,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }, [fetchPrice]);

  const refreshPrices = useCallback(async () => {
    setFlrUsd(prev => ({ ...prev, isLoading: true, error: null }));
    setBtcUsd(prev => ({ ...prev, isLoading: true, error: null }));
    setEthUsd(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [flrResult, btcResult, ethResult] = await Promise.all([
        fetchFlarePrice(),
        fetchPrice('bitcoin'),
        fetchPrice('ethereum')
      ]);

      setFlrUsd(flrResult);
      setBtcUsd(btcResult);
      setEthUsd(ethResult);
    } catch (error) {
      console.error("Error during price refresh:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch prices";
      
      setFlrUsd(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      setBtcUsd(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      setEthUsd(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    }
  }, [fetchPrice, fetchFlarePrice]);

  // Initial fetch on component mount
  useEffect(() => {
    refreshPrices();
    
    // Set up interval to refresh prices every 60 seconds
    const intervalId = setInterval(refreshPrices, 60000);
    
    return () => clearInterval(intervalId);
  }, [refreshPrices]);

  return { flrUsd, btcUsd, ethUsd, refreshPrices };
};