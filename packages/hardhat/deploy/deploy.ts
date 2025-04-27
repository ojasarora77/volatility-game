import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployVolatilityLottery: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  log("Deploying VolatilityLottery...");

  const deployment = await deploy("VolatilityLottery", {
    from: deployer,
    args: [], // No constructor arguments for this version
    log: true,
    autoMine: true,
  });

  log(`VolatilityLottery deployed at ${deployment.address}`);

  try {
    // Set the lottery threshold manually
    // Get contract instance using hardhat
    const volatilityLottery = await hre.ethers.getContract("VolatilityLottery", deployer);
    
    // Set the lottery threshold (1% in wei format)
    const LOTTERY_THRESHOLD = hre.ethers.parseEther("0.01"); // 1%
    const thresholdTx = await volatilityLottery.setLotteryThreshold(LOTTERY_THRESHOLD);
    await thresholdTx.wait();
    log("Lottery threshold set to 1%");

    log("VolatilityLottery configuration completed!");
  } catch (error) {
    log("Error during contract configuration:");
    console.error(error);
  }
};

export default deployVolatilityLottery;
deployVolatilityLottery.tags = ["VolatilityLottery"];