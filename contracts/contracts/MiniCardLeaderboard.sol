// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal read interface for the deployed v1 MiniCardLeaderboard.
///         v1 had no username uniqueness and no migration plumbing.
interface IV1Leaderboard {
    struct V1ScoreEntry {
        address player;
        uint256 score;
        uint256 round;
        uint256 timestamp;
    }

    function getScoresCount() external view returns (uint256);
    function getAllScores() external view returns (V1ScoreEntry[] memory);
    function getUsernames(address[] calldata) external view returns (string[] memory);
    function usernames(address) external view returns (string memory);
    function personalBest(address) external view returns (uint256);
}

contract MiniCardLeaderboard {
    struct ScoreEntry {
        address player;
        uint256 score;
        uint256 round;
        uint256 timestamp;
    }

    // List of all scores submitted
    ScoreEntry[] public scores;

    // Mapping to track each player's highest score
    mapping(address => uint256) public personalBest;

    // Mapping from player address to unique username
    mapping(address => string) public usernames;

    // Reverse mapping to enforce username uniqueness
    mapping(bytes32 => address) public usernameOwner;

    // Whether a player has set a username
    mapping(address => bool) public hasUsername;

    // ─── Migration plumbing (v2) ────────────────────────────────────────────
    address public owner;
    bool public migrationEnabled = true;
    uint256 public migratedScoresCursor;
    address public immutable oldLeaderboard;

    event ScoreSubmitted(address indexed player, uint256 score, uint256 round, uint256 timestamp);
    event UsernameSet(address indexed player, string username);

    // Migration events
    event MigratedScores(uint256 indexed from, uint256 indexed to, uint256 total);
    event MigratedUsernames(uint256 count);
    event MigrationUsernameCollision(address indexed player, string name, address indexed existingOwner);

    constructor(address _oldLeaderboard) {
        owner = msg.sender;
        oldLeaderboard = _oldLeaderboard;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @notice Migrate a batch of scores from the v1 leaderboard, preserving
     *         original timestamps. Idempotent via migratedScoresCursor.
     * @param batchSize Number of v1 scores to copy in this call.
     */
    function migrateScores(uint256 batchSize) external onlyOwner {
        require(migrationEnabled, "Migration locked");
        IV1Leaderboard v1 = IV1Leaderboard(oldLeaderboard);
        IV1Leaderboard.V1ScoreEntry[] memory allScores = v1.getAllScores();
        uint256 total = allScores.length;
        uint256 cursor = migratedScoresCursor;
        if (cursor >= total) return;

        uint256 end = cursor + batchSize;
        if (end > total) end = total;

        for (uint256 i = cursor; i < end; i++) {
            address player = allScores[i].player;
            uint256 score = allScores[i].score;
            // Preserve original timestamp — do NOT use block.timestamp
            scores.push(ScoreEntry({
                player: player,
                score: score,
                round: allScores[i].round,
                timestamp: allScores[i].timestamp
            }));
            if (score > personalBest[player]) {
                personalBest[player] = score;
            }
        }
        migratedScoresCursor = end;
        emit MigratedScores(cursor, end, total);
    }

    /**
     * @notice Migrate usernames for a list of players from v1. Idempotent:
     *         skips players that already have a username in v2, and skips
     *         addresses for which v1 had no username. Collisions (v1 had no
     *         uniqueness) are skipped and emit MigrationUsernameCollision so
     *         the affected user can re-register on next app open.
     */
    function migrateUsernames(address[] calldata players) external onlyOwner {
        require(migrationEnabled, "Migration locked");
        IV1Leaderboard v1 = IV1Leaderboard(oldLeaderboard);
        string[] memory names = v1.getUsernames(players);
        uint256 migrated = 0;
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            string memory name = names[i];
            if (hasUsername[player]) continue;          // idempotent — already migrated
            if (bytes(name).length == 0) continue;       // v1 had no username for this address

            bytes32 h = keccak256(abi.encodePacked(name));
            address existing = usernameOwner[h];
            if (existing == address(0)) {
                usernames[player] = name;
                usernameOwner[h] = player;
                hasUsername[player] = true;
                migrated++;
            } else {
                // v1 had no uniqueness — collision. Skip and emit; user re-registers on next open.
                emit MigrationUsernameCollision(player, name, existing);
            }
        }
        emit MigratedUsernames(migrated);
    }

    /**
     * @notice Permanently disable all migration entrypoints. Call after
     *         verifying the migration is complete.
     */
    function lockMigration() external onlyOwner {
        migrationEnabled = false;
    }

    /**
     * @notice Transfer contract ownership to a new address.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    /**
     * @notice Set or update the player's username. Username must be unique.
     * @param _username The unique username (1-20 chars).
     */
    function setUsername(string calldata _username) external {
        require(bytes(_username).length > 0, "Username cannot be empty");
        require(bytes(_username).length <= 20, "Username too long");

        bytes32 usernameHash = keccak256(abi.encodePacked(_username));
        address currentOwner = usernameOwner[usernameHash];
        require(currentOwner == address(0) || currentOwner == msg.sender, "Username already taken");

        // If updating, free the old username hash
        if (bytes(usernames[msg.sender]).length > 0) {
            bytes32 oldHash = keccak256(abi.encodePacked(usernames[msg.sender]));
            delete usernameOwner[oldHash];
        }

        usernames[msg.sender] = _username;
        usernameOwner[usernameHash] = msg.sender;
        hasUsername[msg.sender] = true;
        emit UsernameSet(msg.sender, _username);
    }

    /**
     * @notice Resolve multiple usernames at once to minimize RPC requests.
     */
    function getUsernames(address[] calldata _players) external view returns (string[] memory) {
        string[] memory list = new string[](_players.length);
        for (uint256 i = 0; i < _players.length; i++) {
            list[i] = usernames[_players[i]];
        }
        return list;
    }

    /**
     * @notice Submit a new score after a game ends. Requires a username to be set first.
     * @param _score The final score of the run.
     * @param _round The round number reached.
     */
    function submitScore(uint256 _score, uint256 _round) external {
        require(_score > 0, "Score must be greater than 0");
        require(hasUsername[msg.sender], "Must set a username before submitting scores");

        if (_score > personalBest[msg.sender]) {
            personalBest[msg.sender] = _score;
        }

        scores.push(ScoreEntry({
            player: msg.sender,
            score: _score,
            round: _round,
            timestamp: block.timestamp
        }));

        emit ScoreSubmitted(msg.sender, _score, _round, block.timestamp);
    }

    /**
     * @notice Returns the total number of recorded scores.
     */
    function getScoresCount() external view returns (uint256) {
        return scores.length;
    }

    /**
     * @notice Get a paginated range of scores. Use offset + limit to paginate.
     * @param _offset Starting index (0-based).
     * @param _limit Maximum number of entries to return.
     */
    function getScoresRange(uint256 _offset, uint256 _limit) external view returns (ScoreEntry[] memory) {
        uint256 total = scores.length;
        if (_offset >= total) {
            return new ScoreEntry[](0);
        }

        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }

        ScoreEntry[] memory result = new ScoreEntry[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = scores[i];
        }
        return result;
    }

    /**
     * @notice Get all submitted scores. Deprecated — use getScoresRange for pagination.
     * Only kept for backwards compatibility with the deployed v1 contract.
     */
    function getAllScores() external view returns (ScoreEntry[] memory) {
        return scores;
    }
}
