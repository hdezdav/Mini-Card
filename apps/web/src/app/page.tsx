"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayingCard } from "@/components/PlayingCard";
import { DeckBack, EmptySlot, JokerCard, SpectralCard } from "@/components/Specials";
import { GbaBackground } from "@/components/GbaBackground";
import {
  type Blind,
  type Card,
  type HandType,
  RANK_CHIPS,
  RANK_ORDER,
  SUITS,
  blindForRound,
  createDeck,
  evaluate,
  handScore,
  shuffle,
} from "@/lib/game";

const HAND_SIZE = 8;
const MAX_SELECT = 5;
const JOKER_MULT = 4;

type Phase = "playing" | "scoring" | "won" | "lost";

interface FloatText {
  id: number;
  cardId: string;
  value: string;
  color: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function HomePage() {
  const [round, setRound] = useState(1);
  const [money, setMoney] = useState(4);
  const [handsLeft, setHandsLeft] = useState(4);
  const [discardsLeft, setDiscardsLeft] = useState(3);
  const [roundScore, setRoundScore] = useState(0);

  const [deck, setDeck] = useState<Card[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [playZone, setPlayZone] = useState<Card[]>([]);

  const [phase, setPhase] = useState<Phase>("playing");
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [animChips, setAnimChips] = useState<number | null>(null);
  const [animMult, setAnimMult] = useState<number | null>(null);
  const [jokerFlash, setJokerFlash] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Auto-connect Celo / MiniPay
  useEffect(() => {
    const initWeb3 = async () => {
      if (typeof window !== "undefined") {
        const eth = (window as any).ethereum;
        if (eth) {
          try {
            // Auto request accounts inside MiniPay
            const accounts = await eth.request({ method: "eth_requestAccounts" });
            if (accounts && accounts[0]) {
              setWalletAddress(accounts[0]);
            }
          } catch (err) {
            console.warn("MiniPay auto-connect error:", err);
            // Local fallback
            setWalletAddress("0xceloGuest" + Math.floor(Math.random() * 9000 + 1000));
          }
        } else {
          setWalletAddress("0xceloGuest" + Math.floor(Math.random() * 9000 + 1000));
        }
      }
    };
    initWeb3();
  }, []);

  const saveScore = useCallback((score: number) => {
    if (score <= 0) return;
    const key = "minicard_leaderboard";
    const raw = localStorage.getItem(key);
    let list: LeaderboardEntry[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch (e) {
        list = [];
      }
    }
    const entry: LeaderboardEntry = {
      address: walletAddress || "0xceloGuest",
      score,
      round,
      date: new Date().toLocaleDateString(),
    };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    list = list.slice(0, 10);
    localStorage.setItem(key, JSON.stringify(list));
  }, [walletAddress, round]);

  const levels = useRef<Partial<Record<HandType, number>>>({});
  const floatId = useRef(0);
  const busy = useRef(false);

  const { ante, blind } = useMemo(() => blindForRound(round), [round]);

  const startRound = useCallback(() => {
    const fresh = shuffle(createDeck());
    const newHand = fresh.slice(0, HAND_SIZE);
    setDeck(fresh.slice(HAND_SIZE));
    setHand(newHand);
    setSelected([]);
    setPlayZone([]);
    setRoundScore(0);
    setHandsLeft(4);
    setDiscardsLeft(3);
    setPhase("playing");
    setAnimChips(null);
    setAnimMult(null);
    setFloats([]);
    setScoringId(null);
  }, []);

  useEffect(() => {
    startRound();
  }, [startRound]);

  const selCards = useMemo(() => hand.filter((card) => selected.includes(card.id)), [hand, selected]);
  const evalResult = useMemo(() => evaluate(selCards), [selCards]);
  const baseScore = handScore(evalResult.type, levels.current);
  const displayLevel = levels.current[evalResult.type] ?? 1;

  const hasSelection = selected.length > 0;
  const showChips = animChips ?? (hasSelection ? baseScore.chips : 0);
  const showMult = animMult ?? (hasSelection ? baseScore.mult : 0);
  const showHandType = hasSelection ? evalResult.type : "";

  const toggleSelect = (id: string) => {
    if (phase !== "playing" || busy.current) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, id];
    });
  };

  const sortBy = (mode: "rank" | "suit") => {
    if (busy.current) return;
    setHand((prev) => {
      const arr = [...prev];
      if (mode === "rank") {
        arr.sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank] || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
      } else {
        arr.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
      }
      return arr;
    });
  };

  const drawTo = (current: Card[], pool: Card[]) => {
    const need = HAND_SIZE - current.length;
    const drawn = pool.slice(0, need);
    return { newHand: [...current, ...drawn], rest: pool.slice(need) };
  };

  const doDiscard = () => {
    if (phase !== "playing" || busy.current) return;
    if (selected.length === 0 || discardsLeft <= 0) return;
    const remaining = hand.filter((card) => !selected.includes(card.id));
    const { newHand, rest } = drawTo(remaining, deck);
    setHand(newHand);
    setDeck(rest);
    setSelected([]);
    setDiscardsLeft((value) => value - 1);
  };

  const pushFloat = (cardId: string, value: string, color: string) => {
    floatId.current += 1;
    const id = floatId.current;
    setFloats((current) => [...current, { id, cardId, value, color }]);
    setTimeout(() => setFloats((current) => current.filter((item) => item.id !== id)), 650);
  };

  const doPlay = async () => {
    if (phase !== "playing" || busy.current) return;
    if (selected.length === 0) return;
    busy.current = true;

    const played = hand.filter((card) => selected.includes(card.id));
    const ev = evaluate(played);
    const base = handScore(ev.type, levels.current);

    setPhase("scoring");
    setPlayZone(played);
    setSelected([]);
    setScoringId(null);
    setAnimChips(base.chips);
    setAnimMult(base.mult);

    await delay(300);

    let chips = base.chips;
    const mult = base.mult;

    for (const card of played) {
      if (!ev.scoringIds.includes(card.id)) continue;
      const add = RANK_CHIPS[card.rank];
      chips += add;
      setScoringId(card.id);
      setAnimChips(chips);
      pushFloat(card.id, `+${add}`, "#2fb8ff");
      await delay(280);
    }

    setScoringId(null);

    setJokerFlash(true);
    const finalMult = mult + JOKER_MULT;
    setAnimMult(finalMult);
    await delay(360);
    setJokerFlash(false);

    const gained = chips * finalMult;
    const start = roundScore;
    const end = start + gained;
    const steps = 16;
    for (let i = 1; i <= steps; i += 1) {
      setRoundScore(Math.round(start + ((end - start) * i) / steps));
      await delay(22);
    }

    await delay(250);

    const remaining = hand.filter((card) => !selected.includes(card.id) && !played.includes(card));
    const { newHand, rest } = drawTo(remaining, deck);
    const newHands = handsLeft - 1;

    setPlayZone([]);
    setHand(newHand);
    setDeck(rest);
    setHandsLeft(newHands);
    setAnimChips(null);
    setAnimMult(null);

    if (end >= blind.target) {
      await delay(200);
      setMoney((current) => current + blind.reward + Math.min(newHands, 5));
      setPhase("won");
    } else if (newHands <= 0) {
      setPhase("lost");
      saveScore(end);
    } else {
      setPhase("playing");
    }

    busy.current = false;
  };

  const nextBlind = () => {
    const nextRound = round + 1;
    setRound(nextRound);
    startRound();
  };

  const restart = () => {
    setRound(1);
    setMoney(4);
    startRound();
  };

  return (
    <main className="flex h-screen w-full justify-center overflow-hidden bg-[#070b09]">
      <div className="felt-bg relative flex h-full w-full max-w-[360px] flex-col overflow-hidden">
        <GbaBackground blindKind={blind.kind} />
        {/* Top Stats Bar */}
        <div className="relative z-10 flex gap-[5px] px-2 pb-1 pt-1.5 items-stretch">
          <StatBox label="Hands" value={handsLeft} color="#37b6ef" />
          <StatBox label="Discards" value={discardsLeft} color="#fe5f55" />
          <AnteBox ante={ante} />
          <StatBox label="Round" value={round} color="#f5a623" />
          <MoneyBox money={money} />
        </div>

        {/* Top Slots Groups */}
        <div className="relative z-10 flex gap-2 px-2 items-start justify-between mt-1">
          <SlotGroup label="1/5" align="left">
            <JokerCard className="h-[54px] w-[38px]" />
            {[0, 1, 2, 3].map((index) => (
              <EmptySlot key={index} className="h-[54px] w-[38px]" />
            ))}
          </SlotGroup>
          <SlotGroup label="1/2" align="right">
            <SpectralCard className="h-[54px] w-[38px]" />
            <EmptySlot className="h-[54px] w-[38px]" />
          </SlotGroup>
        </div>

        {/* Play Zone */}
        <div className="relative z-10 flex flex-1 min-h-0 items-center justify-center py-2">
          {playZone.length > 0 && (
            <div className="flex items-end gap-[4px]">
              {playZone.map((card) => {
                const isScoring = scoringId === card.id;
                const ev = evaluate(playZone);
                const inHand = ev.scoringIds.includes(card.id);
                const float = floats.find((item) => item.cardId === card.id);

                return (
                  <div key={card.id} className="relative">
                    {float && (
                      <div className="txt-outline absolute -top-8 left-1/2 z-20 -translate-x-1/2 font-pixel-fat text-2xl anim-scorefly" style={{ color: float.color }}>
                        {float.value}
                      </div>
                    )}
                    <PlayingCard
                      card={card}
                      scoring={inHand}
                      dimmed={!inHand}
                      className="h-[74px] w-[52px]"
                      style={{
                        transform: isScoring ? "translateY(-10px) scale(1.05)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Player Hand */}
        <div className="relative z-10 flex flex-col items-center px-2 pb-1.5 pt-2">
          <div className="flex min-h-[80px] items-end justify-center w-full pl-[18px]">
            {hand.map((card, idx) => {
              const isSelected = selected.includes(card.id);
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  selected={isSelected}
                  onClick={() => toggleSelect(card.id)}
                  className="h-[74px] w-[52px] transition-transform duration-100 hover:-translate-y-2"
                  style={{
                    marginLeft: idx > 0 ? "-18px" : "0px",
                    transform: isSelected ? "translateY(-14px)" : undefined,
                    zIndex: isSelected ? 30 + idx : idx,
                  }}
                />
              );
            })}
          </div>
          <div className="panel-inset mt-[2px] rounded-full px-2.5 py-[1px] leading-none">
            <span className="font-pixel text-[13px] text-white/90">
              {hand.length}/{HAND_SIZE}
            </span>
          </div>
        </div>

        {/* Bottom Controls Panel */}
        <footer className="relative z-10 border-t-4 px-2 pb-3 pt-2 flex flex-col gap-1.5" style={{ borderColor: "#3b93f8", background: "#2f363d" }}>
          <div className="flex gap-1.5 items-stretch justify-between">
            {/* Left Column: Options */}
            <div className="w-[84px] shrink-0 flex flex-col gap-1.5">
              <div className="text-center leading-none">
                <span className="font-pixel text-[11px] text-gray-300">Sort Hand</span>
                <div className="flex gap-[3px] mt-0.5">
                  <button type="button" onClick={() => sortBy("rank")} className="btn-chunky btn-orange flex-1 py-0.5 text-[11px] h-6">
                    Rank
                  </button>
                  <button type="button" onClick={() => sortBy("suit")} className="btn-chunky btn-orange flex-1 py-0.5 text-[11px] h-6">
                    Suit
                  </button>
                </div>
              </div>
              <button type="button" className="btn-chunky btn-red flex-1 text-base flex flex-col justify-center leading-none py-1 min-h-[36px]">
                <span>Run</span>
                <span className="mt-[1px]">Info</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLeaderboard(true)}
                className="btn-chunky btn-orange py-1 text-[10px] leading-none h-7"
              >
                Leaderboard
              </button>
            </div>

            {/* Center Column: Score & Details */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              {/* Round Score */}
              <div className="bg-[#1e2226] border border-white/10 rounded-md h-8 flex items-center justify-between px-2 shadow-sm">
                <span className="text-xs leading-none text-left font-pixel text-gray-300">Round<br/>score</span>
                <span className="text-lg font-pixel-fat flex items-center gap-1"><span className="text-gray-400 text-sm">✺</span> {roundScore}</span>
              </div>

              {/* Current Hand Type */}
              <div className="bg-[#1f2429] rounded-lg p-1.5 flex flex-col items-center border-b-4 border-black/40">
                <div className="text-[15px] font-pixel mb-1 leading-none">
                  <span className="text-white txt-outline">{showHandType || "\u00A0"}</span>
                  {showHandType && <span className="ml-1 text-xs text-[#6fa8c8]">lvl.{displayLevel}</span>}
                </div>
                <div className="flex w-full gap-1 h-7 items-stretch">
                  <div className="flex-1 bg-[#2b93ff] rounded flex items-center justify-end pr-2 text-base font-pixel-fat shadow-[0_2px_0_#155bb5] border border-black/10">
                    {showChips}
                  </div>
                  <div className="w-4 flex items-center justify-center text-[#f04f4c] font-pixel-fat text-sm">X</div>
                  <div className={`flex-1 bg-[#f04f4c] rounded flex items-center justify-start pl-2 text-base font-pixel-fat shadow-[0_2px_0_#9a1a1e] border border-black/10 transition-transform ${jokerFlash ? "scale-110" : ""}`}>
                    {showMult}
                  </div>
                </div>
              </div>

              {/* Blind Info */}
              <div className="flex-1 bg-[#4a3b2c] rounded-lg border-b-4 border-[#2d2218] flex flex-col items-center justify-center relative min-h-[58px] pt-4 pb-1">
                <div className="bg-[#a86510] w-full text-center py-[1px] rounded-t-lg text-[10px] border-b-2 border-black/20 absolute top-0 font-pixel">
                  {blind.name}
                </div>
                <div className="flex items-center gap-1.5 w-full px-1.5">
                  <BlindToken kind={blind.kind} />
                  <div className="flex-1 bg-[#2b3035] rounded-[4px] p-0.5 flex flex-col items-center border border-black/30">
                    <span className="text-[8px] text-gray-300 leading-none">Score at least</span>
                    <span className="text-sm font-pixel-fat text-[#f04f4c] flex items-center gap-0.5 leading-none mt-0.5">
                      <span className="text-gray-400 text-xs">✺</span>{blind.target}
                    </span>
                    <span className="text-[8px] text-gray-300 leading-none mt-0.5">Reward: <span className="text-[#facc15]">{"$".repeat(blind.reward)}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Deck & Actions */}
            <div className="w-[84px] shrink-0 flex flex-col gap-1.5">
              <div className="h-6 flex items-center justify-center gap-1">
                <div className="relative" style={{ transform: "rotate(-4deg)" }}>
                  <DeckBack className="h-[20px] w-[14px]" />
                  <DeckBack className="absolute top-[0.5px] left-[0.5px] -z-10 h-[20px] w-[14px]" style={{ filter: "brightness(0.7)" }} />
                </div>
                <div className="font-pixel-fat text-center text-xs leading-none text-white flex flex-col justify-center">
                  <span>{deck.length}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={doPlay}
                disabled={!hasSelection || phase !== "playing"}
                className="btn-chunky btn-blue flex-1 text-base flex flex-col justify-center leading-none py-1 min-h-[36px]"
              >
                <span>Play</span>
                <span className="mt-[1px]">Hand</span>
              </button>
              <button
                type="button"
                onClick={doDiscard}
                disabled={!hasSelection || discardsLeft <= 0 || phase !== "playing"}
                className="btn-chunky btn-red py-1 text-sm leading-none h-7"
              >
                Discard
              </button>
            </div>
          </div>
        </footer>

        {phase === "won" && <Overlay title="Blind Defeated!" color="#f5d048" sub={`+${blind.reward} cash out`} btn="Next Blind" onClick={nextBlind} />}
        {phase === "lost" && <Overlay title="Game Over" color="#fe5f55" sub={`You reached ${roundScore} / ${blind.target}`} btn="Play Again" onClick={restart} />}

        {showLeaderboard && (
          <LeaderboardOverlay
            onClose={() => setShowLeaderboard(false)}
            walletAddress={walletAddress}
          />
        )}
      </div>
    </main>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-box flex-1 py-1 px-1">
      <span className="text-[11px] text-gray-300 leading-none">{label}</span>
      <div className="stat-inner">
        <span className="text-lg font-pixel-fat leading-none" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function AnteBox({ ante }: { ante: number }) {
  return (
    <div className="stat-box flex-1 py-1 px-1">
      <span className="text-[11px] text-gray-300 leading-none">Ante</span>
      <div className="stat-inner">
        <span className="text-lg font-pixel-fat text-[#f7931a]">{ante}</span>
        <span className="text-[9px] text-gray-400">/8</span>
      </div>
    </div>
  );
}

function MoneyBox({ money }: { money: number }) {
  return (
    <div className="stat-box w-[76px] py-1 px-1 justify-center">
      <span className="text-2xl font-pixel-fat text-[#facc15] leading-none">${money}</span>
    </div>
  );
}

function SlotGroup({ label, align, children }: { label: string; align: "left" | "right"; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <span className="font-pixel mb-[2px] px-1 text-[11px] leading-none text-white/75">{label}</span>
      <div className="panel-inset flex gap-[3px] overflow-hidden rounded-lg p-[3px]">{children}</div>
    </div>
  );
}

function ScoreStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 1l2.2 6.4L21 8l-5 4.3L18 21l-6-3.6L6 21l2-8.7L3 8l6.8-.6z" fill="#eef3f5" stroke="#9fb3bd" strokeWidth="1" />
    </svg>
  );
}

function BlindToken({ kind }: { kind: Blind["kind"] }) {
  const color = kind === "small" ? "#3aa35a" : kind === "big" ? "#cc8e35" : "#c0392b";
  const border = kind === "small" ? "#236d3c" : kind === "big" ? "#966421" : "#832216";
  const shadow = kind === "small" ? "#144223" : kind === "big" ? "#6b4513" : "#51120a";
  const label = kind === "boss" ? "BOSS\nBLIND" : kind === "big" ? "BIG\nBLIND" : "SML\nBLIND";

  return (
    <div
      className="w-10 h-10 rounded-full border-[2.5px] flex items-center justify-center text-[9px] text-center leading-none text-white font-pixel-fat"
      style={{
        backgroundColor: color,
        borderColor: border,
        boxShadow: `0 3px 0 ${shadow}`,
        whiteSpace: "pre-line",
      }}
    >
      {label}
    </div>
  );
}

function Overlay({ title, sub, btn, color, onClick }: { title: string; sub: string; btn: string; color: string; onClick: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="panel anim-pop rounded-xl px-6 py-5 text-center max-w-[280px]">
        <div className="font-pixel-fat mb-1 text-3xl txt-outline" style={{ color }}>
          {title}
        </div>
        <div className="font-pixel mb-4 text-base text-white/85 leading-tight">{sub}</div>
        <button type="button" onClick={onClick} className="btn-chunky btn-blue w-full py-2 text-lg">
          {btn}
        </button>
      </div>
    </div>
  );
}

interface LeaderboardEntry {
  address: string;
  score: number;
  round: number;
  date: string;
}

function LeaderboardOverlay({ onClose, walletAddress }: { onClose: () => void; walletAddress: string }) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const key = "minicard_leaderboard";
    const raw = localStorage.getItem(key);
    let list: LeaderboardEntry[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch (e) {
        list = [];
      }
    }
    
    // If empty, add mock default scores for aesthetics
    if (list.length === 0) {
      list = [
        { address: "0xcelo...8d1a", score: 12500, round: 9, date: new Date().toLocaleDateString() },
        { address: "0xmini...e4c9", score: 8750, round: 6, date: new Date().toLocaleDateString() },
        { address: "0xbalatro...88f0", score: 6200, round: 5, date: new Date().toLocaleDateString() },
        { address: "0xceloGuest889", score: 4100, round: 3, date: new Date().toLocaleDateString() },
        { address: "0xplay...77bc", score: 1800, round: 2, date: new Date().toLocaleDateString() }
      ];
      localStorage.setItem(key, JSON.stringify(list));
    }
    setScores(list);
  }, []);

  const clearLeaderboard = () => {
    localStorage.removeItem("minicard_leaderboard");
    setScores([]);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="panel anim-pop rounded-xl px-4 py-4 w-full max-w-[310px] flex flex-col items-center">
        {/* Title */}
        <div className="font-pixel-fat mb-1 text-3xl text-[#facc15] txt-outline">
          LEADERBOARD
        </div>

        {/* Celo connection info */}
        <div className="text-[10px] text-gray-300 font-pixel mb-3 flex items-center justify-center gap-1.5 bg-black/40 px-2.5 py-0.5 rounded-full border border-white/5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#38d08f] animate-pulse"></div>
          <span>CELO: {walletAddress.startsWith("0xceloGuest") ? walletAddress : `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}</span>
        </div>

        {/* Scores Table */}
        <div className="w-full flex-1 bg-[#1a1d20] border-2 border-black/40 rounded-lg p-1.5 mb-4 max-h-[220px] overflow-y-auto">
          {scores.length === 0 ? (
            <div className="text-center text-xs text-gray-500 font-pixel py-8">NO SCORES YET</div>
          ) : (
            <table className="w-full text-left font-pixel text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-[10px]">
                  <th className="pb-1 w-6">#</th>
                  <th className="pb-1">PLAYER</th>
                  <th className="pb-1 text-right">ROUND</th>
                  <th className="pb-1 text-right">SCORE</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry, index) => {
                  const isCurrentPlayer = entry.address === walletAddress;
                  const rankColors = ["text-[#ffd700]", "text-[#c0c0c0]", "text-[#cd7f32]"];
                  const rankColor = rankColors[index] || "text-white";
                  return (
                    <tr 
                      key={index} 
                      className={`border-b border-white/5 last:border-b-0 py-1 ${isCurrentPlayer ? "bg-white/10 rounded" : ""}`}
                    >
                      <td className={`py-1 font-bold ${rankColor}`}>{index + 1}</td>
                      <td className="py-1 font-mono text-[11px] text-gray-300">
                        {entry.address.startsWith("0xceloGuest") 
                          ? entry.address 
                          : `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
                      </td>
                      <td className="py-1 text-right text-gray-400">{entry.round}</td>
                      <td className="py-1 text-right font-pixel-fat text-[#38d08f]">{entry.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 w-full">
          <button 
            type="button" 
            onClick={clearLeaderboard} 
            className="btn-chunky btn-red py-1.5 text-xs flex-1"
          >
            RESET
          </button>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn-chunky btn-blue py-1.5 text-xs flex-1"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}