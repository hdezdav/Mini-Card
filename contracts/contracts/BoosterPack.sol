// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title BoosterPack
 * @notice On-chain booster pack with verifiable RNG (blockhash of the previous block).
 *         Players pay $0.02 USDT to open a pack and receive a random Joker.
 *
 * @dev Rarity odds (verifiable on-chain):
 *      Common    60%  (IDs 1-7, 9-12)
 *      Uncommon  25%  (IDs 8, 19)
 *      Rare      12%  (IDs 13-14, 17-18, 21-23)
 *      Legendary  3%  (IDs 15-16, 20)
 *
 * Flow (single transaction):
 *   1. Player calls buyPack() — pays $0.02 USDT, joker is derived from
 *      blockhash(block.number - 1) and stored in the same transaction.
 *   2. Frontend maps the joker ID to the game session.
 *
 * The result is derived from the hash of the block immediately preceding the
 * buy transaction. This is verifiable on-chain by anyone. A validator could
 * theoretically influence the previous block's hash, but doing so to rig a
 * $0.02 pack is economically irrational and would require forgoing block
 * rewards. Because the result is finalized in the same transaction the buyer
 * submits, the buyer cannot pre-simulate the outcome (they do not know which
 * block their transaction will land in) and there is no second transaction to
 * discard an unfavorable roll.
 */
contract BoosterPack {
    // ─── Constants ───
    uint256 public constant PACK_PRICE = 20000; // $0.02 USDT (6 decimals)

    // Joker rarity thresholds (cumulative out of 10000)
    // Common: 0 - 5999 (60%)
    // Uncommon: 6000 - 8499 (25%)
    // Rare: 8500 - 9699 (12%)
    // Legendary: 9700 - 9999 (3%)
    uint16 public constant COMMON_MAX = 6000;
    uint16 public constant UNCOMMON_MAX = 8500;
    uint16 public constant RARE_MAX = 9700;

    // Joker IDs by rarity
    uint8[] public commonIds = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12];
    uint8[] public uncommonIds = [8, 19];
    uint8[] public rareIds = [13, 14, 17, 18, 21, 22, 23];
    uint8[] public legendaryIds = [15, 16, 20];

    // ─── State ───
    IERC20 public immutable usdt;
    address public immutable feeReceiver;

    // Track all opened packs for stats / verification
    struct PackResult {
        address player;
        uint8 jokerId;
        uint256 blockNumber;
        bytes32 blockhashUsed;
        uint256 timestamp;
    }

    PackResult[] public packResults;

    // ─── Events ───
    event PackOpened(address indexed player, uint8 jokerId, bytes32 blockhashUsed, uint256 blockNumber);

    // ─── Errors ───
    error TransferFailed();
    error BlockhashUnavailable();

    constructor(address _usdt, address _feeReceiver) {
        usdt = IERC20(_usdt);
        feeReceiver = _feeReceiver;
    }

    // ─── Buy Pack (single transaction) ───

    /**
     * @notice Buy a booster pack for $0.02 USDT. The joker is derived from
     *         blockhash(block.number - 1) and stored in the same transaction.
     * @dev Requires USDT approval for PACK_PRICE before calling.
     *      The external call (transferFrom) runs before the state write so that a
     *      failed payment reverts the whole tx without recording a pack. This is
     *      NOT classic Checks-Effects-Interactions: the transfer pulls funds FROM
     *      msg.sender (the buyer) and grants no withdrawable credit, so a
     *      reentrant call would only start a second paid purchase — there is no
     *      double-spend path. USDT on Celo is a plain ERC20 with no callback, so
     *      reentrancy is not reachable today; if the accepted token ever gains
     *      transfer hooks, add a reentrancy guard.
     * @return jokerId The joker ID won in the pack (1-23).
     */
    function buyPack() external returns (uint8 jokerId) {
        // Transfer USDT from buyer to fee receiver (reverts on failure)
        bool ok = usdt.transferFrom(msg.sender, feeReceiver, PACK_PRICE);
        if (!ok) revert TransferFailed();

        // Derive the joker from the previous block's hash
        bytes32 hash = blockhash(block.number - 1);
        if (hash == bytes32(0)) revert BlockhashUnavailable();

        jokerId = _deriveJoker(hash);

        // Store result for verification
        packResults.push(PackResult({
            player: msg.sender,
            jokerId: jokerId,
            blockNumber: block.number,
            blockhashUsed: hash,
            timestamp: block.timestamp
        }));

        emit PackOpened(msg.sender, jokerId, hash, block.number);
    }

    // ─── View Functions ───

    /**
     * @notice Get the total number of packs opened.
     */
    function getPackCount() external view returns (uint256) {
        return packResults.length;
    }

    /**
     * @notice Get a paginated range of pack results for stats/verification.
     */
    function getPackResultsRange(uint256 offset, uint256 limit) external view returns (PackResult[] memory) {
        uint256 total = packResults.length;
        if (offset >= total) return new PackResult[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        PackResult[] memory result = new PackResult[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = packResults[i];
        }
        return result;
    }

    /**
     * @notice Get all pack results for a specific player.
     */
    function getPlayerPacks(address player) external view returns (PackResult[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < packResults.length; i++) {
            if (packResults[i].player == player) count++;
        }

        PackResult[] memory result = new PackResult[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < packResults.length; i++) {
            if (packResults[i].player == player) {
                result[idx] = packResults[i];
                idx++;
            }
        }
        return result;
    }

    // ─── Internal: RNG Derivation ───

    /**
     * @dev Derives a joker ID from a blockhash.
     *      1. Convert hash to a number 0-9999
     *      2. Map to rarity tier
     *      3. Pick a random joker within that tier
     */
    function _deriveJoker(bytes32 hash) internal view returns (uint8) {
        // Use the last 2 bytes of the hash for the rarity roll (0-9999)
        uint16 roll = uint16(uint256(hash) % 10000);

        uint8[] memory pool;
        if (roll < COMMON_MAX) {
            pool = commonIds;
        } else if (roll < UNCOMMON_MAX) {
            pool = uncommonIds;
        } else if (roll < RARE_MAX) {
            pool = rareIds;
        } else {
            pool = legendaryIds;
        }

        // Use a different slice of the hash for the joker index within the tier
        uint256 indexHash = uint256(hash) >> 16;
        uint256 idx = indexHash % pool.length;
        return pool[idx];
    }
}
