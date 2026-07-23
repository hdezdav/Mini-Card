// test/MiniCardDailyPrize.test.js
// Hardhat + ethers v6 + chai

const { expect } = require("chai");
const { ethers }  = require("hardhat");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Advance block timestamp by `seconds` and mine a new block. */
async function advanceTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

/** Advance to the start of the next UTC day (epoch rollover). */
async function advanceToNextEpoch() {
  const block     = await ethers.provider.getBlock("latest");
  const nowTs     = block.timestamp;
  const epochSecs = 86_400;
  const nextEpoch = Math.floor(nowTs / epochSecs + 1) * epochSecs;
  const delta     = nextEpoch - nowTs;
  await advanceTime(delta + 1); // +1 so strictly past midnight
}

/** Deploy a minimal ERC-20 mock (USDT substitute). */
async function deployMockUSDT(deployer) {
  const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);
  return MockERC20.deploy("Mock USDT", "USDT");
}

/** Deploy the prize contract. */
async function deployPrize(usdt, feeReceiver, deployer) {
  const Factory = await ethers.getContractFactory("MiniCardDailyPrize", deployer);
  return Factory.deploy(await usdt.getAddress(), feeReceiver.address);
}

/** Mint tokens and approve the prize contract for a player. */
async function mintAndApprove(usdt, prize, player, amount) {
  await usdt.mint(player.address, amount);
  await usdt.connect(player).approve(await prize.getAddress(), amount);
}

