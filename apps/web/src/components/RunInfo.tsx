"use client";
import { HAND_BASE, HAND_LEVEL_BUMP, type HandType, type OwnedJoker, type DeckType } from "@/lib/game";
import { RARITY_COLOR } from "@/lib/rarity";
import { JokerArtworkFrame } from "@/components/JokerArtworkFrame";
import { dict, fmt, handName, jokerName, jokerDesc, rarityName, type Lang } from "@/lib/i18n";

const ALL_HANDS: HandType[] = [
  "High Card","Pair","Two Pair","Three of a Kind",
  "Straight","Flush","Full House","Four of a Kind",
  "Straight Flush","Royal Flush",
];

interface RunInfoProps {
  levels: Partial<Record<HandType, number>>;
  jokers: OwnedJoker[];
  money: number;
  round: number;
  ante: number;
  deckType: DeckType;
  onSelectDeck: (type: DeckType) => void;
  onClose: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
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
  lang,
  setLang,
}: RunInfoProps) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm p-3 overflow-y-auto" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
      <div className="font-pixel-fat text-2xl txt-chrome text-center mb-3">{dict.runInfoTitle[lang]}</div>

      <div className="flex gap-2 mb-3 text-center">
        <div className="panel flex-1 rounded-lg p-2">
          <div className="font-pixel text-[10px] text-gray-400">{dict.round[lang]}</div>
          <div className="font-pixel-fat text-lg text-[#ff9e2c]">{round}</div>
        </div>
        <div className="panel flex-1 rounded-lg p-2">
          <div className="font-pixel text-[10px] text-gray-400">{dict.ante[lang]}</div>
          <div className="font-pixel-fat text-lg text-[#ff9e2c]">{ante}/8</div>
        </div>
        <div className="panel flex-1 rounded-lg p-2">
          <div className="font-pixel text-[10px] text-gray-400">{dict.money[lang]}</div>
          <div className="font-pixel-fat text-lg text-[#ff9e2c]">${money}</div>
        </div>
      </div>

      <div className="font-pixel text-xs text-gray-400 mb-1">{dict.deckTheme[lang]}</div>
      <div className="panel rounded-lg p-2 flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-pixel-fat text-[11px] text-white capitalize">{fmt(dict.deckDeck[lang], { type: deckType })}</span>
          <span className="font-pixel text-[9px] text-gray-400">{dict.selectDeckBack[lang]}</span>
        </div>
        <div className="flex gap-2">
          {(["red", "blue", "yellow", "green", "black"] as DeckType[]).map((type) => (
            <div key={type} className="tap-target" onClick={() => onSelectDeck(type)}>
              <button
                type="button"
                aria-label={fmt(dict.deckDeck[lang], { type })}
                className={`w-7 h-10 rounded border-2 overflow-hidden transition-all duration-100 ${
                  deckType === type
                    ? "border-[#ff9e2c] scale-110 shadow-[0_0_8px_#ff9e2c]"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img
                  src={`/assets/cards/back-${type}.webp`}
                  alt={fmt(dict.deckDeck[lang], { type })}
                  className="w-full h-full object-cover pixelated"
                  style={{
                    imageRendering: "pixelated",
                    // Synthwave tint: shift the warm red/green backs toward the
                    // magenta/cyan palette. Neutral backs (blue/yellow/black) keep hue.
                    filter: type === "red"
                      ? "hue-rotate(285deg) saturate(1.4)"
                      : type === "green"
                      ? "hue-rotate(170deg) saturate(1.3)"
                      : undefined,
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="font-pixel text-xs text-gray-400 mb-1">{dict.language[lang]}</div>
      <div className="panel rounded-lg p-2 flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-pixel-fat text-[11px] text-white">
            {lang === "es" ? "Español" : "English"}
          </span>
          <span className="font-pixel text-[9px] text-gray-400">
            {lang === "es" ? "Idioma del juego" : "Game language"}
          </span>
        </div>
        <div className="flex gap-1.5" role="group" aria-label={dict.language[lang]}>
          <button
            type="button"
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
            className={`tap-target px-3 py-1 rounded font-pixel-fat text-xs border transition-all ${
              lang === "en"
                ? "bg-[#00f0ff] text-[#04243a] border-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.5)]"
                : "bg-[#0a0420] text-gray-400 border-gray-700 hover:border-gray-500"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("es")}
            aria-pressed={lang === "es"}
            className={`tap-target px-3 py-1 rounded font-pixel-fat text-xs border transition-all ${
              lang === "es"
                ? "bg-[#ff9e2c] text-white border-[#ff9e2c] shadow-[0_0_8px_rgba(255,158,44,0.5)]"
                : "bg-[#0a0420] text-gray-400 border-gray-700 hover:border-gray-500"
            }`}
          >
            ES
          </button>
        </div>
      </div>

      {jokers.length > 0 && (
        <>
          <div className="font-pixel text-xs text-gray-400 mb-1">{dict.activeJokers[lang]}</div>
          <div className="flex flex-col gap-1.5 mb-3">
            {jokers.map((oj, i) => (
              <div key={i} className="panel rounded-lg p-2 flex items-center gap-2">
                <div className="w-8 h-10 shrink-0 rounded overflow-hidden flex items-center justify-center relative p-0.5">
                  <JokerArtworkFrame rarity={oj.def.rarity} className="h-full w-full" />
                </div>
                <div>
                  <div className="font-pixel-fat text-xs text-white">{jokerName(oj.def, lang)}</div>
                  <div style={{ color: RARITY_COLOR[oj.def.rarity] }} className="font-pixel text-[9px] capitalize">{rarityName(oj.def.rarity, lang)}</div>
                  <div className="font-pixel text-[9px] text-gray-300">{jokerDesc(oj.def, lang)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="font-pixel text-xs text-gray-400 mb-1">{dict.handLevels[lang]}</div>
      <div className="flex flex-col gap-1 mb-4">
        {ALL_HANDS.map(type => {
          const lvl = levels[type] ?? 1;
          const base = HAND_BASE[type];
          const bump = HAND_LEVEL_BUMP[type];
          const chips = base.chips + bump.chips * (lvl - 1);
          const mult = base.mult + bump.mult * (lvl - 1);
          return (
            <div key={type} className="flex items-center gap-1.5 bg-[#0a0420] rounded px-2 py-1">
              <div className="font-pixel text-[10px] text-white flex-1">{handName(type, lang)}</div>
              <div className="font-pixel text-[9px] text-[#ff9e2c]">{dict.lvl[lang]}{lvl}</div>
              <div className="font-pixel-fat text-[10px] text-[#00f0ff] w-8 text-right">{chips}</div>
              <div className="font-pixel text-[9px] text-gray-400">x</div>
              <div className="font-pixel-fat text-[10px] text-[#ff2e88] w-5 text-right">{mult}</div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={onClose} className="btn-chunky btn-blue w-full py-2 text-base mt-auto">
        {dict.close[lang]}
      </button>
    </div>
  );
}
