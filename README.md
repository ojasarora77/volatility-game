# 🧨 VolatilityLottery

A decentralized lottery that triggers rounds based on real-time price volatility, built natively on **Flare's enshrined protocols**.

---

## 🚀 Overview

**VolatilityLottery** is a fully on-chain lottery system where:
- Users pay an **entry fee** to participate.
- A new round starts when triggered by price volatility exceeding a threshold.
- Winners are selected **fairly and randomly** using Flare’s secure randomness provider.

The system autonomously:
- Fetches **finalized price data** using **Flare FTSO (Flare Time Series Oracle)**.
- Ensures verified data integrity using the **Flare Finalization Data Connector (FDC)**.
- Picks winners using **Flare’s native Random Number Generator (RNG)** for unbiased randomness.

---

## 🛠️ Built With
- [eth-scafflold](https://scaffoldeth.io/) 
- [Hardhat](https://hardhat.org/)
- [Flare Coston2 Testnet](https://docs.flare.network/)
- [TypeScript](https://www.typescriptlang.org/)
- [ethers.js](https://docs.ethers.org/)

---

## 📡 Why Flare?

This project fully embraces Flare's enshrined protocols:
- **FTSO**: To retrieve real-time, finality-assured asset price feeds and detect significant market volatility.
- **FDC (Finalization Data Connector)**: To verify that the price data is finalized and trusted before triggering a round.
- **Flare Random Number Generator**: To select the lottery winner in a verifiably fair manner, free from miner or user manipulation.

By combining these protocols, **VolatilityLottery** ensures that the dApp is **trustless**, **autonomous**, and **provably fair**, showcasing the power of building on Flare.

---

## 🌐 Deployment on Flare

The smart contract is deployed on the **Coston2 Flare Testnet**.

## 📦 How to Run Locally
Clone the repo:

```bash
git clone https://github.com/ojasarora77/volatility-game.git
cd volatility-game
```
Install dependencies and run the project 

```bash
yarn install
yarn start
# The app will be available at http://localhost:3000
```

## 🎮 How to Play

### 1. Get a Wallet

- Download [MetaMask](https://metamask.io/) or any wallet that supports custom RPC networks.

### 2. Add Flare Coston2 Testnet

Add the **Coston2** testnet to your wallet manually:

| Field            | Value                                               |
|------------------|-----------------------------------------------------|
| Network Name     | Flare Coston2 Testnet                               |
| RPC URL          | https://coston2-api.flare.network/ext/C/rpc         |
| Chain ID         | 114                                                 |
| Currency Symbol  | FLR                                                 |
| Block Explorer   | https://coston2-explorer.flare.network              |

OR use [Chainlist](https://chainlist.org/) to add it automatically.

---

### 3. Get Free Testnet FLR

- Visit the [Flare Coston2 Faucet](https://faucet.towolabs.com/) and claim free FLR.
- Fund your wallet with enough testnet FLR for gas and entry fees.

---

### 4. Enter the Lottery

- Send the required **entry fee** (e.g., `1 FLR`) directly to the deployed **VolatilityLottery** contract address.
- The contract automatically records your participation.

Example using MetaMask:
- Open MetaMask.
- Click **Send**.
- Paste the VolatilityLottery contract address.
- Enter the amount (entry fee).
- Confirm the transaction.

---

### 5. Wait for Volatility

- The system monitors asset volatility using **Flare's FTSO**.
- Once volatility crosses a threshold, the round is automatically triggered.
- A random winner is selected using **Flare’s native RNG**.
- If you win, the prize will be automatically distributed to your wallet!
