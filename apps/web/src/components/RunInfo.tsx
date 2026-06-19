"use client";
import { HAND_BASE, HAND_LEVEL_BUMP, type HandType, type OwnedJoker, type DeckType } from "@/lib/game";
import { JokerArt } from "@/components/PixelSprite";

const ALL_HANDS: HandType[] = [
  "High Card","Pair","Two Pair","Three of a Kind",
  "Straight","Flush","Full House","Four of a Kind",
  "Straight Flush","Royal Flush",
];

const RARITY_COLOR: Record<string, string> = {
  common: "#94b4a7",
  uncommon: "#3aa35a",
  rare: "#2b93ff",
  legendary: "#9b59b6",
};

interface RunInfoProps {
  levels: Partial<Record<HandType, number>>;
  jokers: OwnedJoker[];
  money: number;
  round: number;
  ante: number;
  deckType: DeckType;
  onSelectDeck: (type: DeckType) => void;
  onClose: () => void;
}

export function RunInfo({
  levels,
  jokers,
  money,
  round,
  ante,
  deckType,
  onSelectDeck,
  onClose,
}: RunInfoProps) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="font-pixel-fat text-2xl text-[#f7931a] txt-outline text-center mb-3">RUN INFO</div>

      <div className="flex gap-2 mb-3 text-center">
        <div className="panel flex-1 rounded-lg p-2">
          <div className="font-pixel text-[10px] text-gray-400">Round</div>
          <div className="font-pixel-fat text-lg text-[#f5a623]">{round}</div>
        </div>
        <div className="panel flex-1 rounded-lg p-2">
          <div className="font-pixel text-[10px] text-gray-400">Ante</div>
          <div className="font-pixel-fat text-lg text-[#f7931a]">{ante}/8</div>
        </div>
        <div className="panel flex-1 rounded-lg p-2">
          <div className="font-pixel text-[10px] text-gray-400">Money</div>
          <div className="font-pixel-fat text-lg text-[#facc15]">${money}</div>
        </div>
      </div>

      <div className="font-pixel text-xs text-gray-400 mb-1">— Deck Theme —</div>
      <div className="panel rounded-lg p-2 flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-pixel-fat text-[11px] text-white capitalize">{deckType} Deck</span>
          <span className="font-pixel text-[9px] text-gray-400">Select deck back style</span>
        </div>
        <div className="flex gap-1.5">
          {(["red", "blue", "yellow", "green", "black"] as DeckType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelectDeck(type)}
              className={`w-7 h-10 rounded border-2 overflow-hidden transition-all duration-100 ${
                deckType === type
                  ? "border-[#facc15] scale-110 shadow-[0_0_8px_#facc15]"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={`/assets/cards/back-${type}.png`}
                alt={type}
                className="w-full h-full object-cover pixelated"
                style={{ imageRendering: "pixelated" }}
              />
            </button>
          ))}
        </div>
      </div>

      {jokers.length > 0 && (
        <>
          <div className="font-pixel text-xs text-gray-400 mb-1">— Active Jokers —</div>
          <div className="flex flex-col gap-1.5 mb-3">
            {jokers.map((oj, i) => (
              <div key={i} className="panel rounded-lg p-2 flex items-center gap-2">
                <div className={`w-8 h-10 shrink-0 rounded overflow-hidden bg-[#1a1d20] flex items-center justify-center relative ${
                  oj.def.rarity === "uncommon" ? "joker-shiny border border-white/10" :
                  oj.def.rarity === "rare" ? "joker-rare-metallic" :
                  oj.def.rarity === "legendary" ? "joker-legendary-iridescent" : "border border-white/10"
                }`}>
                  <JokerArt />
                </div>
                <div>
                  <div className="font-pixel-fat text-xs text-white">{oj.def.name}</div>
                  <div style={{ color: RARITY_COLOR[oj.def.rarity] }} className="font-pixel text-[9px] capitalize">{oj.def.rarity}</div>
                  <div className="font-pixel text-[9px] text-gray-300">{oj.def.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="font-pixel text-xs text-gray-400 mb-1">— Hand Levels —</div>
      <div className="flex flex-col gap-1 mb-4">
        {ALL_HANDS.map(type => {
          const lvl = levels[type] ?? 1;
          const base = HAND_BASE[type];
          const bump = HAND_LEVEL_BUMP[type];
          const chips = base.chips + bump.chips * (lvl - 1);
          const mult = base.mult + bump.mult * (lvl - 1);
          return (
            <div key={type} className="flex items-center gap-1.5 bg-[#1a1d20] rounded px-2 py-1">
              <div className="font-pixel text-[10px] text-white flex-1">{type}</div>
              <div className="font-pixel text-[9px] text-[#6fa8c8]">lvl.{lvl}</div>
              <div className="font-pixel-fat text-[10px] text-[#2b93ff] w-8 text-right">{chips}</div>
              <div className="font-pixel text-[9px] text-gray-400">x</div>
              <div className="font-pixel-fat text-[10px] text-[#f04f4c] w-5 text-right">{mult}</div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={onClose} className="btn-chunky btn-blue w-full py-2 text-base mt-auto">
        Close
      </button>
    </div>
  );
}
