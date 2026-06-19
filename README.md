# 🃏 MiniCard

**MiniCard** is a retro, GBA-inspired poker roguelike game built for the **Celo / MiniPay** ecosystem. Inspired by games like *Balatro*, it blends classic poker hand evaluation with powerful collectible Jokers, a quick timed-level progression system, and a decentralized blockchain leaderboard.

---

## 🚀 Play & Save Scores on Celo

MiniCard is designed to run seamlessly inside mobile wallets like **MiniPay** or standard Web3 browsers. 

* **On-Chain Leaderboard Contract:** [`0xfb897ec446b737a99ba8404fcb64821ed2207aeb`](https://celoscan.io/address/0xfb897ec446b737a99ba8404fcb64821ed2207aeb)
* **Gasless / Guest Mode:** For users without connected wallets, the game automatically provisions an ephemeral guest wallet so anyone can play and save scores locally.

---

## ✨ Features

* **Poker Roguelike Progression:** Draw, discard, and play poker hands to score chips and multipliers to beat the target blind score.
* **Collectible Jokers:** Buy, sell, and equip Jokers in the Shop to customize your multiplier builds. Features retro metallic, iridescent, and shiny rarity effects.
* **Dynamic WebGL Shaders:** A premium, smooth liquid shader background that adapts its color palette and speed dynamically (Amethyst Violet for Small Blinds, Amber Gold for Big Blinds, Electric Teal for Boss Blinds, and Forest Green for the Shop).
* **Arcade Timer Mode:** Starting from Round 2, a floating countdown timer widget pops out in the top-right corner to add excitement and rush the player, pulsing hot-pink when time is running low.
* **Blockchain Leaderboards:** Save your high scores directly onto Celo. Register a username and secure your spot on the top ten global ledger!

---

## 🛠️ Tech Stack

* **Frontend:** Next.js (React), Tailwind CSS, TypeScript, HTML5 Canvas / WebGL.
* **Web3 Integration:** Ethers.js, Celo network connector, MiniPay API detection.
* **Smart Contracts:** Solidity, Hardhat development framework.

---

## 📁 Repository Structure

```text
├── apps/
│   └── web/                   # Next.js web application (game UI, canvas, state logic)
│       ├── public/            # Static pixel art assets & sprite sheets
│       └── src/
│           ├── app/           # App router, page layouts, and global styles
│           ├── components/    # Reusable React components (Shop, RunInfo, GbaBackground)
│           └── lib/           # Game logic, poker hand evaluator, Web3 Celo helper utilities
└── contracts/                 # Hardhat project with Ethereum/Solidity smart contracts
    ├── contracts/             # Solidity files (MiniCardLeaderboard.sol)
    └── scripts/               # Hardhat deployment and verification scripts
```

---

## 💻 Local Development

### 1. Prerequisite
Ensure you have [Node.js](https://nodejs.org/) (v18+) and [pnpm](https://pnpm.io/) installed.

### 2. Installation
Install workspace dependencies:
```bash
pnpm install
```

### 3. Run the Game
Start the local development server for the Next.js frontend:
```bash
pnpm --filter web dev
# or from root:
pnpm dev
```
The game will be available at `http://localhost:3000`.

### 4. Smart Contracts (Optional)
To test or deploy contracts:
```bash
cd contracts
# Compile contracts
npx hardhat compile
# Run contract tests
npx hardhat test
```

---

## 📄 License
This project is licensed under the MIT License.
