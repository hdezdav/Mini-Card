import { createPublicClient, createWalletClient, custom, http, parseEventLogs } from "viem";
import { celo } from "viem/chains";

// ─── Celo Mainnet Configuration ───
// MiniPay runs on Celo Mainnet (chain 42220)
export const TARGET_CHAIN = celo;

// ─── Leaderboard Contract ───
// Deploy via:  cd contracts && npm run deploy:mainnet
// Then paste the deployed address here:
export const LEADERBOARD_CONTRACT_ADDRESS: string = "0x2c617C7FEa23e4C824279951e94Fa5994C025063";

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
    inputs: [
      { internalType: "uint256", name: "_offset", type: "uint256" },
      { internalType: "uint256", name: "_limit", type: "uint256" },
    ],
    name: "getScoresRange",
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
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "hasUsername",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
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

// ─── BoosterPack Contract ───
// Deploy via:  cd contracts && npm run deploy:mainnet
// Then paste the deployed address here:
export const BOOSTER_PACK_CONTRACT_ADDRESS: string = "0x3d27B1B090DAD9D9ff8E42B4D892B62f1E40C6Cb"; // TODO: set after deploy

export const BOOSTER_PACK_ABI = [
  {
    type: "event",
    name: "PackOpened",
    inputs: [
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint8", name: "jokerId", type: "uint8" },
      { indexed: false, internalType: "bytes32", name: "blockhashUsed", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "blockNumber", type: "uint256" },
    ],
  },
  {
    inputs: [
      { internalType: "address", name: "_usdt", type: "address" },
      { internalType: "address", name: "_feeReceiver", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "buyPack",
    outputs: [{ internalType: "uint8", name: "jokerId", type: "uint8" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getPackCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getPackResultsRange",
    outputs: [
      {
        components: [
          { internalType: "address", name: "player", type: "address" },
          { internalType: "uint8", name: "jokerId", type: "uint8" },
          { internalType: "uint256", name: "blockNumber", type: "uint256" },
          { internalType: "bytes32", name: "blockhashUsed", type: "bytes32" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
        ],
        internalType: "struct BoosterPack.PackResult[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "player", type: "address" }],
    name: "getPlayerPacks",
    outputs: [
      {
        components: [
          { internalType: "address", name: "player", type: "address" },
          { internalType: "uint8", name: "jokerId", type: "uint8" },
          { internalType: "uint256", name: "blockNumber", type: "uint256" },
          { internalType: "bytes32", name: "blockhashUsed", type: "bytes32" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
        ],
        internalType: "struct BoosterPack.PackResult[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PACK_PRICE",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ERC20 ABI for approve (used by BoosterPack)
const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── USDT on Celo Mainnet ───
// USDT contract address: 0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e
const USDT_ADDRESS = "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e";

// MiniPay Deposit deeplink — redirect here when a payment fails due to
// insufficient stablecoin balance (MiniPay submission requirement §6).
// Canonical list: https://docs.minipay.xyz/technical-references/deeplinks.html
export const MINIPAY_DEPOSIT_DEEPLINK = "https://link.minipay.xyz/add_cash?tokens=USDT";

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

// ─── Insufficient-balance detection ───
// MiniPay requires redirecting to the Deposit deeplink instead of showing a
// generic error when a payment fails because the user lacks funds. We inspect
// the revert reason / error code from the wallet rejection.
function isInsufficientBalanceError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? (err as any)?.shortMessage ?? err ?? "").toLowerCase();
  return (
    msg.includes("insufficient") ||
    msg.includes("balance") ||
    msg.includes("funds") ||
    msg.includes("underflow") ||
    // viem error code for ERC20 transfer exceeding balance
    msg.includes("0x") && (msg.includes("2c") || msg.includes("transfer amount exceeds balance"))
  );
}

/**
 * On a payment failure, redirect MiniPay users to the Deposit deeplink when the
 * cause is insufficient balance. Returns true if redirected, false otherwise.
 */
export function handlePaymentFailure(err: unknown): boolean {
  if (!isInsufficientBalanceError(err)) return false;
  if (typeof window !== "undefined" && isMiniPay()) {
    window.location.href = MINIPAY_DEPOSIT_DEEPLINK;
    return true;
  }
  return false;
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

    const hash = await walletClient.writeContract({
      account: address,
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "submitScore",
      args: [BigInt(score), BigInt(round)],
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
 * Fetches all scores from the leaderboard contract using pagination.
 * Fetches in chunks of 100 to avoid gas/size limits as the scores array grows.
 */
export async function getScoresFromCelo(): Promise<LeaderboardEntry[]> {
  if (LEADERBOARD_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return [];
  }

  try {
    const publicClient = getPublicClient();

    // Get total count first
    const totalCount = (await publicClient.readContract({
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "getScoresCount",
    })) as bigint;

    const total = Number(totalCount);
    if (total === 0) return [];

    // Paginate: fetch in chunks of 100
    const PAGE_SIZE = 100;
    const allResults: any[] = [];

    for (let offset = 0; offset < total; offset += PAGE_SIZE) {
      const limit = Math.min(PAGE_SIZE, total - offset);
      const page = (await publicClient.readContract({
        address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
        abi: MINICARD_LEADERBOARD_ABI,
        functionName: "getScoresRange",
        args: [BigInt(offset), BigInt(limit)],
      })) as any[];
      allResults.push(...page);
    }

    if (allResults.length === 0) return [];

    // Batch resolve usernames
    const players = Array.from(new Set(allResults.map((entry: any) => entry.player as string))) as `0x${string}`[];
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

    const mapped = allResults.map((entry: any) => ({
      address: entry.player,
      username: usernameMap[entry.player.toLowerCase()] || undefined,
      score: Number(entry.score),
      round: Number(entry.round),
      date: new Date(Number(entry.timestamp) * 1000).toLocaleDateString(),
      timestamp: Number(entry.timestamp),
    }));

    // Keep only the highest score entry for each player address (matches personalBest on-chain)
    const uniqueMap: Record<string, LeaderboardEntry & { timestamp?: number }> = {};
    for (const entry of mapped) {
      const playerKey = entry.address.toLowerCase();
      if (!uniqueMap[playerKey] || entry.score > uniqueMap[playerKey].score) {
        uniqueMap[playerKey] = entry;
      }
    }

    return Object.values(uniqueMap).map(({ address, username, score, round, date }) => ({
      address,
      username,
      score,
      round,
      date,
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
 * Checks whether a wallet address has set a username on-chain.
 */
export async function checkHasUsername(address: string): Promise<boolean> {
  if (LEADERBOARD_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000" || !address || address.startsWith("0xceloGuest")) {
    return false;
  }

  try {
    const publicClient = getPublicClient();
    const has = (await publicClient.readContract({
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "hasUsername",
      args: [address as `0x${string}`],
    })) as boolean;

    return has;
  } catch (err) {
    console.warn("Failed to check hasUsername for address:", err);
    return false;
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

    const hash = await walletClient.writeContract({
      account: address,
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "setUsername",
      args: [username],
    });

    console.info("Username TX submitted:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    console.error("Failed to register username:", err);
    return false;
  }
}

// ─── Reroll Payment ($0.01 USDm) ───

/**
 * Pays $0.01 USDm (USDT) to reroll shop offers.
 * Inside MiniPay this opens the native payment confirmation.
 * If no wallet is present (guest mode), returns true for free reroll.
 *
 * Throws the underlying error so the caller can detect insufficient balance
 * and redirect to the MiniPay Deposit deeplink (see handlePaymentFailure).
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

    const hash = await walletClient.writeContract({
      account: address,
      address: USDT_ADDRESS as `0x${string}`,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [REROLL_FEE_RECEIVER as `0x${string}`, REROLL_FEE_AMOUNT],
    });

    console.info("Reroll payment TX:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    // Re-throw so callers can detect insufficient balance and redirect to Deposit.
    if (isInsufficientBalanceError(err)) throw err;
    console.warn("Reroll payment failed:", err);
    return false;
  }
}

/**
 * Pays $0.01 USDT to restart the game immediately (bypassing the 24h cooldown).
 *
 * Throws the underlying error on insufficient balance so the caller can
 * redirect to the MiniPay Deposit deeplink (see handlePaymentFailure).
 */
export async function payRestartWithMiniPay(): Promise<boolean> {
  const walletClient = getWalletClient();
  if (!walletClient) {
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

    const hash = await walletClient.writeContract({
      account: address,
      address: USDT_ADDRESS as `0x${string}`,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [REROLL_FEE_RECEIVER as `0x${string}`, REROLL_FEE_AMOUNT],
    });

    console.info("Restart payment TX:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    // Re-throw so callers can detect insufficient balance and redirect to Deposit.
    if (isInsufficientBalanceError(err)) throw err;
    console.warn("Restart payment failed:", err);
    return false;
  }
}

// ─── Booster Pack ($0.02 USDT, on-chain RNG) ───

/**
 * Step 1: Approve USDT spending for the BoosterPack contract.
 * Required before calling buyPack(). Approves exactly PACK_PRICE ($0.02).
 */
export async function approveBoosterPack(): Promise<boolean> {
  const walletClient = getWalletClient();
  if (!walletClient) return false;
  if (BOOSTER_PACK_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") return false;

  try {
    const [address] = await walletClient.requestAddresses();
    if (!address) return false;

    try {
      const chainId = await walletClient.getChainId();
      if (chainId !== celo.id) {
        await walletClient.switchChain({ id: celo.id });
      }
    } catch (switchErr) {
      console.warn("Network switch skipped/failed:", switchErr);
    }

    const publicClient = getPublicClient();

    // Approve PACK_PRICE = 20000 (0.02 USDT, 6 decimals)
    const hash = await walletClient.writeContract({
      account: address,
      address: USDT_ADDRESS as `0x${string}`,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [BOOSTER_PACK_CONTRACT_ADDRESS as `0x${string}`, BigInt(20000)],
    });

    console.info("BoosterPack approve TX:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    if (isInsufficientBalanceError(err)) throw err;
    console.error("Failed to approve BoosterPack:", err);
    return false;
  }
}

/**
 * Outcome of a booster pack purchase.
 * - "opened": the pack was opened on-chain and the joker ID was read back.
 * - "reverted": the transaction reverted — no USDT moved, no pack opened. Safe to retry.
 * - "unreadable": the transaction SUCCEEDED (USDT was paid, a pack was opened) but the
 *   PackOpened event could not be parsed. The caller MUST NOT retry — the user already paid.
 *   The joker exists on-chain in packResults but the frontend could not read it.
 */
export type BoosterPackResult =
  | { status: "opened"; jokerId: number }
  | { status: "reverted" }
  | { status: "unreadable" };

/**
 * Buys a booster pack in a single transaction. Pays $0.02 USDT and derives
 * the joker from blockhash(block.number - 1) on-chain. The joker ID is read
 * back from the PackOpened event in the transaction receipt.
 *
 * Returns a discriminated result so the caller can tell a reverted tx (safe to
 * retry) from a succeeded tx whose result could not be parsed (the user already
 * paid — do NOT retry).
 *
 * Throws on insufficient balance so the caller can redirect to Deposit deeplink.
 */
export async function buyBoosterPack(): Promise<BoosterPackResult> {
  const walletClient = getWalletClient();
  if (!walletClient) return { status: "reverted" };
  if (BOOSTER_PACK_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return { status: "reverted" };
  }

  try {
    const [address] = await walletClient.requestAddresses();
    if (!address) return { status: "reverted" };

    try {
      const chainId = await walletClient.getChainId();
      if (chainId !== celo.id) {
        await walletClient.switchChain({ id: celo.id });
      }
    } catch (switchErr) {
      console.warn("Network switch skipped/failed:", switchErr);
    }

    const publicClient = getPublicClient();

    const hash = await walletClient.writeContract({
      account: address,
      address: BOOSTER_PACK_CONTRACT_ADDRESS as `0x${string}`,
      abi: BOOSTER_PACK_ABI,
      functionName: "buyPack",
    });

    console.info("BoosterPack buy TX:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // A reverted tx moved no funds and opened no pack — safe to retry.
    if (receipt.status === "reverted") {
      console.warn("BoosterPack buy tx reverted:", hash);
      return { status: "reverted" };
    }

    // Parse the PackOpened event to get the jokerId
    const decodedLogs = parseEventLogs({
      abi: BOOSTER_PACK_ABI,
      logs: receipt.logs,
    });

    for (const log of decodedLogs) {
      if (log.eventName === "PackOpened" && log.args) {
        const jokerId = Number((log.args as any).jokerId);
        console.info("BoosterPack opened jokerId:", jokerId);
        return { status: "opened", jokerId };
      }
    }

    // Tx SUCCEEDED but no PackOpened log was parsed. The user paid and a pack
    // was opened on-chain, but the frontend cannot read the result. Do NOT retry.
    console.error("BoosterPack tx succeeded but PackOpened event not found:", hash);
    return { status: "unreadable" };
  } catch (err) {
    if (isInsufficientBalanceError(err)) throw err;
    console.error("Failed to buy booster pack:", err);
    return { status: "reverted" };
  }
}


