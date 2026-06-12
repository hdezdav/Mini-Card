// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

    event ScoreSubmitted(address indexed player, uint256 score, uint256 round, uint256 timestamp);
    event UsernameSet(address indexed player, string username);

    /**
     * @notice Set or update the player's username.
     * @param _username The unique username.
     */
    function setUsername(string calldata _username) external {
        require(bytes(_username).length > 0, "Username cannot be empty");
        require(bytes(_username).length <= 20, "Username too long");
        usernames[msg.sender] = _username;
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
     * @notice Submit a new score after a game ends.
     * @param _score The final score of the run.
     * @param _round The round number reached.
     */
    function submitScore(uint256 _score, uint256 _round) external {
        require(_score > 0, "Score must be greater than 0");

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
     * @notice Get all submitted scores.
     */
    function getAllScores() external view returns (ScoreEntry[] memory) {
        return scores;
    }
}
