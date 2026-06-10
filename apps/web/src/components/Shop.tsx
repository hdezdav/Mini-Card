"use client";
import { JOKER_DEFS, jokerBaseCost, type OwnedJoker, type JokerDef } from "@/lib/game";
import { JokerArt } from "@/components/PixelSprite";
import { useState } from "react";

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

interface ShopProps {
  money: number;
  ownedJokers: OwnedJoker[];
  onBuy: (def: JokerDef) => void;
  onSell: (idx: number) => void;
  onClose: () => void;
}

export function Shop({ money, ownedJokers, onBuy, onSell, onClose }: ShopProps) {
  const ownedIds = new Set(ownedJokers.map(j => j.def.id));
  const [offers] = useState<JokerDef[]>(() =>
    shuffle(JOKER_DEFS.filter(j => !ownedIds.has(j.id))).slice(0, 3)
  );

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="font-pixel-fat text-2xl text-[#facc15] txt-outline text-center mb-2">SHOP</div>
      <div className="font-pixel text-sm text-[#facc15] text-center mb-3">💰 ${money}</div>

      <div className="font-pixel text-xs text-gray-400 mb-1">— For Sale —</div>
      <div className="flex flex-col gap-2 mb-4">
        {offers.map(def => {
          const cost = jokerBaseCost(def);
          const canAfford = money >= cost;
          const alreadyOwned = ownedIds.has(def.id);
          return (
            <div key={def.id} className="panel rounded-lg p-2 flex items-center gap-2">
              <div className="w-9 h-12 shrink-0 rounded-md overflow-hidden border border-white/20 bg-[#1a1d20] flex items-center justify-center">
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
                <div className="w-8 h-10 rounded overflow-hidden bg-[#1a1d20] flex items-center justify-center">
                  <JokerArt />
                </div>
                <div className="font-pixel text-[8px] text-gray-300 leading-none">{oj.def.name}</div>
                <div className="font-pixel text-[9px] text-[#facc15]">${Math.floor(jokerBaseCost(oj.def) / 2)}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" onClick={onClose} className="btn-chunky btn-blue w-full py-2 text-base mt-auto">
        Next Blind →
      </button>
    </div>
  );
}
