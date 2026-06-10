export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export type HandType =
  | "High Card"
  | "Pair"
  | "Two Pair"
  | "Three of a Kind"
  | "Straight"
  | "Flush"
  | "Full House"
  | "Four of a Kind"
  | "Straight Flush"
  | "Royal Flush"
  | "Five of a Kind"
  | "Flush House"
  | "Flush Five";

export const RANKS: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export const SUIT_IS_RED: Record<Suit, boolean> = {
  spades: false,
  hearts: true,
  diamonds: true,
  clubs: false,
};

export const RANK_ORDER: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export const RANK_CHIPS: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
};

export interface HandScore {
  chips: number;
  mult: number;
}

// Matching GBA hand_base_values[] exactly
export const HAND_BASE: Record<HandType, HandScore> = {
  "High Card": { chips: 5, mult: 1 },
  Pair: { chips: 10, mult: 2 },
  "Two Pair": { chips: 20, mult: 2 },
  "Three of a Kind": { chips: 30, mult: 3 },
  Straight: { chips: 30, mult: 4 },
  Flush: { chips: 35, mult: 4 },
  "Full House": { chips: 40, mult: 4 },
  "Four of a Kind": { chips: 60, mult: 7 },
  "Straight Flush": { chips: 100, mult: 8 },
  "Royal Flush": { chips: 100, mult: 8 },
  "Five of a Kind": { chips: 120, mult: 12 },
  "Flush House": { chips: 140, mult: 14 },
  "Flush Five": { chips: 160, mult: 16 },
};

export const HAND_LEVEL_BUMP: Record<HandType, HandScore> = {
  "High Card": { chips: 10, mult: 1 },
  Pair: { chips: 15, mult: 1 },
  "Two Pair": { chips: 20, mult: 1 },
  "Three of a Kind": { chips: 20, mult: 2 },
  Straight: { chips: 30, mult: 3 },
  Flush: { chips: 15, mult: 2 },
  "Full House": { chips: 25, mult: 2 },
  "Four of a Kind": { chips: 30, mult: 3 },
  "Straight Flush": { chips: 40, mult: 4 },
  "Royal Flush": { chips: 40, mult: 4 },
  "Five of a Kind": { chips: 35, mult: 3 },
  "Flush House": { chips: 40, mult: 4 },
  "Flush Five": { chips: 50, mult: 3 },
};

// -- GBA-like short display names (from hand_base_values[].display_name) --
export const HAND_SHORT_NAME: Record<HandType, string> = {
  "High Card": "Hi-Card",
  Pair: "Pair",
  "Two Pair": "2 Pair",
  "Three of a Kind": "3 OAK",
  Straight: "Strt",
  Flush: "Flush",
  "Full House": "Full H",
  "Four of a Kind": "4 OAK",
  "Straight Flush": "Strt F",
  "Royal Flush": "Royal F",
  "Five of a Kind": "5 OAK",
  "Flush House": "Flush H",
  "Flush Five": "Flush 5",
};

let idCounter = 0;

function nextId() {
  idCounter += 1;
  return `c${idCounter}`;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: nextId(), rank, suit });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Evaluation {
  type: HandType;
  scoringIds: string[];
}

function isStraight(sortedVals: number[]): boolean {
  if (sortedVals.length !== 5) return false;

  let run = true;
  for (let i = 1; i < 5; i += 1) {
    if (sortedVals[i] !== sortedVals[i - 1] + 1) run = false;
  }
  if (run) return true;

  const wheel = [2, 3, 4, 5, 14];
  return wheel.every((value, index) => sortedVals[index] === value);
}

