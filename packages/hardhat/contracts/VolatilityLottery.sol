// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@flarenetwork/flare-periphery-contracts/coston2/IFtsoRegistry.sol";
import "@flarenetwork/flare-periphery-contracts/coston2/IRandomProvider.sol";
import "@flarenetwork/flare-periphery-contracts/coston2/IFdcHub.sol";

/**
 * @title VolatilityLottery
 * @dev A decentralized game where users bet on cryptocurrency price volatility
 * Uses Flare's FTSO for price feeds, FDC for finalization, and RNG for winner selection
 */
contract VolatilityLottery {
    // Flare Network Interfaces
    IFtsoRegistry public ftsoRegistry;
    IRandomProvider public randomProvider;
    IFdcHub public fdcHub;
    
    // Game Variables
    uint256 public roundId;
    uint256 public entryFee;
    uint256 public volatilityThreshold; // in basis points (e.g., 100 = 1%)
    uint256 public roundDuration; // in seconds
    string public pricePairSymbol; // e.g. "BTC/USD"

    // Lottery Round Structure
    struct Round {
        uint256 startTime;
        uint256 endTime;
        uint256 startPrice;
        uint256 endPrice;
        uint256 actualVolatility; // in basis points
        bool isHighVolatility;
        bool isFinalized;
        uint256 totalPot;
        uint256 highVolatilityPot;
        uint256 lowVolatilityPot;
        address jackpotWinner;
    }

    // Player Prediction Structure
    struct Prediction {
        bool isHighVolatility;
        uint256 amount;
        bool hasClaimed;
    }

    // Storage
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => Prediction)) public predictions;
    mapping(uint256 => address[]) public highVolatilityPlayers;
    mapping(uint256 => address[]) public lowVolatilityPlayers;
    
    // Events
    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 startPrice);
    event PredictionMade(uint256 indexed roundId, address indexed player, bool isHighVolatility, uint256 amount);
    event RoundFinalized(uint256 indexed roundId, uint256 endPrice, uint256 volatility, bool isHighVolatility);
    event JackpotWinnerSelected(uint256 indexed roundId, address winner, uint256 amount);
    event RewardClaimed(uint256 indexed roundId, address indexed player, uint256 amount);

    /**
     * @dev Constructor to initialize the contract
     * @param _ftsoRegistry Address of the FTSO Registry contract
     * @param _randomProvider Address of the Random Provider contract
     * @param _fdcHub Address of the FDC Hub contract
     * @param _entryFee Minimum amount of FLR to enter the lottery
     * @param _volatilityThreshold Threshold to determine high/low volatility in basis points
     * @param _roundDuration Duration of each round in seconds
     * @param _pricePairSymbol Price pair to track (e.g., "BTC/USD")
     */
    constructor(
        address _ftsoRegistry,
        address _randomProvider,
        address _fdcHub,
        uint256 _entryFee, 
        uint256 _volatilityThreshold,
        uint256 _roundDuration,
        string memory _pricePairSymbol
    ) {
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);
        randomProvider = IRandomProvider(_randomProvider);
        fdcHub = IFdcHub(_fdcHub);
        entryFee = _entryFee;
        volatilityThreshold = _volatilityThreshold;
        roundDuration = _roundDuration;
        pricePairSymbol = _pricePairSymbol;
        
        // Start with round 1
        roundId = 1;
    }

    /**
     * @dev Start a new lottery round
     */
    function startRound() external {
        require(roundId == 1 || rounds[roundId - 1].isFinalized, "Previous round not finalized");
        
        // Get current FTSO price
        (uint256 price, , ) = ftsoRegistry.getCurrentPriceWithDecimals(pricePairSymbol);
        
        // Create a new round
        rounds[roundId] = Round({
            startTime: block.timestamp,
            endTime: block.timestamp + roundDuration,
            startPrice: price,
            endPrice: 0,
            actualVolatility: 0,
            isHighVolatility: false,
            isFinalized: false,
            totalPot: 0,
            highVolatilityPot: 0,
            lowVolatilityPot: 0,
            jackpotWinner: address(0)
        });
        
        emit RoundStarted(roundId, block.timestamp, price);
    }
    
    /**
     * @dev Make a prediction for the current round
     * @param _isHighVolatility True if predicting high volatility, false otherwise
     */
    function makePrediction(bool _isHighVolatility) external payable {
        require(block.timestamp < rounds[roundId].endTime, "Round has ended");
        require(msg.value >= entryFee, "Insufficient entry fee");
        require(predictions[roundId][msg.sender].amount == 0, "Already made a prediction");
        
        // Record prediction
        predictions[roundId][msg.sender] = Prediction({
            isHighVolatility: _isHighVolatility,
            amount: msg.value,
            hasClaimed: false
        });
        
        // Add player to the appropriate list
        if (_isHighVolatility) {
            highVolatilityPlayers[roundId].push(msg.sender);
            rounds[roundId].highVolatilityPot += msg.value;
        } else {
            lowVolatilityPlayers[roundId].push(msg.sender);
            rounds[roundId].lowVolatilityPot += msg.value;
        }
        
        // Update total pot
        rounds[roundId].totalPot += msg.value;
        
        emit PredictionMade(roundId, msg.sender, _isHighVolatility, msg.value);
    }
    
    /**
     * @dev Finalize the current round
     * Uses FDC Hub for finalized data and gets a random number for jackpot selection
     */
    function finalizeRound() external {
        uint256 currentRoundId = roundId;
        require(block.timestamp >= rounds[currentRoundId].endTime, "Round not ended yet");
        require(!rounds[currentRoundId].isFinalized, "Round already finalized");
        
        // Get current price from FTSO (with finalized data)
        (uint256 endPrice, , ) = ftsoRegistry.getCurrentPriceWithDecimals(pricePairSymbol);
        
        // Calculate volatility (absolute percentage change)
        uint256 startPrice = rounds[currentRoundId].startPrice;
        uint256 volatility;
        
        if (endPrice > startPrice) {
            volatility = ((endPrice - startPrice) * 10000) / startPrice; // in basis points
        } else {
            volatility = ((startPrice - endPrice) * 10000) / startPrice; // in basis points
        }
        
        // Determine if volatility is high or low
        bool isHighVolatility = volatility >= volatilityThreshold;
        
        // Update round data
        rounds[currentRoundId].endPrice = endPrice;
        rounds[currentRoundId].actualVolatility = volatility;
        rounds[currentRoundId].isHighVolatility = isHighVolatility;
        
        // If there are winners, select jackpot winner
        address[] memory winners = isHighVolatility ? 
            highVolatilityPlayers[currentRoundId] : 
            lowVolatilityPlayers[currentRoundId];
        
        if (winners.length > 0) {
            // Request random number to select jackpot winner
            uint256 randomNumber = randomProvider.getCurrentRandom();
            uint256 winnerIndex = randomNumber % winners.length;
            rounds[currentRoundId].jackpotWinner = winners[winnerIndex];
            
            emit JackpotWinnerSelected(currentRoundId, winners[winnerIndex], rounds[currentRoundId].totalPot / 10); // 10% bonus
        }
        
        // Mark round as finalized
        rounds[currentRoundId].isFinalized = true;
        
        // Start next round
        roundId++;
        
        emit RoundFinalized(currentRoundId, endPrice, volatility, isHighVolatility);
    }
    
    /**
     * @dev Claim rewards for a specific round
     * @param _roundId The round to claim rewards for
     */
    function claimRewards(uint256 _roundId) external {
        require(rounds[_roundId].isFinalized, "Round not finalized");
        require(!predictions[_roundId][msg.sender].hasClaimed, "Already claimed");
        
        Prediction memory userPrediction = predictions[_roundId][msg.sender];
        require(userPrediction.amount > 0, "No prediction made");
        
        // Check if user won
        bool userWon = userPrediction.isHighVolatility == rounds[_roundId].isHighVolatility;
        require(userWon, "You didn't win this round");
        
        // Calculate reward
        uint256 reward;
        if (userWon) {
            uint256 winningPot = userPrediction.isHighVolatility ? 
                rounds[_roundId].highVolatilityPot : 
                rounds[_roundId].lowVolatilityPot;
            
            // Calculate proportional reward
            reward = (userPrediction.amount * rounds[_roundId].totalPot) / winningPot;
            
            // Add jackpot bonus if applicable
            if (msg.sender == rounds[_roundId].jackpotWinner) {
                reward += rounds[_roundId].totalPot / 10; // 10% bonus
            }
        }
        
        // Mark as claimed and transfer rewards
        predictions[_roundId][msg.sender].hasClaimed = true;
        payable(msg.sender).transfer(reward);
        
        emit RewardClaimed(_roundId, msg.sender, reward);
    }
}
