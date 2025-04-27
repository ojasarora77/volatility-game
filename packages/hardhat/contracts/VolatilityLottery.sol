// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

contract VolatilityLottery {

    bytes21 public constant FLR_USD_ID = 0x01464c522f55534400000000000000000000000000; // FLR/USD
    bytes21 public constant BTC_USD_ID = 0x014254432f55534400000000000000000000000000; // BTC/USD
    bytes21 public constant ETH_USD_ID = 0x014554482f55534400000000000000000000000000; // ETH/USD

    uint256 public lotteryThreshold = 1e18; // Price change threshold for volatility (e.g., 1% change)
    uint256 public lotteryEndTime;
    uint256 public roundId;
    bool public isRoundActive;
    
    address[] public participants;
    mapping(address => uint256) public participantBalances;

    event LotteryEntered(address indexed participant, uint256 amount);
    event LotteryStarted(uint256 startTime);
    event LotteryEnded(address winner, uint256 prizeAmount);
    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);

    // Get the latest price feed for FLR/USD
    function getFlrUsdPrice() internal view returns (uint256 price) {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        (price, ) = ftsoV2.getFeedByIdInWei(FLR_USD_ID);
    }

    // Get the latest price feed for BTC/USD
    function getBtcUsdPrice() internal view returns (uint256 price) {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        (price, ) = ftsoV2.getFeedByIdInWei(BTC_USD_ID);
    }

    // Get the latest price feed for ETH/USD
    function getEthUsdPrice() internal view returns (uint256 price) {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        (price, ) = ftsoV2.getFeedByIdInWei(ETH_USD_ID);
    }

    // Enter the lottery with an amount of tokens or ETH
    function enterLottery(uint256 amount) external payable {
        require(amount > 0, "Amount must be greater than 0");
        require(isRoundActive, "No active round");
        require(block.timestamp < lotteryEndTime, "Round has ended");
        require(msg.value == amount, "Amount must match sent ETH");
        
        participantBalances[msg.sender] += amount;
        participants.push(msg.sender);
        emit LotteryEntered(msg.sender, amount);
    }

    // Start a new lottery round
    function startRound() external {
        require(!isRoundActive, "A round is already active");
        
        // Get price feeds to check volatility
        uint256 priceFlrUsd = getFlrUsdPrice();
        uint256 priceBtcUsd = getBtcUsdPrice();
        uint256 priceEthUsd = getEthUsdPrice();
        
        uint256 flrPriceDifference = calculatePriceChange(priceFlrUsd, FLR_USD_ID);
        uint256 btcPriceDifference = calculatePriceChange(priceBtcUsd, BTC_USD_ID);
        uint256 ethPriceDifference = calculatePriceChange(priceEthUsd, ETH_USD_ID);

        bool volatilityThresholdMet = flrPriceDifference > lotteryThreshold || 
                                      btcPriceDifference > lotteryThreshold || 
                                      ethPriceDifference > lotteryThreshold;
        
        if (volatilityThresholdMet) {
            // Increment round ID
            roundId++;
            
            // Set round timing
            uint256 startTime = block.timestamp;
            uint256 endTime = startTime + 10 minutes;
            lotteryEndTime = endTime;
            
            // Mark round as active
            isRoundActive = true;
            
            emit RoundStarted(roundId, startTime, endTime);
            emit LotteryStarted(startTime); // For backward compatibility
        }
    }

    // Calculate price change percentage between the current and last recorded price
    function calculatePriceChange(uint256 currentPrice, bytes21 feedId) internal view returns (uint256) {
        uint256 lastPrice = participantBalances[address(this)]; // Placeholder for the actual last price storage
        if (lastPrice == 0) {
            return 0;
        }
        uint256 priceChange = (currentPrice > lastPrice) ? currentPrice - lastPrice : lastPrice - currentPrice;
        return priceChange;
    }

    // End the lottery by selecting a random winner
    function endLottery() public {
        require(isRoundActive, "No active round");
        require(block.timestamp >= lotteryEndTime, "Round has not ended yet");
        
        // Reset round status
        isRoundActive = false;
        
        if (participants.length == 0) {
            return; // No participants, no winner
        }

        uint256 winnerIndex = uint256(blockhash(block.number - 1)) % participants.length;
        address winner = participants[winnerIndex];
        uint256 prizeAmount = address(this).balance; // The total prize pool

        (bool success, ) = winner.call{value: prizeAmount}("");
        require(success, "Transfer failed");

        emit LotteryEnded(winner, prizeAmount);

        // Reset the lottery
        participants = new address[](0);
    }

    // Function to fund the contract with ETH for the lottery pool
    function fundLottery() external payable {}

    // Function to withdraw funds from the contract (admin)
    function withdrawFunds(uint256 amount) external {
        // Admin checks here (e.g., onlyOwner modifier)
        payable(msg.sender).transfer(amount);
    }

    // Set the volatility threshold (admin function)
    function setLotteryThreshold(uint256 newThreshold) external {
        // Admin checks here (e.g., onlyOwner modifier)
        lotteryThreshold = newThreshold;
    }

    // Set the end time for the lottery (admin function)
    function setLotteryEndTime(uint256 newEndTime) external {
        // Admin checks here (e.g., onlyOwner modifier)
        lotteryEndTime = newEndTime;
    }
    
    // Force end the current round (admin function)
    function forceEndRound() external {
        // Admin checks here (e.g., onlyOwner modifier)
        require(isRoundActive, "No active round");
        endLottery();
    }
    
    // Check if a round should be ended and end it if needed
    function checkAndEndRound() external {
        if (isRoundActive && block.timestamp >= lotteryEndTime) {
            endLottery();
        }
    }
}