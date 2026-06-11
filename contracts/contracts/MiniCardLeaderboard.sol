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

    event ScoreSubmitted(address indexed player, uint256 score, uint256 round, uint256 timestamp);

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
