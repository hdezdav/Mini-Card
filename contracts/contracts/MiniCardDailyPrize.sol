// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// --- Minimal ERC-20 interface (USDT on Celo) ---------------------------------
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MiniCardDailyPrize
 * @notice Daily tournament contract for MiniCard on Celo.
 *
 * FLOW
 * ----
 * 1. Players call enterEpoch() once per UTC day, paying entryFee USDT.
 * 2. During the epoch they call submitScore() freely; only the personal
 *    best per epoch is stored on-chain.
 * 3. After UTC midnight anyone calls finalize(epochId) to lock results,
 *    pick the top scorer, send the platform cut to feeReceiver, and
 *    record the net prize for the winner.
 * 4. The winner calls claimPrize(epochId) to withdraw their USDT.
 *
 * SECURITY
 * --------
 * - MAX_PLAUSIBLE_SCORE (500 M) rejects implausible scores.
 * - Only paid entrants may submit scores.
 * - finalize() is permissionless but idempotent-guarded (reverts if already done).
 * - claimPrize() sets the claimed flag before the transfer (reentrancy safe).
 * - USDT approval required off-chain before enterEpoch().
 *
 * Epoch IDs = block.timestamp / 86400  (UTC day number since Unix epoch).
 */
contract MiniCardDailyPrize {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct PlayerEntry {
        bool    entered;    // has the player paid for this epoch?
        uint256 bestScore;  // highest score submitted this epoch
        uint256 bestRound;  // round reached with bestScore
    }

    struct EpochResult {
        bool    finalized;    // set after finalize() succeeds
        address winner;       // top scorer address
        uint256 winnerScore;  // winning score
        uint256 prizeAmount;  // net prize (pool minus platform cut)
        uint256 totalPool;    // gross entry fee pool
        uint256 entrantCount; // unique entrant count
        bool    claimed;      // true once winner has withdrawn
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant EPOCH_DURATION      = 1 days;
    uint256 public constant MAX_PLAUSIBLE_SCORE = 500_000_000;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IERC20  public immutable usdt;
    address public feeReceiver;
    address public owner;

    /// @notice Entry fee in USDT (6-decimal). Default $0.10 = 100_000.
    uint256 public entryFee = 100_000;

    /// @notice Platform cut in basis points (1 BPS = 0.01%). Default 10%.
    uint256 public platformFeeBps = 1_000;

    // epochId => player => PlayerEntry
    mapping(uint256 => mapping(address => PlayerEntry)) public entries;

    // epochId => ordered list of unique entrant addresses
    mapping(uint256 => address[]) private _entrants;

    // epochId => finalization result
    mapping(uint256 => EpochResult) public results;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Entered(address indexed player, uint256 indexed epochId, uint256 fee);
    event ScoreSubmitted(address indexed player, uint256 indexed epochId, uint256 score, uint256 round);
    event EpochFinalized(
        uint256 indexed epochId,
        address indexed winner,
        uint256 winnerScore,
        uint256 prizeAmount,
        uint256 platformCut
    );
    event PrizeClaimed(address indexed winner, uint256 indexed epochId, uint256 amount);
    event EntryFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformFeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event FeeReceiverUpdated(address oldReceiver, address newReceiver);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _usdt        USDT token address on Celo (6 decimals).
     * @param _feeReceiver Address that receives the platform fee cut.
     */
    constructor(address _usdt, address _feeReceiver) {
        require(_usdt        != address(0), "Zero USDT address");
        require(_feeReceiver != address(0), "Zero fee receiver");
        usdt        = IERC20(_usdt);
        feeReceiver = _feeReceiver;
        owner       = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // -------------------------------------------------------------------------
    // Public helpers
    // -------------------------------------------------------------------------

    /// @notice Returns the current epoch ID (UTC day number).
    function currentEpoch() public view returns (uint256) {
        return block.timestamp / EPOCH_DURATION;
    }

    /// @notice Returns the UTC timestamp at which the given epoch ends.
    function epochEnd(uint256 epochId) public pure returns (uint256) {
        return (epochId + 1) * EPOCH_DURATION;
    }

    /// @notice True if an epoch has ended and can be finalized.
    function epochEnded(uint256 epochId) public view returns (bool) {
        return block.timestamp >= epochEnd(epochId);
    }

    /// @notice Returns all entrant addresses for an epoch.
    function getEntrants(uint256 epochId) external view returns (address[] memory) {
        return _entrants[epochId];
    }

    // -------------------------------------------------------------------------
    // Player entrypoints
    // -------------------------------------------------------------------------

    /**
     * @notice Pay the entry fee to participate in today's epoch.
     *         Pre-approve this contract to spend `entryFee` USDT first.
     *         Can only be called once per epoch per address.
     */
    function enterEpoch() external {
        uint256 epochId = currentEpoch();
        require(!epochEnded(epochId),                  "Epoch already ended");
        require(!entries[epochId][msg.sender].entered, "Already entered this epoch");

        uint256 fee = entryFee;
        require(
            usdt.transferFrom(msg.sender, address(this), fee),
            "USDT transfer failed"
        );

        entries[epochId][msg.sender].entered = true;
        _entrants[epochId].push(msg.sender);

        emit Entered(msg.sender, epochId, fee);
    }

    /**
     * @notice Submit (or improve) your score for the current epoch.
     *         Scores above MAX_PLAUSIBLE_SCORE are rejected.
     *         Only paid entrants may call this.
     *
     * @param _score  Final score of the run.
     * @param _round  Round number reached (audit / tiebreaker field).
     */
    function submitScore(uint256 _score, uint256 _round) external {
        uint256 epochId = currentEpoch();
        require(!epochEnded(epochId),                  "Epoch already ended");
        require(entries[epochId][msg.sender].entered,  "Not entered in this epoch");
        require(_score > 0,                            "Score must be > 0");
        require(_score <= MAX_PLAUSIBLE_SCORE,         "Score exceeds plausibility cap");

        PlayerEntry storage entry = entries[epochId][msg.sender];
        if (_score > entry.bestScore) {
            entry.bestScore = _score;
            entry.bestRound = _round;
            emit ScoreSubmitted(msg.sender, epochId, _score, _round);
        }
    }

    // -------------------------------------------------------------------------
    // Finalization
    // -------------------------------------------------------------------------

    /**
     * @notice Lock results for a past epoch, determine the winner, send the
     *         platform cut to feeReceiver, and record the net prize.
     *         Callable by anyone once the epoch has ended.
     *
     * @param epochId  The epoch to finalize. Must be in the past.
     */
    function finalize(uint256 epochId) external {
        require(epochEnded(epochId),         "Epoch not yet ended");
        require(!results[epochId].finalized, "Already finalized");

        address[] storage entrants = _entrants[epochId];
        uint256 count = entrants.length;

        EpochResult storage result = results[epochId];
        result.finalized    = true;
        result.entrantCount = count;

        uint256 pool     = count * entryFee;
        result.totalPool = pool;

        if (count == 0) {
            emit EpochFinalized(epochId, address(0), 0, 0, 0);
            return;
        }

        // Find winner: highest bestScore; first-entered wins ties
        address winner   = address(0);
        uint256 topScore = 0;
        for (uint256 i = 0; i < count; i++) {
            address player = entrants[i];
            uint256 score  = entries[epochId][player].bestScore;
            if (score > topScore) {
                topScore = score;
                winner   = player;
            }
        }

        uint256 platformCut = (pool * platformFeeBps) / 10_000;
        uint256 prize       = pool - platformCut;

        result.winner      = winner;
        result.winnerScore = topScore;
        result.prizeAmount = prize;

        if (platformCut > 0) {
            require(
                usdt.transfer(feeReceiver, platformCut),
                "Platform fee transfer failed"
            );
        }

        emit EpochFinalized(epochId, winner, topScore, prize, platformCut);
    }

    // -------------------------------------------------------------------------
    // Prize claim
    // -------------------------------------------------------------------------

    /**
     * @notice Withdraw the prize for a finalized epoch.
     *         Only callable by the winner of that epoch.
     *
     * @param epochId  The epoch whose prize is being claimed.
     */
    function claimPrize(uint256 epochId) external {
        EpochResult storage result = results[epochId];
        require(result.finalized,            "Epoch not finalized yet");
        require(result.winner == msg.sender, "Not the winner");
        require(!result.claimed,             "Prize already claimed");
        require(result.prizeAmount > 0,      "No prize to claim");

        // Set claimed BEFORE transfer (reentrancy guard)
        result.claimed = true;

        require(
            usdt.transfer(msg.sender, result.prizeAmount),
            "Prize transfer failed"
        );

        emit PrizeClaimed(msg.sender, epochId, result.prizeAmount);
    }

    // -------------------------------------------------------------------------
    // Emergency recovery
    // -------------------------------------------------------------------------

    /**
     * @notice Recover USDT stuck in the contract (e.g., zero-entrant epochs).
     *         Use responsibly — does not verify unclaimed prize balances.
     *
     * @param amount  Amount of USDT (6-decimal) to recover.
     */
    function recoverUSDT(uint256 amount) external onlyOwner {
        require(usdt.transfer(owner, amount), "Recovery transfer failed");
    }

    // -------------------------------------------------------------------------
    // Owner configuration
    // -------------------------------------------------------------------------

    /// @notice Update the entry fee for future epochs. Must be > 0.
    function setEntryFee(uint256 newFee) external onlyOwner {
        require(newFee > 0, "Fee must be > 0");
        emit EntryFeeUpdated(entryFee, newFee);
        entryFee = newFee;
    }

    /// @notice Update the platform fee. Hard cap 30% (3000 BPS).
    function setPlatformFeeBps(uint256 newBps) external onlyOwner {
        require(newBps <= 3_000, "Fee cannot exceed 30%");
        emit PlatformFeeBpsUpdated(platformFeeBps, newBps);
        platformFeeBps = newBps;
    }

    /// @notice Update the address that receives platform fees.
    function setFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Zero address");
        emit FeeReceiverUpdated(feeReceiver, newReceiver);
        feeReceiver = newReceiver;
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /// @notice Snapshot of a player's entry for a given epoch.
    function playerEntry(uint256 epochId, address player)
        external view
        returns (bool entered, uint256 bestScore, uint256 bestRound)
    {
        PlayerEntry storage e = entries[epochId][player];
        return (e.entered, e.bestScore, e.bestRound);
    }

    /**
     * @notice Full leaderboard snapshot for a given epoch.
     *         Returns parallel arrays of addresses and best scores. Sort off-chain.
     */
    function epochLeaderboard(uint256 epochId)
        external view
        returns (address[] memory players, uint256[] memory scores)
    {
        address[] storage entrants = _entrants[epochId];
        uint256 n = entrants.length;
        players = new address[](n);
        scores  = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            players[i] = entrants[i];
            scores[i]  = entries[epochId][entrants[i]].bestScore;
        }
    }
}