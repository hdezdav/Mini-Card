import { createPublicClient, createWalletClient, custom, http } from "viem";
import { celo } from "viem/chains";

// ─── Celo Mainnet Configuration ───
// MiniPay runs on Celo Mainnet (chain 42220)
export const TARGET_CHAIN = celo;

// ─── Leaderboard Contract ───
// Deploy via:  cd contracts && npm run deploy:mainnet
// Then paste the deployed address here:
export const LEADERBOARD_CONTRACT_ADDRESS: string = "0xC16Aa3a4C57E3A7fE4730B8746F530778B13645d";

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
  score: number;
  round: number;
  date: string;
}

// ─── cUSD on Celo Mainnet ───
// MiniPay uses cUSD as primary stablecoin
const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

// Fee receiver for reroll payments — change to your own wallet!
const REROLL_FEE_RECEIVER = "0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE";

// $0.01 cUSD (18 decimals)
const REROLL_FEE_AMOUNT = BigInt("10000000000000000"); // 0.01 * 10^18

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
  const provider = getProvider();
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

    const publicClient = getPublicClient();

    const { request } = await publicClient.simulateContract({
      account: address,
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "submitScore",
      args: [BigInt(score), BigInt(round)],
      feeCurrency: CUSD_ADDRESS as `0x${string}`,
    });

    const hash = await walletClient.writeContract(request);
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

    if (!result) return [];

    return result.map((entry: any) => ({
      address: entry.player,
      score: Number(entry.score),
      round: Number(entry.round),
      date: new Date(Number(entry.timestamp) * 1000).toLocaleDateString(),
    }));
  } catch (err) {
    console.error("Failed to read scores:", err);
    return [];
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
    // No wallet — free reroll in guest/dev mode
    return true;
  }

  try {
    const [address] = await walletClient.requestAddresses();
    if (!address) return false;

    const publicClient = getPublicClient();

    const { request } = await publicClient.simulateContract({
      account: address,
      address: CUSD_ADDRESS as `0x${string}`,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [REROLL_FEE_RECEIVER as `0x${string}`, REROLL_FEE_AMOUNT],
      feeCurrency: CUSD_ADDRESS as `0x${string}`,
    });

    const hash = await walletClient.writeContract(request);
    console.info("Reroll payment TX:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    console.warn("Reroll payment failed:", err);
    return false;
  }
}
