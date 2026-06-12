import { createPublicClient, createWalletClient, custom, http } from "viem";
import { celo } from "viem/chains";

// ─── Celo Mainnet Configuration ───
// MiniPay runs on Celo Mainnet (chain 42220)
export const TARGET_CHAIN = celo;

// ─── Leaderboard Contract ───
// Deploy via:  cd contracts && npm run deploy:mainnet
// Then paste the deployed address here:
export const LEADERBOARD_CONTRACT_ADDRESS: string = "0xfB897EC446b737A99ba8404FCb64821eD2207AeB";

export const MINICARD_LEADERBOARD_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_score", type: "uint256" },
      { internalType: "uint256", name: "_round", type: "uint256" },
    ],
    name: "submitScore",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_username", type: "string" },
    ],
    name: "setUsername",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "_players", type: "address[]" },
    ],
    name: "getUsernames",
    outputs: [{ internalType: "string[]", name: "", type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllScores",
    outputs: [
      {
        components: [
          { internalType: "address", name: "player", type: "address" },
          { internalType: "uint256", name: "score", type: "uint256" },
          { internalType: "uint256", name: "round", type: "uint256" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
        ],
        internalType: "struct MiniCardLeaderboard.ScoreEntry[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getScoresCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "personalBest",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface LeaderboardEntry {
  address: string;
  username?: string;
  score: number;
  round: number;
  date: string;
}

// ─── USDT on Celo Mainnet ───
// USDT contract address: 0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e
const USDT_ADDRESS = "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e";

// Fee receiver for reroll payments — change to your own wallet!
const REROLL_FEE_RECEIVER = "0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE";

// $0.01 USDT (USDT has 6 decimals, so 0.01 * 10^6 = 10,000)
const REROLL_FEE_AMOUNT = BigInt("10000");

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── Helpers ───

function getProvider() {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

/** Whether we're inside MiniPay */
export function isMiniPay(): boolean {
  const provider = getProvider();
  return provider?.isMiniPay === true;
}

/** Public client — always uses Forno RPC (works without wallet) */
function getPublicClient() {
  return createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });
}

/** Wallet client — uses injected provider (MiniPay or MetaMask) */
function getWalletClient() {
  const provider = getProvider();
  if (!provider) return null;
  return createWalletClient({
    chain: celo,
    transport: custom(provider),
  });
}

// ─── Auto-connect (MiniPay pattern — no "Connect" button) ───

/**
 * Auto-connects to MiniPay / injected wallet.
 * MiniPay docs say: always auto-connect, never show a connect button.
 */
export async function autoConnect(): Promise<string | null> {
  let provider = getProvider();
  if (!provider && typeof window !== "undefined") {
    // Wait for window load or a short timeout for async injection
    await new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve(null);
      } else {
        window.addEventListener("load", () => resolve(null), { once: true });
        setTimeout(() => resolve(null), 1000);
      }
    });
    provider = getProvider();
  }

  if (!provider) return null;

  try {
    const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
    return accounts?.[0] ?? null;
  } catch (err) {
    console.warn("Auto-connect failed:", err);
    return null;
  }
}

// ─── Leaderboard (on-chain) ───

/**
 * Submits the score to MiniCardLeaderboard contract on Celo mainnet.
 */
