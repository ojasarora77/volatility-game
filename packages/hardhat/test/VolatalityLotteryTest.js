const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VolatilityLottery", function () {
  let volatilityLottery;
  let owner, player1, player2, player3;
  let mockFtsoRegistry, mockRandomProvider, mockFdcHub;

  // Mock contract for FTSO Registry
  const mockFtsoRegistryFactory = async () => {
    const MockFtsoRegistry = await ethers.getContractFactory("MockFtsoRegistry");
    return await MockFtsoRegistry.deploy();
  };

  // Mock contract for Random Provider
  const mockRandomProviderFactory = async () => {
    const MockRandomProvider = await ethers.getContractFactory("MockRandomProvider");
    return await MockRandomProvider.deploy();
  };

  // Mock contract for FDC Hub
  const mockFdcHubFactory = async () => {
    const MockFdcHub = await ethers.getContractFactory("MockFdcHub");
    return await MockFdcHub.deploy();
  };

  beforeEach(async function () {
    // Get signers
    [owner, player1, player2, player3] = await ethers.getSigners();

    // Deploy mock contracts
    mockFtsoRegistry = await mockFtsoRegistryFactory();
    mockRandomProvider = await mockRandomProviderFactory();
    mockFdcHub = await mockFdcHubFactory();

    // Set initial price in mock FTSO Registry
    await mockFtsoRegistry.setCurrentPrice("BTC/USD", ethers.utils.parseUnits("50000", 18), Date.now(), 18);

    // Set finalized blocks in mock FDC Hub
    const currentBlock = await ethers.provider.getBlockNumber();
    for (let i = 0; i <= 20; i++) {
      if (currentBlock >= i) {
        await mockFdcHub.setFinalized(currentBlock - i); // This function name is fine for the mock setup
      }
    }

    // Deploy VolatilityLottery contract
    const VolatilityLottery = await ethers.getContractFactory("VolatilityLottery");
    volatilityLottery = await VolatilityLottery.deploy(
      mockFtsoRegistry.address,
      mockRandomProvider.address,
      mockFdcHub.address,
      ethers.utils.parseEther("1"), // 1 FLR entry fee
      100, // 1% volatility threshold
      600, // 10 minutes round duration
      "BTC/USD" // Price pair
    );
    await volatilityLottery.deployed();
  });

  describe("Game Mechanics", function () {
    it("Should start a new round correctly", async function () {
      await volatilityLottery.startRound();
      
      const roundInfo = await volatilityLottery.getCurrentRoundInfo();
      expect(roundInfo._roundId).to.equal(1);
      expect(roundInfo._startPrice).to.equal(ethers.utils.parseUnits("50000", 18));
      expect(roundInfo._totalPot).to.equal(0);
    });

    it("Should allow players to make predictions", async function () {
      await volatilityLottery.startRound();
      
      // Player 1 predicts high volatility
      await volatilityLottery.connect(player1).makePrediction(true, { value: ethers.utils.parseEther("1") });
      
      // Player 2 predicts low volatility
      await volatilityLottery.connect(player2).makePrediction(false, { value: ethers.utils.parseEther("2") });
      
      // Check predictions were recorded correctly
      const player1Prediction = await volatilityLottery.getPlayerPrediction(player1.address);
      expect(player1Prediction._hasPrediction).to.be.true;
      expect(player1Prediction._isHighVolatility).to.be.true;
      expect(player1Prediction._amount).to.equal(ethers.utils.parseEther("1"));
      
      const player2Prediction = await volatilityLottery.getPlayerPrediction(player2.address);
      expect(player2Prediction._hasPrediction).to.be.true;
      expect(player2Prediction._isHighVolatility).to.be.false;
      expect(player2Prediction._amount).to.equal(ethers.utils.parseEther("2"));
      
      // Check pots were updated correctly
      const roundInfo = await volatilityLottery.getCurrentRoundInfo();
      expect(roundInfo._totalPot).to.equal(ethers.utils.parseEther("3"));
      expect(roundInfo._highVolatilityPot).to.equal(ethers.utils.parseEther("1"));
      expect(roundInfo._lowVolatilityPot).to.equal(ethers.utils.parseEther("2"));
    });

    it("Should finalize a round and select winners correctly", async function () {
      await volatilityLottery.startRound();
      
      // Players make predictions
      await volatilityLottery.connect(player1).makePrediction(true, { value: ethers.utils.parseEther("1") });
      await volatilityLottery.connect(player2).makePrediction(false, { value: ethers.utils.parseEther("1") });
      await volatilityLottery.connect(player3).makePrediction(true, { value: ethers.utils.parseEther("1") });
      
      // Advance time to end of round
      await time.increase(600);
      
      // Set end price to create high volatility (>1% change)
      await mockFtsoRegistry.setCurrentPrice("BTC/USD", ethers.utils.parseUnits("52000", 18), Date.now(), 18);
      
      // Mock random number provider to return a predictable number
      await mockRandomProvider.setRandomNumber(0); // This will select the first player as jackpot winner
      
      // Finalize round
      await volatilityLottery.finalizeRound();
      
      // Get round data
      const round = await volatilityLottery.rounds(1);
      
      // Verify round data
      expect(round.endPrice).to.equal(ethers.utils.parseUnits("52000", 18));
      expect(round.isHighVolatility).to.be.true; // 4% change
      expect(round.isFinalized).to.be.true;
      
      // Calculate expected jackpot winner (player1 should be first in the array)
      expect(round.jackpotWinner).to.equal(player1.address);
    });

    it("Should allow winners to claim rewards", async function () {
      await volatilityLottery.startRound();
      
      // Players make predictions
      await volatilityLottery.connect(player1).makePrediction(true, { value: ethers.utils.parseEther("1") });
      await volatilityLottery.connect(player2).makePrediction(false, { value: ethers.utils.parseEther("1") });
      
      // Advance time to end of round
      await time.increase(600);
      
      // Set end price to create high volatility
      await mockFtsoRegistry.setCurrentPrice("BTC/USD", ethers.utils.parseUnits("52000", 18), Date.now(), 18);
      
      // Mock random number
      await mockRandomProvider.setRandomNumber(0);
      
      // Finalize round
      await volatilityLottery.finalizeRound();
      
      // Get player1 balance before claiming
      const balanceBefore = await player1.getBalance();
      
      // Player1 claims reward (should get their bet back + player2's bet + jackpot bonus)
      await volatilityLottery.connect(player1).claimRewards(1);
      
      // Get player1 balance after claiming
      const balanceAfter = await player1.getBalance();
      
      // Player1 should receive their original bet + player2's bet + 10% bonus
      // Account for gas costs by checking range
      expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(
        ethers.utils.parseEther("2.2"), // 1 FLR bet + 1 FLR from player2 + 0.2 FLR bonus
        ethers.utils.parseEther("0.01") // Allow for gas costs
      );
    });
  });
});