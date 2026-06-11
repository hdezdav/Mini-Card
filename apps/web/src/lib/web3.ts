import { createPublicClient, createWalletClient, custom, http } from "viem";
import { celo, celoSepolia } from "viem/chains";

// Place your deployed contract address here (Mainnet or Sepolia)
// Setting to zero-address as placeholder - the client falls back to localStorage if this is zero or fails
export const LEADERBOARD_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

// Select network depending on your environment (celo or celoSepolia)
export const TARGET_CHAIN = celoSepolia;

export const MINICARD_LEADERBOARD_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_score",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_round",
        "type": "uint256"
      }
    ],
    "name": "submitScore",
    "outputs": [],
    "stateMutability": "external",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllScores",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "player",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "score",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "round",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct MiniCardLeaderboard.ScoreEntry[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getScoresCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "personalBest",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface LeaderboardEntry {
  address: string;
  score: number;
  round: number;
  date: string;
}

/**
 * Gets a viem public client for Celo
 */
function getPublicClient() {
  return createPublicClient({
    chain: TARGET_CHAIN,
    transport: http(),
  });
}

/**
 * Submits the score to Celo MiniCardLeaderboard contract.
 * Returns true if the transaction was successfully submitted, false otherwise.
 */
export async function submitScoreToCelo(score: number, round: number): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    return false;
  }
  
  if (LEADERBOARD_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.info("Leaderboard contract address is set to 0x0. Falling back to local storage.");
    return false;
  }

  try {
    const walletClient = createWalletClient({
      chain: TARGET_CHAIN,
      transport: custom((window as any).ethereum),
    });

    const [address] = await walletClient.requestAddresses();
    if (!address) return false;

    const publicClient = getPublicClient();

    // Call submitScore on the contract
    const { request } = await publicClient.simulateContract({
      account: address,
      address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: MINICARD_LEADERBOARD_ABI,
      functionName: "submitScore",
      args: [BigInt(score), BigInt(round)],
    });

    const hash = await walletClient.writeContract(request);
    console.info("Transaction submitted. Hash:", hash);

    // Wait for the transaction to be mined
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    console.error("Failed to submit score to Celo contract:", err);
    return false;
  }
}

// cUSD contract on Celo Mainnet & Alfajores/Sepolia testnets
const CUSD_ADDRESS_MAINNET = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const CUSD_ADDRESS_TESTNET = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";

// Fee receiver — change to your own wallet
const REROLL_FEE_RECEIVER = "0x0000000000000000000000000000000000000001";

// $0.01 cUSD — cUSD has 18 decimals
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

/**
 * Pays $0.01 cUSD (MiniPay stablecoin) to reroll the shop offers.
 * Returns true if payment succeeds, false if skipped / failed.
 */
export async function payRerollWithMiniPay(): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    // No wallet — allow free reroll in dev/guest mode
    return true;
  }

  try {
    const walletClient = createWalletClient({
      chain: TARGET_CHAIN,
      transport: custom((window as any).ethereum),
    });

    const [address] = await walletClient.requestAddresses();
    if (!address) return false;

    const cusdAddress =
      TARGET_CHAIN.id === celo.id ? CUSD_ADDRESS_MAINNET : CUSD_ADDRESS_TESTNET;

    const publicClient = getPublicClient();

    const { request } = await publicClient.simulateContract({
      account: address,
      address: cusdAddress as `0x${string}`,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [REROLL_FEE_RECEIVER as `0x${string}`, REROLL_FEE_AMOUNT],
    });

    const hash = await walletClient.writeContract(request);
    console.info("Reroll payment hash:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  } catch (err) {
    console.warn("Reroll payment failed or rejected:", err);
    return false;
  }
}

/**
 * Fetches all scores from the Celo MiniCardLeaderboard contract.
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
    console.error("Failed to read scores from Celo contract:", err);
    return [];
  }
}