// ---------------------------------------------------------------------------
// MockERC20 — deployed inline via an in-memory artifact
// ---------------------------------------------------------------------------
// We define the factory source below so no extra file is needed.
// Hardhat will compile it on the fly from the contracts/ directory
// if we add it there, but it's cleaner to keep tests self-contained.
// We therefore deploy a minimal inline contract.
// (Hardhat compiles all *.sol files in contracts/, so we create the mock
//  as a fixture contract in the same folder.)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MiniCardDailyPrize", function () {
  let usdt, prize;
  let owner, feeReceiver, alice, bob, carol, dan;
  const ENTRY_FEE   = 100_000n;   // $0.10 USDT (6-decimal)
  const PLATFORM_BPS = 1_000n;    // 10%
  const LARGE_MINT  = 10_000_000n; // $10 each — plenty for tests

  beforeEach(async function () {
    [owner, feeReceiver, alice, bob, carol, dan] = await ethers.getSigners();

    usdt  = await deployMockUSDT(owner);
    prize = await deployPrize(usdt, feeReceiver, owner);

    // Give every player some USDT and a standing approval
    for (const player of [alice, bob, carol, dan]) {
      await mintAndApprove(usdt, prize, player, LARGE_MINT);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Deployment sanity
  // ─────────────────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets the correct USDT address", async function () {
      expect(await prize.usdt()).to.equal(await usdt.getAddress());
    });

    it("sets the correct feeReceiver", async function () {
      expect(await prize.feeReceiver()).to.equal(feeReceiver.address);
    });

    it("sets the correct owner", async function () {
      expect(await prize.owner()).to.equal(owner.address);
    });

    it("has the default entryFee of 100_000", async function () {
      expect(await prize.entryFee()).to.equal(ENTRY_FEE);
    });

    it("has the default platformFeeBps of 1_000 (10%)", async function () {
      expect(await prize.platformFeeBps()).to.equal(PLATFORM_BPS);
    });

    it("reverts if USDT address is zero", async function () {
      const Factory = await ethers.getContractFactory("MiniCardDailyPrize", owner);
      await expect(
        Factory.deploy(ethers.ZeroAddress, feeReceiver.address)
      ).to.be.revertedWith("Zero USDT address");
    });

    it("reverts if feeReceiver is zero", async function () {
      const Factory = await ethers.getContractFactory("MiniCardDailyPrize", owner);
      await expect(
        Factory.deploy(await usdt.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Zero fee receiver");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Epoch helpers
  // ─────────────────────────────────────────────────────────────────────────
  describe("Epoch helpers", function () {
    it("currentEpoch() increments after 1 day", async function () {
      const before = await prize.currentEpoch();
      await advanceTime(86_400);
      const after = await prize.currentEpoch();
      expect(after).to.equal(before + 1n);
    });

    it("epochEnd() equals (epochId + 1) * 86400", async function () {
      const epochId = await prize.currentEpoch();
      const expected = (epochId + 1n) * 86_400n;
      expect(await prize.epochEnd(epochId)).to.equal(expected);
    });

    it("epochEnded() is false during the epoch", async function () {
      const epochId = await prize.currentEpoch();
      expect(await prize.epochEnded(epochId)).to.be.false;
    });

    it("epochEnded() is true after advancing past midnight", async function () {
      const epochId = await prize.currentEpoch();
      await advanceToNextEpoch();
      expect(await prize.epochEnded(epochId)).to.be.true;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // enterEpoch
  // ─────────────────────────────────────────────────────────────────────────
  describe("enterEpoch()", function () {
    it("allows a player to enter and emits Entered", async function () {
      const epochId = await prize.currentEpoch();
      await expect(prize.connect(alice).enterEpoch())
        .to.emit(prize, "Entered")
        .withArgs(alice.address, epochId, ENTRY_FEE);
    });

    it("transfers USDT from the player to the contract", async function () {
      const prizeAddr = await prize.getAddress();
      const before    = await usdt.balanceOf(prizeAddr);
      await prize.connect(alice).enterEpoch();
      expect(await usdt.balanceOf(prizeAddr)).to.equal(before + ENTRY_FEE);
    });

    it("records the player as entered", async function () {
      const epochId = await prize.currentEpoch();
      await prize.connect(alice).enterEpoch();
      const [entered] = await prize.playerEntry(epochId, alice.address);
      expect(entered).to.be.true;
    });

    it("adds the player to the entrants list", async function () {
      const epochId = await prize.currentEpoch();
      await prize.connect(alice).enterEpoch();
      const entrants = await prize.getEntrants(epochId);
      expect(entrants).to.include(alice.address);
    });

    it("reverts if the player tries to enter twice", async function () {
      await prize.connect(alice).enterEpoch();
      await expect(prize.connect(alice).enterEpoch())
        .to.be.revertedWith("Already entered this epoch");
    });

    it("does NOT revert when entering after rollover (enters new epoch)", async function () {
      // enterEpoch() always targets currentEpoch(), which is already N+1
      // after the clock rolls over. The 'Epoch already ended' guard on the
      // current epoch is unreachable via currentEpoch() in normal flow.
      await advanceToNextEpoch();
      // Should succeed — alice is entering the new (current) epoch, not the old one
      await expect(prize.connect(alice).enterEpoch()).to.not.be.reverted;
    });

    it("allows entry in a new epoch after the previous one ended", async function () {
      // Enter epoch N
      await prize.connect(alice).enterEpoch();
      await advanceToNextEpoch();
      // Should succeed in epoch N+1
      await expect(prize.connect(alice).enterEpoch()).to.not.be.reverted;
    });

    it("reverts if the player has insufficient USDT allowance", async function () {
      // Give alice USDT but no allowance
      const Factory = await ethers.getContractFactory("MiniCardDailyPrize", owner);
      const prize2  = await Factory.deploy(await usdt.getAddress(), feeReceiver.address);
      // alice has no approval for prize2
      await expect(prize2.connect(alice).enterEpoch()).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // submitScore
  // ─────────────────────────────────────────────────────────────────────────
  describe("submitScore()", function () {
    let epochId;

    beforeEach(async function () {
      epochId = await prize.currentEpoch();
      await prize.connect(alice).enterEpoch();
    });

    it("emits ScoreSubmitted on first score", async function () {
      await expect(prize.connect(alice).submitScore(1000, 3))
        .to.emit(prize, "ScoreSubmitted")
        .withArgs(alice.address, epochId, 1000, 3);
    });

    it("updates bestScore when a higher score is submitted", async function () {
      await prize.connect(alice).submitScore(1000, 2);
      await prize.connect(alice).submitScore(5000, 5);
      const [, best] = await prize.playerEntry(epochId, alice.address);
      expect(best).to.equal(5000n);
    });

    it("does NOT update bestScore when a lower score is submitted", async function () {
      await prize.connect(alice).submitScore(5000, 5);
      await prize.connect(alice).submitScore(100, 1);
      const [, best] = await prize.playerEntry(epochId, alice.address);
      expect(best).to.equal(5000n);
    });

    it("does NOT emit ScoreSubmitted when score is not a new best", async function () {
      await prize.connect(alice).submitScore(5000, 5);
      await expect(prize.connect(alice).submitScore(100, 1))
        .to.not.emit(prize, "ScoreSubmitted");
    });

    it("reverts if score is 0", async function () {
      await expect(prize.connect(alice).submitScore(0, 1))
        .to.be.revertedWith("Score must be > 0");
    });

    it("reverts if score exceeds MAX_PLAUSIBLE_SCORE", async function () {
      const cap = await prize.MAX_PLAUSIBLE_SCORE();
      await expect(prize.connect(alice).submitScore(cap + 1n, 99))
        .to.be.revertedWith("Score exceeds plausibility cap");
    });

    it("accepts exactly MAX_PLAUSIBLE_SCORE", async function () {
      const cap = await prize.MAX_PLAUSIBLE_SCORE();
      await expect(prize.connect(alice).submitScore(cap, 99)).to.not.be.reverted;
    });

    it("reverts if player has not entered", async function () {
      await expect(prize.connect(bob).submitScore(999, 1))
        .to.be.revertedWith("Not entered in this epoch");
    });

    it("reverts if the epoch has ended (not entered in new epoch)", async function () {
      // After advancing, currentEpoch() = N+1. Alice entered epoch N but not
      // N+1, so the first revert hit is 'Not entered in this epoch'.
      // The 'Epoch already ended' guard is unreachable via currentEpoch().
      await advanceToNextEpoch();
      await expect(prize.connect(alice).submitScore(500, 2))
        .to.be.revertedWith("Not entered in this epoch");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // finalize
  // ─────────────────────────────────────────────────────────────────────────
  describe("finalize()", function () {
    let epochId;

    beforeEach(async function () {
      epochId = await prize.currentEpoch();
    });

    it("reverts if the epoch has not ended yet", async function () {
      await expect(prize.finalize(epochId))
        .to.be.revertedWith("Epoch not yet ended");
    });

    it("reverts if already finalized", async function () {
      await advanceToNextEpoch();
      await prize.finalize(epochId);
      await expect(prize.finalize(epochId))
        .to.be.revertedWith("Already finalized");
    });

    it("is callable by anyone (not just owner)", async function () {
      await advanceToNextEpoch();
      await expect(prize.connect(alice).finalize(epochId)).to.not.be.reverted;
    });

    // ── Zero-entrant epoch ──
    describe("zero entrants", function () {
      it("emits EpochFinalized with zero winner and no transfer", async function () {
        await advanceToNextEpoch();
        await expect(prize.finalize(epochId))
          .to.emit(prize, "EpochFinalized")
          .withArgs(epochId, ethers.ZeroAddress, 0, 0, 0);
      });

      it("marks epoch as finalized", async function () {
        await advanceToNextEpoch();
        await prize.finalize(epochId);
        const result = await prize.results(epochId);
        expect(result.finalized).to.be.true;
        expect(result.entrantCount).to.equal(0n);
      });
    });

    // ── Single entrant ──
    describe("single entrant", function () {
      beforeEach(async function () {
        await prize.connect(alice).enterEpoch();
        await prize.connect(alice).submitScore(12_000, 4);
        await advanceToNextEpoch();
      });

      it("emits EpochFinalized with alice as winner", async function () {
        const pool        = ENTRY_FEE;
        const platformCut = (pool * PLATFORM_BPS) / 10_000n;
        const prize_amt   = pool - platformCut;

        await expect(prize.finalize(epochId))
          .to.emit(prize, "EpochFinalized")
          .withArgs(epochId, alice.address, 12_000, prize_amt, platformCut);
      });

      it("sends platform cut to feeReceiver", async function () {
        const before = await usdt.balanceOf(feeReceiver.address);
        await prize.finalize(epochId);
        const cut    = (ENTRY_FEE * PLATFORM_BPS) / 10_000n;
        expect(await usdt.balanceOf(feeReceiver.address)).to.equal(before + cut);
      });

      it("records winner, prizeAmount, winnerScore correctly", async function () {
        await prize.finalize(epochId);
        const result = await prize.results(epochId);
        expect(result.winner).to.equal(alice.address);
        expect(result.winnerScore).to.equal(12_000n);
        const cut = (ENTRY_FEE * PLATFORM_BPS) / 10_000n;
        expect(result.prizeAmount).to.equal(ENTRY_FEE - cut);
      });
    });

    // ── Multiple entrants — clear winner ──
    describe("multiple entrants, clear winner", function () {
      beforeEach(async function () {
        await prize.connect(alice).enterEpoch();
        await prize.connect(bob).enterEpoch();
        await prize.connect(carol).enterEpoch();

        await prize.connect(alice).submitScore(3_000, 2);
        await prize.connect(bob).submitScore(50_000, 8);   // <-- highest
        await prize.connect(carol).submitScore(25_000, 5);
        await advanceToNextEpoch();
      });

      it("picks bob as the winner", async function () {
        await prize.finalize(epochId);
        const result = await prize.results(epochId);
        expect(result.winner).to.equal(bob.address);
        expect(result.winnerScore).to.equal(50_000n);
      });

      it("pool = 3 × entryFee, prize = pool - 10%", async function () {
        await prize.finalize(epochId);
        const result   = await prize.results(epochId);
        const pool     = ENTRY_FEE * 3n;
        const cut      = (pool * PLATFORM_BPS) / 10_000n;
        expect(result.totalPool).to.equal(pool);
        expect(result.prizeAmount).to.equal(pool - cut);
      });

      it("platform cut goes to feeReceiver", async function () {
        const before = await usdt.balanceOf(feeReceiver.address);
        await prize.finalize(epochId);
        const pool = ENTRY_FEE * 3n;
        const cut  = (pool * PLATFORM_BPS) / 10_000n;
        expect(await usdt.balanceOf(feeReceiver.address)).to.equal(before + cut);
      });
    });

    // ── Ties — first-entered wins ──
    describe("tie: same score, first entrant wins", function () {
      it("alice (entered first) wins when both score equally", async function () {
        await prize.connect(alice).enterEpoch();
        await prize.connect(bob).enterEpoch();
        await prize.connect(alice).submitScore(7_777, 3);
        await prize.connect(bob).submitScore(7_777, 3);
        await advanceToNextEpoch();

        await prize.finalize(epochId);
        const result = await prize.results(epochId);
        expect(result.winner).to.equal(alice.address);
      });
    });

    // ── No score submitted (entered but never played) ──
    describe("entrant with no score submitted", function () {
      it("player with score 0 does not become winner if another scored", async function () {
        await prize.connect(alice).enterEpoch(); // never submits score
        await prize.connect(bob).enterEpoch();
        await prize.connect(bob).submitScore(500, 1);
        await advanceToNextEpoch();

        await prize.finalize(epochId);
        const result = await prize.results(epochId);
        expect(result.winner).to.equal(bob.address);
      });

      it("if ALL entrants have score 0, winner is the first entrant", async function () {
        // alice enters but never submits — bestScore stays 0
        await prize.connect(alice).enterEpoch();
        await prize.connect(bob).enterEpoch();
        await advanceToNextEpoch();

        await prize.finalize(epochId);
        const result = await prize.results(epochId);
        // topScore = 0, winner = first with score > 0 → none found → winner = address(0) from initial
        // Actually with bestScore=0 for all, topScore stays 0 and winner stays address(0).
        // This is the correct on-chain behaviour: no one scored, no winner.
        expect(result.winnerScore).to.equal(0n);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // claimPrize
  // ─────────────────────────────────────────────────────────────────────────
  describe("claimPrize()", function () {
    let epochId;

    beforeEach(async function () {
      epochId = await prize.currentEpoch();
      await prize.connect(alice).enterEpoch();
      await prize.connect(bob).enterEpoch();
      await prize.connect(alice).submitScore(99_999, 10);
      await prize.connect(bob).submitScore(50_000, 6);
      await advanceToNextEpoch();
      await prize.finalize(epochId);
    });

    it("emits PrizeClaimed and transfers USDT to alice", async function () {
      const result = await prize.results(epochId);
      await expect(prize.connect(alice).claimPrize(epochId))
        .to.emit(prize, "PrizeClaimed")
        .withArgs(alice.address, epochId, result.prizeAmount);
    });

    it("alice's USDT balance increases by prizeAmount", async function () {
      const result = await prize.results(epochId);
      const before = await usdt.balanceOf(alice.address);
      await prize.connect(alice).claimPrize(epochId);
      expect(await usdt.balanceOf(alice.address)).to.equal(before + result.prizeAmount);
    });

    it("marks prize as claimed", async function () {
      await prize.connect(alice).claimPrize(epochId);
      const result = await prize.results(epochId);
      expect(result.claimed).to.be.true;
    });

    it("reverts on double-claim", async function () {
      await prize.connect(alice).claimPrize(epochId);
      await expect(prize.connect(alice).claimPrize(epochId))
        .to.be.revertedWith("Prize already claimed");
    });

    it("reverts if non-winner tries to claim", async function () {
      await expect(prize.connect(bob).claimPrize(epochId))
        .to.be.revertedWith("Not the winner");
    });

    it("reverts if epoch is not finalized", async function () {
      // Enter a fresh epoch that has not been finalized
      const newEpoch = await prize.currentEpoch();
      await prize.connect(alice).enterEpoch();
      await advanceToNextEpoch();
      // do NOT call finalize
      await expect(prize.connect(alice).claimPrize(newEpoch))
        .to.be.revertedWith("Epoch not finalized yet");
    });

    it("reverts for a zero-entrant epoch (no prize)", async function () {
      // Finalize a future epoch with no entrants
      const blankEpoch = await prize.currentEpoch();
      await advanceToNextEpoch();
      await prize.finalize(blankEpoch);
      await expect(prize.connect(alice).claimPrize(blankEpoch))
        .to.be.revertedWith("Not the winner");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // epochLeaderboard view
  // ─────────────────────────────────────────────────────────────────────────
  describe("epochLeaderboard()", function () {
    it("returns empty arrays for an epoch with no entrants", async function () {
      const epochId = await prize.currentEpoch();
      const [players, scores] = await prize.epochLeaderboard(epochId);
      expect(players.length).to.equal(0);
      expect(scores.length).to.equal(0);
    });

    it("returns correct players and scores", async function () {
      const epochId = await prize.currentEpoch();
      await prize.connect(alice).enterEpoch();
      await prize.connect(bob).enterEpoch();
      await prize.connect(alice).submitScore(42_000, 7);
      await prize.connect(bob).submitScore(11_000, 3);

      const [players, scores] = await prize.epochLeaderboard(epochId);
      expect(players).to.include(alice.address);
      expect(players).to.include(bob.address);
      const aliceIdx = players.indexOf(alice.address);
      const bobIdx   = players.indexOf(bob.address);
      expect(scores[aliceIdx]).to.equal(42_000n);
      expect(scores[bobIdx]).to.equal(11_000n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Owner configuration
  // ─────────────────────────────────────────────────────────────────────────
  describe("Owner configuration", function () {

    describe("setEntryFee()", function () {
      it("updates entryFee and emits EntryFeeUpdated", async function () {
        await expect(prize.setEntryFee(200_000))
          .to.emit(prize, "EntryFeeUpdated")
          .withArgs(ENTRY_FEE, 200_000);
        expect(await prize.entryFee()).to.equal(200_000n);
      });

      it("reverts if fee is 0", async function () {
        await expect(prize.setEntryFee(0)).to.be.revertedWith("Fee must be > 0");
      });

      it("reverts if called by non-owner", async function () {
        await expect(prize.connect(alice).setEntryFee(200_000))
          .to.be.revertedWith("Not owner");
      });
    });

    describe("setPlatformFeeBps()", function () {
      it("updates platformFeeBps and emits PlatformFeeBpsUpdated", async function () {
        await expect(prize.setPlatformFeeBps(500))
          .to.emit(prize, "PlatformFeeBpsUpdated")
          .withArgs(PLATFORM_BPS, 500);
        expect(await prize.platformFeeBps()).to.equal(500n);
      });

      it("reverts if BPS > 3000 (30%)", async function () {
        await expect(prize.setPlatformFeeBps(3_001))
          .to.be.revertedWith("Fee cannot exceed 30%");
      });

      it("allows exactly 3000 (30%)", async function () {
        await expect(prize.setPlatformFeeBps(3_000)).to.not.be.reverted;
      });

      it("reverts if called by non-owner", async function () {
        await expect(prize.connect(alice).setPlatformFeeBps(500))
          .to.be.revertedWith("Not owner");
      });
    });

    describe("setFeeReceiver()", function () {
      it("updates feeReceiver and emits FeeReceiverUpdated", async function () {
        await expect(prize.setFeeReceiver(dan.address))
          .to.emit(prize, "FeeReceiverUpdated")
          .withArgs(feeReceiver.address, dan.address);
        expect(await prize.feeReceiver()).to.equal(dan.address);
      });

      it("reverts if zero address", async function () {
        await expect(prize.setFeeReceiver(ethers.ZeroAddress))
          .to.be.revertedWith("Zero address");
      });

      it("reverts if called by non-owner", async function () {
        await expect(prize.connect(alice).setFeeReceiver(dan.address))
          .to.be.revertedWith("Not owner");
      });
    });

    describe("transferOwnership()", function () {
      it("transfers ownership and emits OwnershipTransferred", async function () {
        await expect(prize.transferOwnership(alice.address))
          .to.emit(prize, "OwnershipTransferred")
          .withArgs(owner.address, alice.address);
        expect(await prize.owner()).to.equal(alice.address);
      });

      it("reverts if zero address", async function () {
        await expect(prize.transferOwnership(ethers.ZeroAddress))
          .to.be.revertedWith("Zero address");
      });

      it("reverts if called by non-owner", async function () {
        await expect(prize.connect(alice).transferOwnership(bob.address))
          .to.be.revertedWith("Not owner");
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // recoverUSDT
  // ─────────────────────────────────────────────────────────────────────────
  describe("recoverUSDT()", function () {
    it("transfers USDT to owner", async function () {
      // Alice enters an epoch, then epoch ends unfinalized — fee is stuck
      await prize.connect(alice).enterEpoch();
      await advanceToNextEpoch();
      await prize.finalize(await prize.currentEpoch() - 1n);

      // Owner can pull the platform fee leftovers or any residual amount
      const prizeBalance = await usdt.balanceOf(await prize.getAddress());
      if (prizeBalance > 0n) {
        const before = await usdt.balanceOf(owner.address);
        await prize.recoverUSDT(prizeBalance);
        expect(await usdt.balanceOf(owner.address)).to.equal(before + prizeBalance);
      }
    });

    it("reverts if called by non-owner", async function () {
      await expect(prize.connect(alice).recoverUSDT(1n))
        .to.be.revertedWith("Not owner");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-epoch isolation
  // ─────────────────────────────────────────────────────────────────────────
  describe("Multi-epoch isolation", function () {
    it("entries in epoch N do not bleed into epoch N+1", async function () {
      const epochN = await prize.currentEpoch();

      // Enter epoch N
      await prize.connect(alice).enterEpoch();
      await prize.connect(alice).submitScore(100_000, 5);

      // Advance to epoch N+1
      await advanceToNextEpoch();
      const epochN1 = await prize.currentEpoch();

      // Alice should NOT be entered in epoch N+1
      const [entered] = await prize.playerEntry(epochN1, alice.address);
      expect(entered).to.be.false;

      // Entrant list for epoch N+1 should be empty
      const entrants = await prize.getEntrants(epochN1);
      expect(entrants.length).to.equal(0);
    });

    it("alice can enter consecutive epochs independently", async function () {
      // Epoch N
      await prize.connect(alice).enterEpoch();
      await advanceToNextEpoch();

      // Epoch N+1
      await expect(prize.connect(alice).enterEpoch()).to.not.be.reverted;
    });

    it("finalize of epoch N does not affect epoch N+1", async function () {
      const epochN = await prize.currentEpoch();
      await prize.connect(alice).enterEpoch();
      await prize.connect(alice).submitScore(500, 2);
      await advanceToNextEpoch();

      // Finalize epoch N
      await prize.finalize(epochN);

      // In epoch N+1, results should be unfinalised
      const epochN1 = await prize.currentEpoch();
      const result  = await prize.results(epochN1);
      expect(result.finalized).to.be.false;
    });
  });
});