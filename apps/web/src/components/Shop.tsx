"use client";
import { JOKER_DEFS, jokerBaseCost, type OwnedJoker, type JokerDef } from "@/lib/game";
import { JokerArt } from "@/components/PixelSprite";
import { useState, useCallback } from "react";
import { payRerollWithMiniPay } from "@/lib/web3";

const RARITY_COLOR: Record<string, string> = {
  common: "#94b4a7",
  uncommon: "#3aa35a",
  rare: "#2b93ff",
  legendary: "#9b59b6",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getOffers(excludeIds: Set<number>): JokerDef[] {
  return shuffle(JOKER_DEFS.filter((j) => !excludeIds.has(j.id))).slice(0, 3);
}

interface ShopProps {
  money: number;
  ownedJokers: OwnedJoker[];
  onBuy: (def: JokerDef) => void;
  onSell: (idx: number) => void;
  onClose: () => void;
}

type RerollState = "idle" | "pending" | "error" | "success";

export function Shop({ money, ownedJokers, onBuy, onSell, onClose }: ShopProps) {
  const ownedIds = new Set(ownedJokers.map((j) => j.def.id));
  const [offers, setOffers] = useState<JokerDef[]>(() => getOffers(ownedIds));
  const [rerollState, setRerollState] = useState<RerollState>("idle");
  const [rerollCount, setRerollCount] = useState(0);

  const handleReroll = useCallback(async () => {
    if (rerollState === "pending") return;
    setRerollState("pending");

    const paid = await payRerollWithMiniPay();

    if (!paid) {
      setRerollState("error");
      setTimeout(() => setRerollState("idle"), 2200);
      return;
    }

    // Refresh offers (exclude already-owned jokers)
    const freshOwned = new Set(ownedJokers.map((j) => j.def.id));
    setOffers(getOffers(freshOwned));
    setRerollCount((n) => n + 1);
    setRerollState("success");
    setTimeout(() => setRerollState("idle"), 1200);
  }, [rerollState, ownedJokers]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="font-pixel-fat text-2xl text-[#facc15] txt-outline text-center mb-2">SHOP</div>
      <div className="font-pixel text-sm text-[#facc15] text-center mb-3">💰 ${money}</div>

      {/* For Sale header + Reroll button */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-pixel text-xs text-gray-400">— For Sale —</span>

        <button
          type="button"
          onClick={handleReroll}
          disabled={rerollState === "pending"}
          className={`
            btn-chunky px-2.5 py-1 text-[11px] leading-none flex items-center gap-1.5 shrink-0
            ${rerollState === "error" ? "btn-red" : rerollState === "success" ? "btn-green" : "btn-orange"}
          `}
          title="Pay $0.01 USDT to reroll shop offers"
        >
          {rerollState === "pending" ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Paying…</span>
            </>
          ) : rerollState === "error" ? (
            <>❌ Rejected</>
          ) : rerollState === "success" ? (
            <>✓ Rerolled!</>
          ) : (
            <>
              <span>🎲 Reroll</span>
              <span className="bg-black/25 rounded px-1 py-[1px] font-pixel text-[9px] text-[#facc15]">$0.01</span>
            </>
          )}
        </button>
      </div>

      {/* Reroll count badge */}
      {rerollCount > 0 && (
        <div className="font-pixel text-[9px] text-white/30 text-right mb-1 -mt-0.5">
          rerolled ×{rerollCount}
        </div>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {offers.map((def) => {
          const cost = jokerBaseCost(def);
          const canAfford = money >= cost;
          const alreadyOwned = ownedIds.has(def.id);
          return (
            <div key={def.id} className="panel rounded-lg p-2 flex items-center gap-2">
              <div className={`w-9 h-12 shrink-0 rounded-md overflow-hidden border bg-[#1a1d20] flex items-center justify-center relative ${
                def.rarity === "uncommon" ? "joker-shiny border-white/20" :
                def.rarity === "rare" ? "joker-rare-metallic" :
                def.rarity === "legendary" ? "joker-legendary-iridescent" : "border-white/20"
              }`}>
                <JokerArt />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-pixel-fat text-sm text-white leading-none">{def.name}</div>
                <div style={{ color: RARITY_COLOR[def.rarity] }} className="font-pixel text-[10px] leading-none mt-0.5 capitalize">{def.rarity}</div>
                <div className="font-pixel text-[10px] text-gray-300 leading-tight mt-1">{def.desc}</div>
              </div>
              <button
                type="button"
                disabled={!canAfford || alreadyOwned}
                onClick={() => onBuy(def)}
                className="btn-chunky btn-green shrink-0 px-2 py-1 text-xs"
              >
                {alreadyOwned ? "✓" : `$${cost}`}
              </button>
            </div>
          );
        })}
      </div>

      {ownedJokers.length > 0 && (
        <>
          <div className="font-pixel text-xs text-gray-400 mb-1">— Your Jokers (click to sell) —</div>
          <div className="flex gap-2 flex-wrap mb-4">
            {ownedJokers.map((oj, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSell(idx)}
                className="panel rounded-lg p-1.5 flex flex-col items-center gap-1 w-[60px] text-center hover:brightness-110 active:scale-95 transition-transform"
                title={`Sell for $${Math.floor(jokerBaseCost(oj.def) / 2)}`}
              >
                <div className={`w-8 h-10 rounded overflow-hidden bg-[#1a1d20] flex items-center justify-center relative ${
                  oj.def.rarity === "uncommon" ? "joker-shiny border border-white/10" :
                  oj.def.rarity === "rare" ? "joker-rare-metallic" :
                  oj.def.rarity === "legendary" ? "joker-legendary-iridescent" : "border border-white/10"
                }`}>
                  <JokerArt />
                </div>
                <div className="font-pixel text-[8px] text-gray-300 leading-none">{oj.def.name}</div>
                <div className="font-pixel text-[9px] text-[#facc15]">${Math.floor(jokerBaseCost(oj.def) / 2)}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Info note about the $0.01 fee */}
      <div className="font-pixel text-[9px] text-white/25 text-center mb-2 leading-tight px-2">
        🎲 Reroll costs $0.01 USDT via MiniPay
        {typeof window !== "undefined" && !(window as any).ethereum && " (free in guest mode)"}
      </div>

      <button type="button" onClick={onClose} className="btn-chunky btn-blue w-full py-2 text-base mt-auto">
        Next Blind →
      </button>
    </div>
  );
}
