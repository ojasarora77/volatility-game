import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "ethers";

/**
 * Deploys the VolatilityLottery contract
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployVolatilityLottery: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Deploying VolatilityLottery contract...");

  // Contract parameters
  const FTSO_REGISTRY_ADDRESS = "0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d"; // Replace with actual Flare FTSO Registry address
  const RANDOM_PROVIDER_ADDRESS = "0x7350F7E13dC7d59DED993132E51142CAd9A64367"; // Replace with actual Flare Random Provider address
  const FDC_HUB_ADDRESS = "0x48aC463d7975828989331F4De43341627b9c5f1D"; // Replace with actual Flare FDC Hub address
  const ENTRY_FEE = ethers.parseEther("1"); // 1 FLR entry fee
  const VOLATILITY_THRESHOLD = 100; // 1% volatility threshold in basis points
  const ROUND_DURATION = 10 * 60; // 10 minutes in seconds
  const PRICE_PAIR_SYMBOL = "BTC/USD"; // Price pair to track

  // Deploy VolatilityLottery contract
  const volatilityLottery = await deploy("VolatilityLottery", {
    from: deployer,
    args: [
      FTSO_REGISTRY_ADDRESS,
      RANDOM_PROVIDER_ADDRESS,
      FDC_HUB_ADDRESS,
      ENTRY_FEE,
      VOLATILITY_THRESHOLD,
      ROUND_DURATION,
      PRICE_PAIR_SYMBOL,
    ],
    log: true,
    // You can enable autoMine if you want faster deployment for local networks
    autoMine: true,
  });

  console.log("VolatilityLottery contract deployed to:", volatilityLottery.address);
};

export default deployVolatilityLottery;

// Tags are useful if you want to run only specific deployments with tags
deployVolatilityLottery.tags = ["VolatilityLottery"];
