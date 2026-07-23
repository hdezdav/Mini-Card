"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PlayingCard } from "@/components/PlayingCard";
import { DeckBack, EmptySlot } from "@/components/Specials";
import { GbaBackground } from "@/components/GbaBackground";
import { Shop } from "@/components/Shop";
import { RunInfo } from "@/components/RunInfo";
import { MusicToggle } from "@/components/MusicToggle";
import { JokerArtworkFrame } from "@/components/JokerArtworkFrame";
import { RARITY_COLOR } from "@/lib/rarity";
import {
  type Blind,
  type Card,
  type HandType,
  type OwnedJoker,
  type JokerDef,
  type JokerCtx,
  type DeckType,
  RANK_CHIPS,
  RANK_ORDER,
  SUITS,
  blindForRound,
  createDeck,
  evaluate,
  handScore,
  jokerBaseCost,
  jokerConflictsWith,
  JOKER_DEFS,
  DECK_TYPES,
  getMaxJokerSlots,
  shuffle,
} from "@/lib/game";
import { autoConnect, submitScoreToCelo, getScoresFromCelo, registerUsernameToCelo, isMiniPay, resolveUsernamesForScores, getUsernameFromCelo, checkHasUsername, payRestartWithMiniPay, handlePaymentFailure } from "@/lib/web3";
import { getSfx } from "@/lib/sfx";
import {
  LangProvider,
  useLang,
  useSyncHtmlLang,
  dict,
  fmt,
  handName,
  jokerName,
  jokerDesc,
  bossName,
  bossDesc,
  rarityName,
  type Lang,
} from "@/lib/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const HAND_SIZE = 7;
const MAX_SELECT = 5;
const MAX_JOKER_SLOTS = 5;

type Phase = "playing" | "scoring" | "won" | "lost" | "shop";

interface FloatText {
  id: number;
  cardId: string;
  value: string;
  color: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GUEST_KEY = "minicard_guest_id";

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "0xceloGuest0000";
  let guestId = localStorage.getItem(GUEST_KEY);
  if (!guestId || !guestId.startsWith("0xceloGuest")) {
    guestId = "0xceloGuest" + Math.floor(Math.random() * 900000 + 100000);
    localStorage.setItem(GUEST_KEY, guestId);
  }
  return guestId;
}

export default function HomePage() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <HomeGame />
      </LangProvider>
    </ErrorBoundary>
  );
}