export async function submitScoreToCelo(score: number, round: number): Promise<boolean> {
  if (LEADERBOARD_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.info("Leaderboard contract not deployed yet. Falling back to local storage.");
    return false;
  }

  const walletClient = getWalletClient();
  if (!walletClient) return false;

  try {
    const [address] = await walletClient.requestAddresses();
    if (!address) return false;

    // Switch network to Celo Mainnet if necessary
    try {
      const chainId = await walletClient.getChainId();
      if (chainId !== celo.id) {
        await walletClient.switchChain({ id: celo.id });
      }
    } catch (switchErr) {
      console.warn("Network switch skipped/failed:", switchErr);
    }

    const publicClient = getPublicClient();
    const gasPrice = await publicClient.getGasPrice();

    const hash = await walletClient.writeContract({
      account: address,
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "submitScore",
      args: [BigInt(score), BigInt(round)],
      type: "legacy",
      gasPrice,
      feeCurrency: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72",
    });

    console.info("Score TX submitted:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    console.error("Failed to submit score:", err);
    return false;
  }
}

/**
 * Fetches all scores from the leaderboard contract.
 */
export async function getScoresFromCelo(): Promise<LeaderboardEntry[]> {
  if (LEADERBOARD_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return [];
  }

  try {
    const publicClient = getPublicClient();

    const result = (await publicClient.readContract({
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "getAllScores",
    })) as any[];

    if (!result || result.length === 0) return [];

    // Batch resolve usernames
    const players = Array.from(new Set(result.map((entry: any) => entry.player as string))) as `0x${string}`[];
    let usernamesList: string[] = [];
    try {
      usernamesList = (await publicClient.readContract({
        address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
        abi: MINICARD_LEADERBOARD_ABI,
        functionName: "getUsernames",
        args: [players],
      })) as string[];
    } catch (err) {
      console.warn("Failed to batch fetch usernames:", err);
    }

    const usernameMap: Record<string, string> = {};
    players.forEach((player, index) => {
      if (usernamesList[index]) {
        usernameMap[player.toLowerCase()] = usernamesList[index];
      }
    });

    return result.map((entry: any) => ({
      address: entry.player,
      username: usernameMap[entry.player.toLowerCase()] || undefined,
      score: Number(entry.score),
      round: Number(entry.round),
      date: new Date(Number(entry.timestamp) * 1000).toLocaleDateString(),
    }));
  } catch (err) {
    console.error("Failed to read scores:", err);
    return [];
  }
}

/**
 * Resolves usernames for a list of leaderboard entries by querying the smart contract.
 */
export async function resolveUsernamesForScores(entries: LeaderboardEntry[]): Promise<LeaderboardEntry[]> {
  if (LEADERBOARD_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000" || !entries || entries.length === 0) {
    return entries;
  }

  try {
    const publicClient = getPublicClient();
    
    // Extract non-guest addresses
    const playerAddresses = Array.from(
      new Set(
        entries
          .map((e) => e.address)
          .filter((addr) => addr && !addr.startsWith("0xceloGuest"))
      )
    ) as `0x${string}`[];

    if (playerAddresses.length === 0) return entries;

    const usernamesList = (await publicClient.readContract({
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "getUsernames",
      args: [playerAddresses],
    })) as string[];

    const usernameMap: Record<string, string> = {};
    playerAddresses.forEach((player, index) => {
      if (usernamesList[index]) {
        usernameMap[player.toLowerCase()] = usernamesList[index];
      }
    });

    return entries.map((entry) => ({
      ...entry,
      username: !entry.address.startsWith("0xceloGuest") 
        ? (usernameMap[entry.address.toLowerCase()] || undefined)
        : undefined,
    }));
  } catch (err) {
    console.warn("Failed to resolve usernames for scores:", err);
    return entries;
  }
}

/**
 * Fetches the registered username for a given wallet address.
 */
export async function getUsernameFromCelo(address: string): Promise<string> {
  if (LEADERBOARD_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000" || !address || address.startsWith("0xceloGuest")) {
    return "";
  }

  try {
    const publicClient = getPublicClient();
    const usernamesList = (await publicClient.readContract({
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "getUsernames",
      args: [[address as `0x${string}`]],
    })) as string[];

    return usernamesList?.[0] || "";
  } catch (err) {
    console.warn("Failed to fetch username for address:", err);
    return "";
  }
}

/**
 * Sets the username on-chain for the connected player address.
 */
export async function registerUsernameToCelo(username: string): Promise<boolean> {
  const walletClient = getWalletClient();
  if (!walletClient) return false;

  try {
    const [address] = await walletClient.requestAddresses();
    if (!address) return false;

    // Switch network to Celo Mainnet if necessary
    try {
      const chainId = await walletClient.getChainId();
      if (chainId !== celo.id) {
        await walletClient.switchChain({ id: celo.id });
      }
    } catch (switchErr) {
      console.warn("Network switch skipped/failed:", switchErr);
    }

    const publicClient = getPublicClient();
    const gasPrice = await publicClient.getGasPrice();

    const hash = await walletClient.writeContract({
      account: address,
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "setUsername",
      args: [username],
      type: "legacy",
      gasPrice,
      feeCurrency: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72",
    });

    console.info("Username TX submitted:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    console.error("Failed to register username:", err);
    return false;
  }
}

// ─── Reroll Payment ($0.01 cUSD) ───

/**
 * Pays $0.01 cUSD to reroll shop offers.
 * Inside MiniPay this opens the native payment confirmation.
 * If no wallet is present (guest mode), returns true for free reroll.
 */
export async function payRerollWithMiniPay(): Promise<boolean> {
  const walletClient = getWalletClient();
  if (!walletClient) {
    // No wallet — do not allow free rerolls anymore
    return false;
  }

  try {
    const [address] = await walletClient.requestAddresses();
    if (!address) return false;

    // Switch network to Celo Mainnet if necessary
    try {
      const chainId = await walletClient.getChainId();
      if (chainId !== celo.id) {
        await walletClient.switchChain({ id: celo.id });
      }
    } catch (switchErr) {
      console.warn("Network switch skipped/failed:", switchErr);
    }

    const publicClient = getPublicClient();
    const gasPrice = await publicClient.getGasPrice();

    const hash = await walletClient.writeContract({
      account: address,
      address: USDT_ADDRESS as `0x${string}`,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [REROLL_FEE_RECEIVER as `0x${string}`, REROLL_FEE_AMOUNT],
      type: "legacy",
      gasPrice,
      feeCurrency: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72",
    });

    console.info("Reroll payment TX:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    console.warn("Reroll payment failed:", err);
    return false;
  }
}