export function evaluate(cards: Card[]): Evaluation {
  if (cards.length === 0) return { type: "High Card", scoringIds: [] };

  const byRank = new Map<number, Card[]>();
  for (const card of cards) {
    const value = RANK_ORDER[card.rank];
    if (!byRank.has(value)) byRank.set(value, []);
    byRank.get(value)!.push(card);
  }

  const groups = [...byRank.entries()]
    .map(([value, groupedCards]) => ({
      val: value,
      cards: groupedCards,
      count: groupedCards.length,
    }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  const counts = groups.map((group) => group.count).sort((a, b) => b - a);
  const isFlush = cards.length === 5 && cards.every((card) => card.suit === cards[0].suit);
  const uniqueVals = [...byRank.keys()].sort((a, b) => a - b);
  const straight = cards.length === 5 && isStraight(uniqueVals);
  const allIds = cards.map((card) => card.id);

  if (counts[0] === 5) {
    if (isFlush) return { type: "Flush Five", scoringIds: allIds };
    return { type: "Five of a Kind", scoringIds: allIds };
  }

  if (counts[0] === 3 && counts[1] === 2 && isFlush) {
    return { type: "Flush House", scoringIds: allIds };
  }

  if (straight && isFlush) {
    const high = Math.max(...uniqueVals);
    if (high === 14 && uniqueVals.includes(10)) {
      return { type: "Royal Flush", scoringIds: allIds };
    }
    return { type: "Straight Flush", scoringIds: allIds };
  }

  if (counts[0] === 4) {
    const four = groups.find((group) => group.count === 4)!;
    return { type: "Four of a Kind", scoringIds: four.cards.map((card) => card.id) };
  }

  if (counts[0] === 3 && counts[1] === 2) {
    return { type: "Full House", scoringIds: allIds };
  }

  if (isFlush) return { type: "Flush", scoringIds: allIds };
  if (straight) return { type: "Straight", scoringIds: allIds };

  if (counts[0] === 3) {
    const three = groups.find((group) => group.count === 3)!;
    return { type: "Three of a Kind", scoringIds: three.cards.map((card) => card.id) };
  }

  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = groups.filter((group) => group.count === 2);
    return {
      type: "Two Pair",
      scoringIds: pairs.flatMap((group) => group.cards.map((card) => card.id)),
    };
  }

  if (counts[0] === 2) {
    const pair = groups.find((group) => group.count === 2)!;
    return { type: "Pair", scoringIds: pair.cards.map((card) => card.id) };
  }

  const highest = cards.reduce((a, b) => (RANK_ORDER[a.rank] >= RANK_ORDER[b.rank] ? a : b));
  return { type: "High Card", scoringIds: [highest.id] };
}

export function handScore(type: HandType, levels: Partial<Record<HandType, number>>): HandScore {
  const base = HAND_BASE[type];
  const bump = HAND_LEVEL_BUMP[type];
  const level = levels[type] ?? 1;
  const extra = level - 1;

  return {
    chips: base.chips + bump.chips * extra,
    mult: base.mult + bump.mult * extra,
  };
}

// ─── Deck Types (from GBA deck_types.h) ───
export type DeckType = "red" | "blue" | "yellow" | "green" | "black" | "painted";

export interface DeckInfo {
  name: string;
  color: string;
  borderColor: string;
  desc: string;
  bonusHands: number;
  bonusDiscards: number;
  bonusMoney: number;
  bonusHandSize: number;
}

export const DECK_TYPES: Record<DeckType, DeckInfo> = {
  red: {
    name: "Red Deck",
    color: "#c0392b",
    borderColor: "#922b21",
    desc: "+1 Discard every round",
    bonusHands: 0,
    bonusDiscards: 1,
    bonusMoney: 0,
    bonusHandSize: 0,
  },
  blue: {
    name: "Blue Deck",
    color: "#2b93ff",
    borderColor: "#155bb5",
    desc: "+1 Hand every round",
    bonusHands: 1,
    bonusDiscards: 0,
    bonusMoney: 0,
    bonusHandSize: 0,
  },
  yellow: {
    name: "Yellow Deck",
    color: "#f2c93b",
    borderColor: "#b8951a",
    desc: "Start with extra $10",
    bonusHands: 0,
    bonusDiscards: 0,
    bonusMoney: 10,
    bonusHandSize: 0,
  },
  green: {
    name: "Green Deck",
    color: "#3aa35a",
    borderColor: "#287a40",
    desc: "$2 interest per round (max $4)",
    bonusHands: 0,
    bonusDiscards: 0,
    bonusMoney: 0,
    bonusHandSize: 0,
  },
  black: {
    name: "Black Deck",
    color: "#2c3e50",
    borderColor: "#1a252f",
    desc: "+1 Joker slot, -1 Hand",
    bonusHands: -1,
    bonusDiscards: 0,
    bonusMoney: 0,
    bonusHandSize: 0,
  },
  painted: {
    name: "Painted Deck",
    color: "#9b59b6",
    borderColor: "#7d3c98",
    desc: "+2 Hand size, -1 Joker slot",
    bonusHands: 0,
    bonusDiscards: 0,
    bonusMoney: 0,
    bonusHandSize: 2,
  },
};

// ─── Joker System (ported from GBA joker.h / joker_effects.c) ───

export type JokerRarity = "common" | "uncommon" | "rare" | "legendary";

export interface JokerDef {
  id: number;
  name: string;
  rarity: JokerRarity;
  desc: string;
  // Effect: receives chips, mult, cards, handType and returns modified chips/mult
  effect: (ctx: JokerCtx) => JokerResult;
}

export interface JokerCtx {
  chips: number;
  mult: number;
  playedCards: Card[];
  handType: HandType;
  scoringIds: string[];
  money: number;
  handsLeft: number;
  discardsLeft: number;
  state: Record<string, number>; // persistent per-joker state
}

export interface JokerResult {
  chips: number;
  mult: number;
  xMult?: number;
  money?: number;
  message?: string;
}

export interface OwnedJoker {
  def: JokerDef;
  edition: "base" | "foil" | "holo" | "polychrome";
  state: Record<string, number>;
}

export const JOKER_DEFS: JokerDef[] = [
  {
    id: 1,
    name: "Joker",
    rarity: "common",
    desc: "+4 Mult",
    effect: (ctx) => ({ chips: ctx.chips, mult: ctx.mult + 4 }),
  },
  {
    id: 2,
    name: "Greedy",
    rarity: "common",
    desc: "+3 Mult if played hand has a ♦ card",
    effect: (ctx) => {
      const hasDiamond = ctx.playedCards.some((c) => c.suit === "diamonds" && ctx.scoringIds.includes(c.id));
      return { chips: ctx.chips, mult: ctx.mult + (hasDiamond ? 3 : 0) };
    },
  },
  {
    id: 3,
    name: "Lusty",
    rarity: "common",
    desc: "+3 Mult if played hand has a ♥ card",
    effect: (ctx) => {
      const hasHeart = ctx.playedCards.some((c) => c.suit === "hearts" && ctx.scoringIds.includes(c.id));
      return { chips: ctx.chips, mult: ctx.mult + (hasHeart ? 3 : 0) };
    },
  },
  {
    id: 4,
    name: "Wrathful",
    rarity: "common",
    desc: "+3 Mult if played hand has a ♠ card",
    effect: (ctx) => {
      const hasSpade = ctx.playedCards.some((c) => c.suit === "spades" && ctx.scoringIds.includes(c.id));
      return { chips: ctx.chips, mult: ctx.mult + (hasSpade ? 3 : 0) };
    },
  },
  {
    id: 5,
    name: "Glutton",
    rarity: "common",
    desc: "+3 Mult if played hand has a ♣ card",
    effect: (ctx) => {
      const hasClub = ctx.playedCards.some((c) => c.suit === "clubs" && ctx.scoringIds.includes(c.id));
      return { chips: ctx.chips, mult: ctx.mult + (hasClub ? 3 : 0) };
    },
  },
  {
    id: 6,
    name: "Jolly",
    rarity: "common",
    desc: "+8 Mult if hand contains a Pair",
    effect: (ctx) => {
      const ev = evaluate(ctx.playedCards);
      const isPair = ev.type === "Pair" || ev.type === "Two Pair" || ev.type === "Full House" || ev.type === "Four of a Kind" || ev.type === "Five of a Kind" || ev.type === "Flush House" || ev.type === "Flush Five";
      return { chips: ctx.chips, mult: ctx.mult + (isPair ? 8 : 0) };
    },
  },
  {
    id: 7,
    name: "Zany",
    rarity: "common",
    desc: "+12 Mult if hand contains Three of a Kind",
    effect: (ctx) => {
      const ev = evaluate(ctx.playedCards);
      const has3 = ev.type === "Three of a Kind" || ev.type === "Full House" || ev.type === "Four of a Kind" || ev.type === "Five of a Kind" || ev.type === "Flush House" || ev.type === "Flush Five";
      return { chips: ctx.chips, mult: ctx.mult + (has3 ? 12 : 0) };
    },
  },
  {
    id: 8,
    name: "Hack",
    rarity: "uncommon",
    desc: "+30 Chips for each 2,3,4,5 in hand",
    effect: (ctx) => {
      const low = ["2", "3", "4", "5"];
      const count = ctx.playedCards.filter((c) => low.includes(c.rank) && ctx.scoringIds.includes(c.id)).length;
      return { chips: ctx.chips + count * 30, mult: ctx.mult };
    },
  },
  {
    id: 9,
    name: "Sly",
    rarity: "common",
    desc: "+50 Chips if hand is a Pair",
    effect: (ctx) => {
      const isPair = ctx.handType === "Pair";
      return { chips: ctx.chips + (isPair ? 50 : 0), mult: ctx.mult };
    },
  },
  {
    id: 10,
    name: "Half",
    rarity: "common",
    desc: "+20 Mult if hand has 3 or fewer cards",
    effect: (ctx) => ({
      chips: ctx.chips,
      mult: ctx.mult + (ctx.playedCards.length <= 3 ? 20 : 0),
    }),
  },
  {
    id: 11,
    name: "Banner",
    rarity: "common",
    desc: "+30 Chips per discard remaining",
    effect: (ctx) => ({
      chips: ctx.chips + ctx.discardsLeft * 30,
      mult: ctx.mult,
    }),
  },
  {
    id: 12,
    name: "Mystic Summit",
    rarity: "common",
    desc: "+15 Mult when 0 discards left",
    effect: (ctx) => ({
      chips: ctx.chips,
      mult: ctx.mult + (ctx.discardsLeft === 0 ? 15 : 0),
    }),
  },
];

export function rollShopJokers(owned: OwnedJoker[], count: number): JokerDef[] {
  const ownedIds = new Set(owned.map((j) => j.def.id));
  const available = JOKER_DEFS.filter((j) => !ownedIds.has(j.id));
  const shuffled = shuffle(available);
  return shuffled.slice(0, count);
}

export function jokerBaseCost(def: JokerDef): number {
  switch (def.rarity) {
    case "common":
      return 4;
    case "uncommon":
      return 6;
    case "rare":
      return 8;
    case "legendary":
      return 20;
  }
}

export function jokerSellValue(def: JokerDef): number {
  return Math.max(1, Math.floor(jokerBaseCost(def) / 2));
}

// ─── Interest system (from GBA: MAX_INTEREST=5, INTEREST_PER_5=1) ───
export const MAX_INTEREST = 5;
export const INTEREST_PER_5 = 1;

export function calculateInterest(money: number): number {
  return Math.min(Math.floor(money / 5) * INTEREST_PER_5, MAX_INTEREST);
}

// ─── Blinds (expanded from GBA blind.c - ante_lut[] and _blind_type_map[]) ───

export type BlindKind = "small" | "big" | "boss";

export interface Blind {
  kind: BlindKind;
  name: string;
  target: number;
  reward: number;
  effect?: string; // Boss blind debuff description
}

// Matching GBA ante_lut[] = {100, 300, 800, 2000, 5000, 11000, 20000, 35000, 50000}
export const ANTE_BASE: number[] = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

// Boss blind names from GBA BlindType enum
const BOSS_NAMES: { name: string; effect: string }[] = [
  { name: "The Hook", effect: "Discards 2 random cards per hand played" },
  { name: "The Ox", effect: "Playing a #1 hand sets money to $0" },
  { name: "The House", effect: "First hand is drawn face down" },
  { name: "The Wall", effect: "Extra large blind (x2 target)" },
  { name: "The Wheel", effect: "1 in 7 cards are drawn face down" },
  { name: "The Arm", effect: "Decreases level of played poker hand" },
  { name: "The Club", effect: "All ♣ cards are debuffed" },
  { name: "The Fish", effect: "Cards drawn face down after each hand" },
  { name: "The Psychic", effect: "Must play 5 cards" },
  { name: "The Goad", effect: "All ♠ cards are debuffed" },
  { name: "The Water", effect: "Start with 0 discards" },
  { name: "The Window", effect: "All ♦ cards are debuffed" },
  { name: "The Manacle", effect: "-1 Hand size" },
  { name: "The Eye", effect: "No repeat hand types this round" },
  { name: "The Mouth", effect: "Only play 1 hand type this round" },
  { name: "The Plant", effect: "All face cards are debuffed" },
  { name: "The Serpent", effect: "After Play or Discard, always draw 3 cards" },
  { name: "The Pillar", effect: "Cards played previously are debuffed" },
  { name: "The Needle", effect: "Play only 1 hand" },
  { name: "The Head", effect: "All ♥ cards are debuffed" },
  { name: "The Tooth", effect: "Lose $1 per card played" },
  { name: "The Flint", effect: "Base Chips and Mult are halved" },
  { name: "The Mark", effect: "All face cards are drawn face down" },
];

// Showdown blinds (GBA ante 8+)
const SHOWDOWN_NAMES: { name: string; effect: string }[] = [
  { name: "Amber Acorn", effect: "Flips and shuffles all Jokers" },
  { name: "Verdant Leaf", effect: "All cards debuffed until 1 sold" },
  { name: "Violet Vessel", effect: "Very large blind (x6 target)" },
  { name: "Crimson Heart", effect: "One random Joker disabled per hand" },
  { name: "Cerulean Bell", effect: "Forces 1 card to always be selected" },
];

export function blindForRound(round: number): { ante: number; blind: Blind } {
  const index = round - 1;
  const ante = Math.floor(index / 3) + 1;
  const within = index % 3;
  const base = ANTE_BASE[Math.min(ante - 1, ANTE_BASE.length - 1)];

  if (within === 0) {
    return { ante, blind: { kind: "small", name: "Small Blind", target: base, reward: 3 } };
  }

  if (within === 1) {
    return {
      ante,
      blind: {
        kind: "big",
        name: "Big Blind",
        target: Math.round(base * 1.5),
        reward: 4,
      },
    };
  }

  // Boss blind - pick from pool based on ante
  const isShowdown = ante >= 8;
  const pool = isShowdown ? SHOWDOWN_NAMES : BOSS_NAMES;
  const boss = pool[(ante - 1) % pool.length];

  return {
    ante,
    blind: {
      kind: "boss",
      name: boss.name,
      target: base * 2,
      reward: 5,
      effect: boss.effect,
    },
  };
}

// ─── Hand Level System (GBA tracks levels and bumps per play) ───
export function levelUpHand(
  levels: Partial<Record<HandType, number>>,
  type: HandType
): Partial<Record<HandType, number>> {
  const current = levels[type] ?? 1;
  return { ...levels, [type]: current + 1 };
}

// ─── GBA-style score lerp (NUM_SCORE_LERP_STEPS = 16) ───
export const SCORE_LERP_STEPS = 16;

export function lerpScore(start: number, end: number, step: number): number {
  return Math.round(start + ((end - start) * step) / SCORE_LERP_STEPS);
}

// ─── Card face check (from GBA card_is_face) ───
export function cardIsFace(card: Card): boolean {
  return card.rank === "J" || card.rank === "Q" || card.rank === "K";
}