function HomeGame() {
  const { lang, setLang } = useLang();
  useSyncHtmlLang(lang);
  const [round, setRound] = useState(1);
  const [money, setMoney] = useState(4);
  const [handsLeft, setHandsLeft] = useState(4);
  const [discardsLeft, setDiscardsLeft] = useState(3);
  const [roundScore, setRoundScore] = useState(0);
  const [deckType, setDeckType] = useState<DeckType>("red");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTouch, setIsTouch] = useState(false);

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
  const [walletAddress, setWalletAddress] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(GUEST_KEY) || getOrCreateGuestId();
    }
    return "";
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showRunInfo, setShowRunInfo] = useState(false);
  const [ownedJokers, setOwnedJokers] = useState<OwnedJoker[]>([]);
  const [detectedMiniPay, setDetectedMiniPay] = useState(false);
  const [activeTooltipIdx, setActiveTooltipIdx] = useState<number | null>(null);

  // Score states for manual Celo submission
  const [lastScore, setLastScore] = useState<number>(0);
  const [lastRound, setLastRound] = useState<number>(1);
  const [scoreSubmitted, setScoreSubmitted] = useState<boolean>(false);
  const [submittingScore, setSubmittingScore] = useState<boolean>(false);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [payingRestart, setPayingRestart] = useState(false);

  // Username gate — all players must register a username before playing
  const [registeredUsername, setRegisteredUsername] = useState<string | null>(null);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [registeringUsername, setRegisteringUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  // Procedural SFX engine (cards / plays / scoring / shop). Shares one
  // AudioContext; created lazily on first use. SFX and music use separate
  // contexts. Muted when the user has music
  // off — we treat "music on" as the master audio toggle for the whole app.
  const sfx = useMemo(() => getSfx(), []);

  // Auto-connect Celo / MiniPay (no connect button per MiniPay guidelines)
  // Also checks whether the connected wallet has a registered username.
  // If not, shows a modal forcing username registration before playing.
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    }

    autoConnect().then(async (addr) => {
      if (addr && !addr.startsWith("0xceloGuest")) {
        setWalletAddress(addr);
        // Check if this wallet already has a username on-chain
        try {
          const uname = await getUsernameFromCelo(addr);
          if (uname) {
            setRegisteredUsername(uname);
            setNeedsUsername(false);
          } else {
            const has = await checkHasUsername(addr);
            if (!has) {
              setNeedsUsername(true);
            }
          }
        } catch (err) {
          console.warn("Failed to check username status:", err);
        }
      } else {
        const guestId = getOrCreateGuestId();
        setWalletAddress(guestId);
      }
    });
    setDetectedMiniPay(isMiniPay());

    const savedDeck = localStorage.getItem("minicard_selected_deck") as DeckType | null;
    if (savedDeck && ["red", "blue", "yellow", "green", "black", "painted"].includes(savedDeck)) {
      setDeckType(savedDeck);
    }

    // SFX follow the music preference: if the user has music enabled, SFX are
    // on too; otherwise the app is silent. (Both share the "audio on" toggle.)
    const musicOn = localStorage.getItem("minicard_music_enabled") === "1";
    sfx.setEnabled(musicOn);
  }, []);

  // Global click listener to close Joker tooltips when clicking elsewhere
  useEffect(() => {
    if (activeTooltipIdx === null) return;
    const handleGlobalClick = () => {
      setActiveTooltipIdx(null);
    };
    document.addEventListener("click", handleGlobalClick);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [activeTooltipIdx]);

  // Keep SFX enabled state in sync with the music toggle at runtime.
  useEffect(() => {
    const onAudio = (e: Event) => {
      const on = (e as CustomEvent<{ on: boolean }>).detail?.on ?? true;
      sfx.setEnabled(on);
      if (on) sfx.resume();
    };
    window.addEventListener("minicard:audio", onAudio);
    return () => window.removeEventListener("minicard:audio", onAudio);
  }, [sfx]);

  const handleSelectDeck = (type: DeckType) => {
    setDeckType(type);
    localStorage.setItem("minicard_selected_deck", type);
  };

  const saveScore = useCallback(async (score: number) => {
    if (score <= 0) return;

    setLastScore(score);
    setLastRound(round);
    setScoreSubmitted(false);

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
    const guestId = getOrCreateGuestId();
    const effectiveAddress = (walletAddress && !walletAddress.startsWith("0xceloGuest"))
      ? walletAddress
      : guestId;

    const entry: LeaderboardEntry = {
      address: effectiveAddress,
      score,
      round,
      date: new Date().toLocaleDateString(),
      timestamp: Date.now(),
    };
    list.push(entry);

    // Keep only the latest entry per user address (or unique guest)
    const latestMap: Record<string, LeaderboardEntry & { timestamp?: number }> = {};
    const sortedChrono = [...list].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    for (const item of sortedChrono) {
      latestMap[item.address.toLowerCase()] = item;
    }

    let uniqueList = Object.values(latestMap);
    uniqueList.sort((a, b) => b.score - a.score);
    uniqueList = uniqueList.slice(0, 10);
    localStorage.setItem(key, JSON.stringify(uniqueList));
  }, [walletAddress, round]);

  const handleSubmitLastScore = useCallback(async () => {
    if (lastScore <= 0 || submittingScore || scoreSubmitted) return;
    if (!walletAddress || walletAddress.startsWith("0xceloGuest")) {
      alert(dict.openInMinipay[lang]);
      return;
    }

    setSubmittingScore(true);
    try {
      const success = await submitScoreToCelo(lastScore, lastRound);
      if (success) {
        setScoreSubmitted(true);
        alert(dict.scoreSavedSuccess[lang]);
      } else {
        alert(dict.submitFailed[lang]);
      }
    } catch (err) {
      console.error("Score submission error:", err);
      alert(dict.scoreSaveError[lang]);
    } finally {
      setSubmittingScore(false);
    }
  }, [lastScore, lastRound, submittingScore, scoreSubmitted, walletAddress, lang]);

  const levels = useRef<Partial<Record<HandType, number>>>({});
  const floatId = useRef(0);
  const busy = useRef(false);

  const { ante, blind } = useMemo(() => blindForRound(round), [round]);

  const startRound = useCallback(() => {
    const deckInfo = DECK_TYPES[deckType] ?? DECK_TYPES.red;
    const fresh = shuffle(createDeck());
    const baseHandSize = HAND_SIZE + deckInfo.bonusHandSize;
    const handSize = (blind.kind === "boss" && blind.bossId === "manacle") ? baseHandSize - 1 : baseHandSize;
    const newHand = fresh.slice(0, handSize);
    setDeck(fresh.slice(handSize));
    setHand(newHand);
    setSelected([]);
    setPlayZone([]);
    setRoundScore(0);
    const baseHands = 4 + deckInfo.bonusHands;
    const hands = (blind.kind === "boss" && blind.bossId === "needle") ? 1 : baseHands;
    setHandsLeft(hands);
    const baseDiscards = 3 + deckInfo.bonusDiscards;
    const discards = (blind.kind === "boss" && blind.bossId === "water") ? 0 : baseDiscards;
    setDiscardsLeft(discards);
    setPhase("playing");
    setAnimChips(null);
    setAnimMult(null);
    setFloats([]);
    setScoringId(null);
    const baseTime = ante === 1 ? 60 : ante === 2 ? 75 : 90;
    setTimeLeft(baseTime);
    // Staggered deal ticks — one per card, slightly offset, like a real deal.
    newHand.forEach((_, i) => {
      setTimeout(() => sfx.play("deal"), 120 + i * 70);
    });
  }, [sfx, deckType, blind, ante]);

  useEffect(() => {
    const stored = localStorage.getItem("minicard_cooldown_end");
    if (stored) {
      const end = Number(stored);
      if (end > Date.now()) {
        setCooldownEnd(end);
        setPhase("lost");
      } else {
        localStorage.removeItem("minicard_cooldown_end");
        startRound();
      }
    } else {
      startRound();
    }
  }, [startRound]);

  useEffect(() => {
    if (phase !== "playing" || round === 1) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase("lost");
          saveScore(roundScore);
          const endCooldown = Date.now() + 24 * 60 * 60 * 1000;
          localStorage.setItem("minicard_cooldown_end", String(endCooldown));
          setCooldownEnd(endCooldown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, roundScore, round, saveScore]);

  const selCards = useMemo(() => hand.filter((card) => selected.includes(card.id)), [hand, selected]);
  const evalResult = useMemo(() => evaluate(selCards), [selCards]);
  const baseScore = handScore(evalResult.type, levels.current);
  const displayLevel = levels.current[evalResult.type] ?? 1;

  const hasSelection = selected.length > 0;
  const showChips = animChips ?? (hasSelection ? baseScore.chips : 0);
  const showMult = animMult ?? (hasSelection ? baseScore.mult : 0);
  const showHandType = hasSelection ? handName(evalResult.type, lang) : "";

  const toggleSelect = (id: string) => {
    if (phase !== "playing" || busy.current) return;
    setSelected((prev) => {
      if (prev.includes(id)) {
        sfx.play("deselect");
        return prev.filter((value) => value !== id);
      }
      if (prev.length >= MAX_SELECT) return prev;
      sfx.play("select");
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

  // Refill the hand in place: cards in `removedIds` are replaced by fresh draws
  // from `pool` in their original positions. Surviving cards never move, so any
  // sort order the player applied (rank/suit) is preserved after a discard or
  // play. New cards land in the exact slots of the removed ones; the player
  // re-sorts manually if they want the new cards merged into that order.
  const refillInPlace = (current: Card[], removedIds: Set<string>, pool: Card[]) => {
    const drawn = pool.slice(0, removedIds.size);
    const rest = pool.slice(removedIds.size);
    let drawIdx = 0;
    const next = current
      .map((card) => (removedIds.has(card.id) ? drawn[drawIdx++] ?? null : card))
      .filter((card): card is Card => card !== null);
    return { newHand: next, rest };
  };

  const doDiscard = () => {
    if (phase !== "playing" || busy.current) return;
    if (selected.length === 0 || discardsLeft <= 0) return;
    sfx.play("discard");
    const removedIds = new Set(selected);
    const { newHand, rest } = refillInPlace(hand, removedIds, deck);
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
    if (blind.kind === "boss" && blind.bossId === "psychic" && selected.length !== 5) {
      pushFloat(selected[0] ?? "", dict.psychicWarning[lang], "#ff2e88");
      sfx.play("deselect");
      return;
    }
    busy.current = true;

    try {
      const played = hand.filter((card) => selected.includes(card.id));
      const remaining = hand.filter((card) => !selected.includes(card.id));
      const ev = evaluate(played);
      const base = handScore(ev.type, levels.current);

      // Level up the played hand type
      levels.current = {
        ...levels.current,
        [ev.type]: (levels.current[ev.type] ?? 1) + 1,
      };

      setPhase("scoring");
      setPlayZone(played);
      setHand(remaining); // Immediately remove played cards from the player's hand
      setSelected([]);
      setScoringId(null);
      setAnimChips(base.chips);
      setAnimMult(base.mult);
      sfx.play("play");

      await delay(300);

      let chips = base.chips;
      let mult = base.mult;

      // Score each card
      for (const card of played) {
        if (!ev.scoringIds.includes(card.id)) continue;
        const add = RANK_CHIPS[card.rank];
        chips += add;
        setScoringId(card.id);
        setAnimChips(chips);
        pushFloat(card.id, `+${add}`, "#00f0ff");
        sfx.play("chip");
        await delay(280);
      }
      setScoringId(null);

      // Apply joker effects
      const jokerCtxBase: JokerCtx = {
        chips,
        mult,
        playedCards: played,
        handType: ev.type,
        scoringIds: ev.scoringIds,
        money,
        handsLeft,
        discardsLeft,
        state: {},
      };

      let jokerCtx = { ...jokerCtxBase };
      let moneyDelta = 0;
      for (const oj of ownedJokers) {
        const ctx: JokerCtx = { ...jokerCtx, state: oj.state };
        const result = oj.def.effect(ctx);
        const prevMult = jokerCtx.mult;
        jokerCtx = { ...jokerCtx, chips: result.chips, mult: result.xMult ? jokerCtx.mult * result.xMult : result.mult };
        if (result.money) {
          moneyDelta += result.money;
        }
        if (result.mult !== prevMult || result.xMult) {
          setJokerFlash(true);
          pushFloat(played[0]?.id ?? "", result.xMult ? `x${result.xMult}` : `+${result.mult - prevMult}`, "#ff2e88");
          setAnimMult(jokerCtx.mult);
          sfx.play("joker");
          await delay(300);
          setJokerFlash(false);
        }
      }
      chips = jokerCtx.chips;
      // Floor mult at 1 so downside jokers (e.g. Cursed Coin x0.75) never invert the score.
      mult = Math.max(1, jokerCtx.mult);
      setAnimChips(chips);
      setAnimMult(mult);
      await delay(200);

      // Apply joker money effects (Blood Pact, Diamond Debt, Cursed Coin, Glass Cannon).
      if (moneyDelta !== 0) {
        setMoney((current) => Math.max(0, current + moneyDelta));
        pushFloat(
          played[0]?.id ?? "",
          `${moneyDelta > 0 ? "+" : ""}$${moneyDelta}`,
          moneyDelta > 0 ? "#ff9e2c" : "#ff2e88"
        );
        await delay(280);
      }

      const gained = Math.floor(chips * mult);
      const start = roundScore;
      const end = start + gained;
      const steps = 16;
      for (let i = 1; i <= steps; i++) {
        setRoundScore(Math.round(start + ((end - start) * i) / steps));
        await delay(22);
      }

      await delay(250);

      const playedIds = new Set(played.map((card) => card.id));
      const { newHand, rest } = refillInPlace(hand, playedIds, deck);
      const newHands = handsLeft - 1;

      setPlayZone([]);
      setHand(newHand);
      setDeck(rest);
      setHandsLeft(newHands);
      setAnimChips(null);
      setAnimMult(null);

      if (end >= blind.target) {
        await delay(200);
        const interestRate = deckType === "green" ? 2 : 1;
        const interest = Math.min(4, Math.floor(money / 5) * interestRate);
        setMoney((current) => current + blind.reward + Math.min(newHands, 5) + interest);
        saveScore(end);
        sfx.play("win");
        setPhase("shop");
      } else if (newHands <= 0) {
        setPhase("lost");
        saveScore(end);
        sfx.play("lose");
        const endCooldown = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem("minicard_cooldown_end", String(endCooldown));
        setCooldownEnd(endCooldown);
      } else {
        setPhase("playing");
      }
    } catch (err) {
      console.error("Error during doPlay evaluation/scoring:", err);
      setPlayZone([]);
      setAnimChips(null);
      setAnimMult(null);
      setScoringId(null);
      setPhase("playing");
    } finally {
      busy.current = false;
    }
  };

  const handleBuyJoker = (def: JokerDef) => {
    const maxJokerSlots = getMaxJokerSlots(deckType);
    const cost = jokerBaseCost(def);
    if (money < cost || ownedJokers.length >= maxJokerSlots) return;
    // Safety net: the shop UI already blocks conflicting jokers, but double-check here.
    if (jokerConflictsWith(def, ownedJokers)) return;
    setMoney(m => m - cost);
    setOwnedJokers(prev => [...prev, { def, edition: "base", state: {} }]);
    sfx.play("buy");
  };

  const handleSellJoker = (idx: number) => {
    const oj = ownedJokers[idx];
    if (!oj) return;
    setMoney(m => m + Math.floor(jokerBaseCost(oj.def) / 2));
    setOwnedJokers(prev => prev.filter((_, i) => i !== idx));
    sfx.play("sell");
  };

  // ─── Booster Pack result handler ───
  // Called when a booster pack is opened on-chain. If the joker is new,
  // it's added to the player's inventory. If it's a duplicate, the player
  // gets the sell value as in-game money instead.
  const handleBoosterJoker = useCallback((jokerId: number) => {
    const def = JOKER_DEFS.find((j) => j.id === jokerId);
    if (!def) return;

    const maxJokerSlots = getMaxJokerSlots(deckType);
    const isDuplicate = ownedJokers.some((oj) => oj.def.id === jokerId);
    const isConflict = jokerConflictsWith(def, ownedJokers);

    if (isDuplicate || isConflict || ownedJokers.length >= maxJokerSlots) {
      // Duplicate / conflict / no space — refund sell value as in-game money
      const refund = Math.floor(jokerBaseCost(def) / 2);
      setMoney(m => m + refund);
      sfx.play("buy");
    } else {
      // New joker — add to inventory
      setOwnedJokers(prev => [...prev, { def, edition: "base", state: {} }]);
      sfx.play("buy");
    }
  }, [ownedJokers, sfx, deckType]);

  const enterNextBlind = () => {
    const nextRound = round + 1;
    setRound(nextRound);
    startRound();
  };

  const restart = () => {
    const deckInfo = DECK_TYPES[deckType] ?? DECK_TYPES.red;
    setRound(1);
    setMoney(4 + deckInfo.bonusMoney);
    setOwnedJokers([]);
    levels.current = {};
    startRound();
  };

  const handleFreeRestart = () => {
    localStorage.removeItem("minicard_cooldown_end");
    setCooldownEnd(null);
    restart();
  };

  const handlePaidRestart = async () => {
    if (payingRestart) return;
    setPayingRestart(true);
    try {
      const success = await payRestartWithMiniPay();
      if (success) {
        localStorage.removeItem("minicard_cooldown_end");
        setCooldownEnd(null);
        restart();
      } else {
        // Rejected or no wallet — keep the user in-app. (Insufficient balance
        // throws and is handled in the catch block via the Deposit deeplink.)
        alert(dict.paymentRejected[lang]);
      }
    } catch (e) {
      // Insufficient balance → redirect to MiniPay Deposit deeplink.
      if (handlePaymentFailure(e)) return;
      console.error(e);
      alert(dict.paymentFailed[lang]);
    } finally {
      setPayingRestart(false);
    }
  };

  // ─── Username Registration Gate ───
  // Forces every player to register a unique username before they can play.
  // This is required by the updated contract (submitScore reverts without a username).
  const handleRegisterUsernameFromGate = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setUsernameError(dict.usernameEmpty[lang]);
      return;
    }
    if (trimmed.length > 20) {
      setUsernameError(dict.usernameTooLong[lang]);
      return;
    }

    setRegisteringUsername(true);
    setUsernameError("");
    try {
      const success = await registerUsernameToCelo(trimmed);
      if (success) {
        setRegisteredUsername(trimmed);
        setNeedsUsername(false);
        setUsernameInput("");
      } else {
        setUsernameError(dict.registerFailed[lang]);
      }
    } catch (err) {
      console.error("Username registration error:", err);
      setUsernameError(dict.registrationFailed[lang]);
    } finally {
      setRegisteringUsername(false);
    }
  };

  return (
    <main className="flex h-[100dvh] w-full justify-center overflow-hidden bg-[#0a0420]">
      <div className="felt-bg relative flex h-full w-full max-w-[480px] flex-col overflow-hidden">
        <ErrorBoundary fallback={<div className="absolute inset-0 bg-[#0a0420]" />}>
          <GbaBackground blindKind={phase === "shop" ? "shop" : phase === "lost" ? "lost" : blind.kind} phase={phase} />
        </ErrorBoundary>
        {/* Top Stats Bar */}
        <div className="relative z-10 flex gap-[5px] px-2 pb-1 pt-1.5 items-stretch">
          <StatBox label={dict.hands[lang]} value={handsLeft} color="#00f0ff" />
          <StatBox label={dict.discards[lang]} value={discardsLeft} color="#ff2e88" />
          <AnteBox ante={ante} lang={lang} />
          <StatBox label={dict.round[lang]} value={round} color="#ff9e2c" />
          <MoneyBox money={money} />
        </div>

        {/* Active Boss Blind Banner */}
        {blind.kind === "boss" && phase === "playing" && (
          <div className="relative z-20 mx-2 my-0.5 flex items-center justify-between bg-black/85 border border-[#ff2e88]/80 rounded-lg px-2.5 py-1 shadow-[0_4px_12px_rgba(255,46,136,0.3)] anim-pop">
            <div className="flex items-center gap-1.5">
              <span className="text-xs animate-pulse">👁️</span>
              <span className="font-pixel-fat text-[11px] text-[#ff2e88] tracking-wide uppercase">
                {bossName(blind.bossId, blind.name, lang)}
              </span>
            </div>
            <span className="font-pixel text-[10px] text-gray-200">
              {bossDesc(blind.bossId, blind.effect ?? "", lang)}
            </span>
          </div>
        )}

        {/* Floating Music Toggle (sits below the joker slots on the left edge) */}
        <MusicToggle lang={lang} />



        {/* Floating Timer Widget (Active from Round 2+) */}
        {round > 1 && phase === "playing" && (
          <div className="absolute top-[76px] right-0 z-30 anim-pop">
            <div className={`flex flex-col items-center justify-center min-w-[48px] px-2 py-1 rounded-l-lg border-y-2 border-l-2 border-black/50 text-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-all duration-300 ${timeLeft <= 15
                ? "bg-[#ff2e88] text-white animate-pulse scale-105 border-[#a01657]"
                : "bg-black text-[#ff2e88] border-[#ff2e88]/85"
              }`}>
              <span className="font-pixel text-[8px] uppercase tracking-wider leading-none text-gray-400">{dict.time[lang]}</span>
              <span className="font-pixel-fat text-sm leading-none mt-0.5">{timeLeft}s</span>
            </div>
          </div>
        )}

        {/* Joker Slots */}
        <div className="relative z-10 flex px-2 items-start mt-1">
          <SlotGroup label={`${ownedJokers.length}/${getMaxJokerSlots(deckType)}`} align="left">
            {Array.from({ length: getMaxJokerSlots(deckType) }).map((_, i) => {
              const oj = ownedJokers[i];
              return oj ? (
                <div
                  key={i}
                  className="relative h-[54px] w-[38px] group tap-target"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipIdx(activeTooltipIdx === i ? null : i);
                  }}
                >
                  <button
                    type="button"
                    aria-label={jokerName(oj.def, lang)}
                    className="relative overflow-hidden rounded-[9px] h-full w-full outline-none focus:ring-1 focus:ring-[#00f0ff]/50"
                  >
                    <div className="absolute inset-[10%] flex items-center justify-center">
                      <JokerArtworkFrame rarity={oj.def.rarity} className="h-full w-full" />
                    </div>
                  </button>
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-36 bg-black/95 border border-white/20 rounded-lg p-2 text-left pointer-events-none flex flex-col gap-0.5 shadow-xl transition-all duration-200 origin-bottom transform ${activeTooltipIdx === i
                      ? "opacity-100 scale-100 translate-y-0 visible"
                      : "opacity-0 scale-90 translate-y-1 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 group-hover:visible"
                    }`}>
                    <div className="font-pixel-fat text-[10px] text-white leading-none mb-0.5">{jokerName(oj.def, lang)}</div>
                    <div className="font-pixel text-[8px] capitalize leading-none mb-1" style={{ color: RARITY_COLOR[oj.def.rarity] }}>{rarityName(oj.def.rarity, lang)}</div>
                    <div className="font-pixel text-[9px] text-gray-300 leading-tight">{jokerDesc(oj.def, lang)}</div>
                  </div>
                </div>
              ) : (
                <EmptySlot key={i} className="h-[54px] w-[38px]" />
              );
            })}
          </SlotGroup>
        </div>

        {/* Play Zone */}
        <div className="relative z-10 flex flex-1 min-h-0 items-center justify-center py-2">
          {playZone.length > 0 && (
            <div className="flex items-end gap-[4px]">
              {playZone.map((card, idx) => {
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
                      deckType={deckType}
                      lang={lang}
                      className={`h-[80px] w-[56px] ${isScoring ? "anim-score-card" : "anim-play-card"}`}
                      style={{
                        transform: isScoring
                          ? "translateY(-18px) scale(1.1)"
                          : inHand
                            ? "translateY(-10px) scale(1.05)"
                            : "none",
                        transition: "transform 0.15s ease",
                        animationDelay: isScoring ? "0ms" : `${idx * 90}ms`,
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
          <div className="flex min-h-[96px] items-end justify-center w-full pl-[16px]">
            {hand.map((card, idx) => {
              const isSelected = selected.includes(card.id);
              const isHovered = hoveredIdx === idx;
              const x = idx - (hand.length - 1) / 2;
              const rot = x * 2.8; // Fan rotation angle factor
              const fanY = Math.abs(x) * 1.5;
              const selectY = isSelected ? -16 : 0;
              const hoverY = (isHovered && !isTouch) ? -12 : 0;
              const translateY = fanY + selectY + hoverY;

              return (
                <div
                  key={card.id}
                  style={{
                    marginLeft: idx > 0 ? "-14px" : "0px",
                    transform: `rotate(${rot}deg) translateY(${translateY}px)`,
                    transformOrigin: "bottom center",
                    zIndex: isHovered ? 100 : isSelected ? 50 + idx : 10 + idx,
                    transition: "transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)",
                  }}
                >
                  <PlayingCard
                    card={card}
                    selected={isSelected}
                    onClick={() => toggleSelect(card.id)}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    deckType={deckType}
                    lang={lang}
                    className="h-[80px] w-[56px] anim-draw-card"
                    style={{
                      animationDelay: `${idx * 80}ms`,
                    }}
                  />
                </div>
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
        <footer className="relative z-10 border-t-4 px-2 pb-3 pt-2 flex flex-col gap-1.5" style={{ borderColor: "#00f0ff", background: "#1a0d3a", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <div className="flex gap-1.5 items-stretch justify-between">
            {/* Left Column: Options */}
            <div className="w-[84px] shrink-0 flex flex-col gap-1.5">
              <div className="text-center leading-none">
                <span className="font-pixel text-[11px] text-gray-300">{dict.sortHand[lang]}</span>
                <div className="flex gap-[3px] mt-0.5">
                  <button type="button" onClick={() => sortBy("rank")} className="btn-chunky btn-orange tap-target-up flex-1 py-0.5 text-[11px] h-6">
                    {dict.rank[lang]}
                  </button>
                  <button type="button" onClick={() => sortBy("suit")} className="btn-chunky btn-orange tap-target-up flex-1 py-0.5 text-[11px] h-6">
                    {dict.suit[lang]}
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setShowRunInfo(true)} className="btn-chunky btn-red flex-1 text-base flex flex-col justify-center leading-none py-1 min-h-[36px]">
                <span>{dict.runInfoL1[lang]}</span>
                <span className="mt-[1px]">{dict.runInfoL2[lang]}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLeaderboard(true)}
                className="btn-chunky btn-orange tap-target-down py-1 text-[10px] leading-none h-7"
              >
                {dict.leaderboard[lang]}
              </button>
            </div>

            {/* Center Column: Score & Details */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              {/* Round Score */}
              <div className="bg-[#0a0420] border border-white/10 rounded-md h-8 flex items-center justify-between px-2 shadow-sm">
                <span className="text-xs leading-none text-left font-pixel text-gray-300">{dict.roundScoreL1[lang]}<br />{dict.roundScoreL2[lang]}</span>
                <span className="text-lg font-pixel-fat flex items-center gap-1"><span className="text-gray-400 text-sm">✺</span> {roundScore}</span>
              </div>

              {/* Blind progress — Minecraft-style XP bar: 10 thin segments */}
              <BlindXpBar score={roundScore} target={blind.target} kind={blind.kind} lang={lang} />

              {/* Current Hand Type */}
              <div className="flex-1 bg-[#120630] rounded-lg p-1.5 flex flex-col items-center justify-center border-b-4 border-black/40">
                <div className="text-[16px] font-pixel mb-1.5 leading-none">
                  <span className="text-white txt-outline">{showHandType || "\u00A0"}</span>
                  {showHandType && <span className="ml-1.5 text-xs text-[#ff9e2c]">{dict.lvl[lang]}{displayLevel}</span>}
                </div>
                <div className="flex w-full gap-1 h-7 items-stretch">
                  <div className="flex-1 bg-[#00f0ff] rounded flex items-center justify-end pr-2 text-base font-pixel-fat shadow-[0_2px_0_#0077b6] border border-black/10 text-[#04243a]">
                    {showChips}
                  </div>
                  <div className="w-4 flex items-center justify-center text-[#ff2e88] font-pixel-fat text-sm">X</div>
                  <div className={`flex-1 bg-[#ff2e88] rounded flex items-center justify-start pl-2 text-base font-pixel-fat shadow-[0_2px_0_#a01657] border border-black/10 transition-transform ${jokerFlash ? "scale-110" : ""}`}>
                    {showMult}
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Link
                  href="/stats"
                  className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#00f0ff] hover:text-[#ff9e2c] transition-all select-none flex items-center gap-1.5 hover:underline"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                  {dict.liveStats[lang]}
                </Link>
              </div>
            </div>

            {/* Right Column: Deck & Actions */}
            <div className="w-[84px] shrink-0 flex flex-col gap-1.5">
              {/* Balatro-style stacked deck */}
              <DeckPile count={deck.length} total={52} deckType={deckType} lang={lang} />
              <button
                type="button"
                onClick={doPlay}
                disabled={!hasSelection || phase !== "playing"}
                className="btn-chunky btn-blue flex-1 text-base flex flex-col justify-center leading-none py-1 min-h-[36px]"
              >
                <span>{dict.playL1[lang]}</span>
                <span className="mt-[1px]">{dict.playL2[lang]}</span>
              </button>
              <button
                type="button"
                onClick={doDiscard}
                disabled={!hasSelection || discardsLeft <= 0 || phase !== "playing"}
                className="btn-chunky btn-red tap-target-down py-1 text-sm leading-none h-7"
              >
                {dict.discard[lang]}
              </button>
            </div>
          </div>
        </footer>

        {phase === "shop" && (
          <Shop
            money={money}
            ownedJokers={ownedJokers}
            ante={ante}
            onBuy={handleBuyJoker}
            onSell={handleSellJoker}
            onClose={enterNextBlind}
            onBoosterJoker={handleBoosterJoker}
            lang={lang}
          />
        )}
        {phase === "lost" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[3px] overflow-hidden">
            <div className="panel anim-pop rounded-xl px-6 py-5 text-center max-w-[280px] flex flex-col gap-3">
              <div className="font-pixel-fat text-3xl txt-outline text-[#ff2e88]">
                {cooldownEnd && cooldownEnd > Date.now() ? dict.cooldownActive[lang] : dict.gameOver[lang]}
              </div>
              {roundScore > 0 && (
                <div className="font-pixel text-base text-white/85 leading-tight">
                  {fmt(dict.roundScoreSummary[lang], { round, score: roundScore })}
                </div>
              )}

              {!walletAddress.startsWith("0xceloGuest") && lastScore > 0 && (
                <button
                  type="button"
                  onClick={handleSubmitLastScore}
                  disabled={submittingScore || scoreSubmitted}
                  className="btn-chunky btn-orange w-full py-2 text-sm leading-none flex items-center justify-center gap-1.5"
                >
                  {submittingScore ? dict.submitting[lang] : scoreSubmitted ? dict.saved[lang] : dict.saveScore[lang]}
                </button>
              )}

              {cooldownEnd && cooldownEnd > Date.now() ? (
                <div className="flex flex-col gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={handlePaidRestart}
                    disabled={payingRestart}
                    className="btn-chunky btn-orange w-full py-2 text-base flex items-center justify-center gap-1.5"
                  >
                    {payingRestart ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>{dict.paying[lang]}</span>
                      </>
                    ) : (
                      <>
                        <span>{dict.playAgain[lang]}</span>
                        <span className="bg-black/25 rounded px-1.5 py-0.5 font-pixel text-[10px] text-[#ff9e2c]">$0.01</span>
                      </>
                    )}
                  </button>
                  <CooldownCountdown
                    cooldownEnd={cooldownEnd}
                    onExpired={() => setCooldownEnd(null)}
                    lang={lang}
                  />
                  {walletAddress.startsWith("0xceloGuest") && (
                    <div className="font-pixel text-[9px] text-[#ff8b85] mt-1 leading-tight">
                      {dict.guestModeCooldown[lang]}
                    </div>
                  )}
                </div>
              ) : (
                <button type="button" onClick={handleFreeRestart} className="btn-chunky btn-blue w-full py-2 text-lg">
                  {dict.playAgainBlue[lang]}
                </button>
              )}
            </div>
          </div>
        )}

        {showRunInfo && (
          <RunInfo
            levels={levels.current}
            jokers={ownedJokers}
            money={money}
            round={round}
            ante={ante}
            deckType={deckType}
            onSelectDeck={handleSelectDeck}
            onClose={() => setShowRunInfo(false)}
            lang={lang}
            setLang={setLang}
          />
        )}

        {showLeaderboard && (
          <LeaderboardOverlay
            onClose={() => setShowLeaderboard(false)}
            walletAddress={walletAddress}
            lastScore={lastScore}
            lastRound={lastRound}
            scoreSubmitted={scoreSubmitted}
            submittingScore={submittingScore}
            onSubmitScore={handleSubmitLastScore}
            lang={lang}
          />
        )}

        {/* Username Registration Gate — blocks play until username is set */}
        {needsUsername && !walletAddress.startsWith("0xceloGuest") && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <div className="panel anim-pop rounded-xl px-5 py-5 w-full max-w-[300px] flex flex-col items-center gap-3">
              <div className="font-pixel-fat text-2xl txt-chrome text-center">
                {dict.registerUsername[lang]}
              </div>
              <div className="font-pixel text-[11px] text-gray-300 text-center leading-tight">
                {dict.usernameNeeded[lang]}
              </div>
              <input
                type="text"
                placeholder={dict.usernamePlaceholder[lang]}
                maxLength={20}
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  setUsernameError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !registeringUsername && usernameInput.trim()) {
                    handleRegisterUsernameFromGate();
                  }
                }}
                disabled={registeringUsername}
                className="bg-black/50 border border-white/10 rounded px-3 py-2 w-full font-pixel text-sm text-white text-center focus:outline-none focus:border-[#00f0ff]"
                autoFocus
              />
              {usernameError && (
                <div className="font-pixel text-[10px] text-[#ff2e88] text-center leading-tight">
                  {usernameError}
                </div>
              )}
              <button
                type="button"
                onClick={handleRegisterUsernameFromGate}
                disabled={registeringUsername || !usernameInput.trim()}
                className="btn-chunky btn-orange w-full py-2 text-sm flex items-center justify-center gap-1.5"
              >
                {registeringUsername ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>{dict.registering[lang]}</span>
                  </>
                ) : (
                  dict.confirmUsername[lang]
                )}
              </button>
              <div className="font-pixel text-[9px] text-gray-500 text-center leading-tight">
                {dict.usernameRegistersNote[lang]}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StatBox({ label, value, color, className = "" }: { label: string; value: number | string; color: string; className?: string }) {
  return (
    <div className={`stat-box flex-1 py-1 px-1 flex flex-col justify-between ${className}`}>
      <span className="text-[11px] text-gray-300 leading-none">{label}</span>
      <div className="stat-inner">
        <span className="text-lg font-pixel-fat leading-none" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function AnteBox({ ante, lang }: { ante: number; lang: Lang }) {
  return (
    <div className="stat-box flex-1 py-1 px-1 flex flex-col justify-between">
      <span className="text-[11px] text-gray-300 leading-none">{dict.ante[lang]}</span>
      <div className="stat-inner flex items-baseline justify-center">
        <span className="text-lg font-pixel-fat text-[#ff9e2c] leading-none">{ante}</span>
        <span className="text-[9px] text-gray-400 ml-0.5">/8</span>
      </div>
    </div>
  );
}

function MoneyBox({ money }: { money: number }) {
  return (
    <div className="stat-box w-[76px] py-1 px-1 justify-center">
      <span className="text-2xl font-pixel-fat text-[#ff9e2c] leading-none">${money}</span>
    </div>
  );
}

function SlotGroup({ label, align, children }: { label: string; align: "left" | "right"; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <span className="font-pixel mb-[2px] px-1 text-[11px] leading-none text-white/75">{label}</span>
      <div
        className="flex gap-[3px] overflow-hidden rounded-lg p-[3px]"
        style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3)" }}
      >{children}</div>
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

function DeckPile({ count, total, deckType = "red", lang }: { count: number; total: number; deckType?: DeckType; lang: Lang }) {
  // Build a small stack of 4 card backs to simulate the Balatro deck pile
  const layers = Math.min(4, Math.max(1, Math.ceil(count / (total / 4))));
  const empty = count === 0;

  const backColor =
    deckType === "black"
      ? "black"
      : deckType === "blue"
        ? "blue"
        : deckType === "green"
          ? "green"
          : deckType === "yellow"
            ? "yellow"
            : "red";

  return (
    <div className="flex flex-col items-center justify-center gap-[3px] py-[2px]">
      {/* Card stack */}
      <div className="relative" style={{ width: 34, height: 48 }}>
        {/* Shadow layers (bottom of stack) */}
        {Array.from({ length: layers }).map((_, i) => {
          const reverseIdx = layers - 1 - i;
          const offsetY = reverseIdx * 1.5;
          const offsetX = reverseIdx * 0.5;
          const brightness = 0.45 + (i / Math.max(layers - 1, 1)) * 0.55;
          return (
            <div
              key={i}
              className="absolute rounded-[6px] border-[2px] border-[#b026ff]/60 overflow-hidden bg-[#0a0420]"
              style={{
                width: 34,
                height: 48,
                bottom: offsetY,
                left: offsetX,
                boxShadow: i === layers - 1 ? "0 4px 10px rgba(0,0,0,0.6), 0 0 8px rgba(0,240,255,0.22)" : undefined,
                filter: empty
                  ? "grayscale(1) brightness(0.4)"
                  : i < layers - 1
                    ? `brightness(${brightness})`
                    : undefined,
                zIndex: i,
              }}
            >
              {!empty && (
                <img
                  src={`/assets/cards/back-${backColor}.webp`}
                  alt={dict.deckBack[lang]}
                  className="h-full w-full object-cover pixelated"
                  style={{
                    imageRendering: "pixelated",
                    // Synthwave tint on warm deck backs (red→magenta, green→cyan).
                    filter: backColor === "red"
                      ? "hue-rotate(285deg) saturate(1.4)"
                      : backColor === "green"
                        ? "hue-rotate(170deg) saturate(1.3)"
                        : undefined,
                  }}
                />
              )}
              {/* Shimmer overlay on top card */}
              {i === layers - 1 && !empty && (
                <div
                  className="absolute inset-0 rounded-[5px] deck-shimmer"
                  style={{ pointerEvents: "none" }}
                />
              )}
            </div>
          );
        })}
        {/* Empty deck placeholder */}
        {empty && (
          <div
            className="absolute inset-0 rounded-[6px] border-2 border-dashed border-white/20 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.3)" }}
          >
            <span className="font-pixel text-[9px] text-white/30 text-center leading-tight">{dict.empty[lang]}</span>
          </div>
        )}
      </div>
      {/* Count label */}
      <div className="panel-inset rounded-full px-2 py-[1px]">
        <span className="font-pixel-fat text-[12px] leading-none text-white">
          {count}<span className="text-white/40 font-pixel text-[10px]">/{total}</span>
        </span>
      </div>
    </div>
  );
}

function BlindXpBar({
  score,
  target,
  kind,
  lang,
}: {
  score: number;
  target: number;
  kind: Blind["kind"];
  lang: Lang;
}) {
  // Minecraft-style XP bar: 10 thin segments that light up as you progress.
  // Color follows the blind kind (small=cyan, big=orange, boss=magenta).
  const color = kind === "small" ? "#00f0ff" : kind === "big" ? "#ff9e2c" : "#ff2e88";
  const glow = kind === "small" ? "rgba(0,240,255,0.6)" : kind === "big" ? "rgba(255,158,44,0.6)" : "rgba(255,46,136,0.65)";
  const pct = Math.min(1, target > 0 ? score / target : 0);
  const filled = Math.floor(pct * 10);

  return (
    <div className="flex gap-[2px] h-[5px] px-[1px]" aria-label={fmt(dict.blindProgress[lang], { pct: Math.round(pct * 100) })}>
      {Array.from({ length: 10 }, (_, i) => {
        const on = i < filled;
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-colors duration-150"
            style={{
              backgroundColor: on ? color : "rgba(255,255,255,0.08)",
              boxShadow: on ? `0 0 4px ${glow}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function BlindToken({ kind, lang }: { kind: Blind["kind"]; lang: Lang }) {
  // Synthwave: small→cyan, big→sun, boss→magenta
  const color = kind === "small" ? "#00f0ff" : kind === "big" ? "#ff9e2c" : "#ff2e88";
  const border = kind === "small" ? "#0077b6" : kind === "big" ? "#b35900" : "#a01657";
  const shadow = kind === "small" ? "#003a5a" : kind === "big" ? "#6b3d00" : "#5a0c30";
  const label = kind === "boss" ? dict.bossBlind[lang] : kind === "big" ? dict.bigBlind[lang] : dict.smlBlind[lang];
  const glow = kind === "small" ? "rgba(0,240,255,0.5)" : kind === "big" ? "rgba(255,158,44,0.5)" : "rgba(255,46,136,0.55)";

  return (
    <div
      className="w-10 h-10 rounded-full border-[2.5px] flex items-center justify-center text-[9px] text-center leading-none text-white font-pixel-fat"
      style={{
        backgroundColor: color,
        borderColor: border,
        boxShadow: `0 3px 0 ${shadow}, 0 0 10px ${glow}`,
        color: kind === "small" ? "#04243a" : "#ffffff",
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
  username?: string;
  score: number;
  round: number;
  date: string;
  timestamp?: number;
}

interface LeaderboardOverlayProps {
  onClose: () => void;
  walletAddress: string;
  lastScore: number;
  lastRound: number;
  scoreSubmitted: boolean;
  submittingScore: boolean;
  onSubmitScore: () => Promise<void>;
  lang: Lang;
}

function LeaderboardOverlay({
  onClose,
  walletAddress,
  lastScore,
  lastRound,
  scoreSubmitted,
  submittingScore,
  onSubmitScore,
  lang,
}: LeaderboardOverlayProps) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registeredUsername, setRegisteredUsername] = useState<string | null>(null);

  // Fetch current user's registered username on-chain
  useEffect(() => {
    if (walletAddress && !walletAddress.startsWith("0xceloGuest")) {
      getUsernameFromCelo(walletAddress).then((uname) => {
        if (uname) {
          setRegisteredUsername(uname);
        }
      });
    }
  }, [walletAddress]);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    // Try fetching scores from Celo smart contract first
    let contractScores: LeaderboardEntry[] = [];
    try {
      contractScores = await getScoresFromCelo();
    } catch (err) {
      console.warn("Failed to retrieve on-chain scores:", err);
    }

    if (contractScores && contractScores.length > 0) {
      // Sort and slice contract scores
      contractScores.sort((a, b) => b.score - a.score);
      setScores(contractScores.slice(0, 10));
      setLoading(false);
      return;
    }

    // Fallback to local storage if no contract scores are returned
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

    // Sort and slice local scores
    list.sort((a, b) => b.score - a.score);

    // Resolve usernames for local scores from contract
    const resolvedList = await resolveUsernamesForScores(list.slice(0, 10));
    setScores(resolvedList);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleRegisterUsername = async () => {
    if (!usernameInput.trim()) return;
    setRegistering(true);
    const success = await registerUsernameToCelo(usernameInput.trim());
    if (success) {
      alert(dict.usernameSetSuccess[lang]);
      setRegisteredUsername(usernameInput.trim());
      setUsernameInput("");
      loadLeaderboard();
    } else {
      alert(dict.setUsernameFailed[lang]);
    }
    setRegistering(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="panel anim-pop rounded-xl px-4 py-4 w-full max-w-[310px] flex flex-col items-center">
        {/* Title */}
        <div className="font-pixel-fat mb-1 text-3xl txt-chrome">
          {dict.leaderboardTitle[lang]}
        </div>

        {/* Wallet connection info — show username as primary identifier, address only as secondary hint */}
        <div className="text-[10px] text-gray-300 font-pixel mb-3 flex items-center justify-center gap-1.5 bg-black/40 px-2.5 py-0.5 rounded-full border border-white/5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse"></div>
          <span>{registeredUsername ? registeredUsername : (walletAddress.startsWith("0xceloGuest") ? dict.guest[lang] : `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`)}</span>
        </div>

        {/* Username Registration Form (if connected to a wallet) */}
        {!walletAddress.startsWith("0xceloGuest") && (
          <div className="w-full bg-black/20 border border-white/5 rounded-lg p-2 mb-3 flex flex-col gap-1.5 font-pixel text-xs">
            {registeredUsername ? (
              <div className="text-center py-1">
                <span className="text-gray-400 text-[10px] block">{dict.yourUsername[lang]}</span>
                <span className="text-[#ff9e2c] font-pixel-fat text-sm">{registeredUsername}</span>
                <button
                  type="button"
                  onClick={() => setRegisteredUsername(null)}
                  className="text-gray-500 hover:text-gray-300 text-[9px] block mx-auto mt-1 underline font-pixel"
                >
                  {dict.changeUsername[lang]}
                </button>
              </div>
            ) : (
              <>
                <div className="text-gray-400 text-[10px]">{dict.registerUniqueUsername[lang]}</div>
                <div className="flex gap-1.5 w-full">
                  <input
                    type="text"
                    placeholder={dict.usernamePlaceholder2[lang]}
                    maxLength={20}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    disabled={registering}
                    className="bg-black/50 border border-white/10 rounded px-2 py-1 flex-1 font-pixel text-[11px] text-white focus:outline-none focus:border-[#00f0ff]"
                  />
                  <button
                    type="button"
                    onClick={handleRegisterUsername}
                    disabled={registering || !usernameInput.trim()}
                    className="btn-chunky btn-orange px-3 py-1 text-[10px] leading-none shrink-0"
                  >
                    {registering ? "..." : dict.set[lang]}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Save score section if user has a score that hasn't been submitted yet */}
        {!walletAddress.startsWith("0xceloGuest") && lastScore > 0 && (
          <div className="w-full bg-[#0a2a24] border border-[#00f0ff]/20 rounded-lg p-2 mb-3 flex flex-col gap-1.5 font-pixel text-xs">
            <div className="text-gray-400 text-[9px] uppercase tracking-wider text-center">{dict.currentSessionScore[lang]}</div>
            <div className="flex justify-between items-center px-1">
              <span className="text-gray-300">{dict.round[lang]} {lastRound}</span>
              <span className="text-[#00f0ff] font-pixel-fat text-sm">{lastScore} pts</span>
            </div>
            <button
              type="button"
              onClick={onSubmitScore}
              disabled={submittingScore || scoreSubmitted}
              className="btn-chunky btn-orange w-full py-1 text-[10px] leading-none flex items-center justify-center gap-1"
            >
              {submittingScore ? dict.submitting[lang] : scoreSubmitted ? dict.saved[lang] : dict.submitScore[lang]}
            </button>
          </div>
        )}

        {/* Scores Table */}
        <div className="w-full flex-1 bg-[#1a1d20] border-2 border-black/40 rounded-lg p-1.5 mb-4 max-h-[200px] overflow-y-auto">
          {loading ? (
            <div className="text-center text-xs text-gray-500 font-pixel py-8 animate-pulse">{dict.loadingScores[lang]}</div>
          ) : scores.length === 0 ? (
            <div className="text-center text-xs text-gray-500 font-pixel py-8">{dict.noScoresYet[lang]}</div>
          ) : (
            <table className="w-full text-left font-pixel text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-[10px]">
                  <th className="pb-1 w-6">#</th>
                  <th className="pb-1">{dict.colPlayer[lang]}</th>
                  <th className="pb-1 text-right">{dict.colRound[lang]}</th>
                  <th className="pb-1 text-right">{dict.colScore[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry, index) => {
                  const isCurrentPlayer = entry.address.toLowerCase() === walletAddress.toLowerCase();
                  const rankColors = ["text-[#ffd700]", "text-[#c0c0c0]", "text-[#cd7f32]"];
                  const rankColor = rankColors[index] || "text-white";
                  return (
                    <tr
                      key={index}
                      className={`border-b border-white/5 last:border-b-0 py-1 ${isCurrentPlayer ? "bg-white/10 rounded" : ""}`}
                    >
                      <td className={`py-1 font-bold ${rankColor}`}>{index + 1}</td>
                      <td className="py-1 font-mono text-[11px] text-gray-300">
                        {entry.username
                          ? entry.username
                          : entry.address.startsWith("0xceloGuest")
                            ? dict.guest[lang]
                            : fmt(dict.playerN[lang], { n: entry.address.slice(2, 6) })}
                      </td>
                      <td className="py-1 text-right text-gray-400">{entry.round}</td>
                      <td className="py-1 text-right font-pixel-fat text-[#00f0ff]">{entry.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Buttons */}
        <div className="w-full mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="btn-chunky btn-blue py-1.5 text-xs w-full"
          >
            {dict.closeCaps[lang]}
          </button>
        </div>
      </div>
    </div>
  );
}

function CooldownCountdown({ cooldownEnd, onExpired, lang }: { cooldownEnd: number; onExpired: () => void; lang: Lang }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = cooldownEnd - Date.now();
      if (diff <= 0) {
        onExpired();
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n: number) => String(n).padStart(2, "0");
      setTimeLeft(`${pad(h)}h ${pad(m)}m ${pad(s)}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [cooldownEnd, onExpired]);

  return (
    <div className="font-pixel text-[11px] text-gray-400 mt-1">
      {dict.freePlayIn[lang]} <span className="text-white font-mono">{timeLeft || "--:--:--"}</span>
    </div>
  );
}


