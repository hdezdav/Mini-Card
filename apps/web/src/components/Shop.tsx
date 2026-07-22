"use client";
import { jokerBaseCost, jokerConflictsWith, rollShopJokersWeighted, JOKER_DEFS, type OwnedJoker, type JokerDef, type JokerRarity } from "@/lib/game";
import { RARITY_COLOR } from "@/lib/rarity";
import { JokerArtworkFrame } from "@/components/JokerArtworkFrame";
import { GbaBackground } from "./GbaBackground";
import { useState, useCallback } from "react";
import { approveBoosterPack, buyBoosterPack, handlePaymentFailure } from "@/lib/web3";
import { dict, fmt, jokerName, jokerDesc, rarityName, type Lang } from "@/lib/i18n";

function getOffers(owned: OwnedJoker[], ante: number): JokerDef[] {
  return rollShopJokersWeighted(owned, 3, ante);
}

// Three booster packs with different themes — same price, same odds,
// just different visual flavors so the player feels they're choosing.
// Synthwave retune: Crimson→magenta, Azure→cyan, Verdant→purple.
const PACK_THEMES = [
  { id: 0, name: "Crimson", color: "#ff2e88", glow: "rgba(255,46,136,0.4)" },
  { id: 1, name: "Azure",   color: "#00f0ff", glow: "rgba(0,240,255,0.4)" },
  { id: 2, name: "Verdant", color: "#b026ff", glow: "rgba(176,38,255,0.4)" },
] as const;

interface ShopProps {
  money: number;
  ownedJokers: OwnedJoker[];
  ante: number;
  onBuy: (def: JokerDef) => void;
  onSell: (idx: number) => void;
  onClose: () => void;
  onBoosterJoker: (jokerId: number) => void;
  lang: Lang;
}

type PackState = "idle" | "approving" | "buying" | "success" | "error";

export function Shop({ money, ownedJokers, ante, onBuy, onSell, onClose, onBoosterJoker, lang }: ShopProps) {
  const ownedIds = new Set(ownedJokers.map((j) => j.def.id));
  const [offers] = useState<JokerDef[]>(() => getOffers(ownedJokers, ante));
  const [packState, setPackState] = useState<PackState>("idle");
  const [activePack, setActivePack] = useState<number | null>(null);
  const [packResult, setPackResult] = useState<{ name: string; rarity: JokerRarity; duplicate: boolean } | null>(null);
  const [packError, setPackError] = useState("");

  const isBusy = packState === "approving" || packState === "buying";

  const handleBuyPack = useCallback(async (packThemeId: number) => {
    if (isBusy) return;

    setPackError("");
    setPackResult(null);
    setActivePack(packThemeId);

    try {
      // Step 1: Approve USDT for the BoosterPack contract
      setPackState("approving");
      const approved = await approveBoosterPack();
      if (!approved) {
        setPackState("error");
        setPackError(dict.approvalRejected[lang]);
        setTimeout(() => setPackState("idle"), 3000);
        return;
      }

      // Step 2: Buy pack (single transaction — derives joker on-chain from
      // blockhash(block.number - 1) and returns the result from the receipt)
      setPackState("buying");
      const result = await buyBoosterPack();

      if (result.status === "reverted") {
        // Tx reverted — no funds moved, no pack opened. Safe to retry.
        setPackState("error");
        setPackError(dict.couldNotOpen[lang]);
        setTimeout(() => setPackState("idle"), 3000);
        return;
      }

      if (result.status === "unreadable") {
        // Tx SUCCEEDED — the user paid and a pack was opened on-chain, but the
        // result could not be read back. Do NOT retry (would charge twice).
        setPackState("error");
        setPackError(dict.packOpenedUnreadable[lang]);
        setTimeout(() => setPackState("idle"), 6000);
        return;
      }

      const jokerId = result.jokerId;

      // Find the joker def
      const def = JOKER_DEFS.find((j) => j.id === jokerId);
      if (!def) {
        setPackState("error");
        setPackError(fmt(dict.unknownJokerId[lang], { id: jokerId }));
        setTimeout(() => setPackState("idle"), 3000);
        return;
      }

      // Check if duplicate
      const isDuplicate = ownedIds.has(jokerId);
      setPackResult({ name: jokerName(def, lang), rarity: def.rarity, duplicate: isDuplicate });

      // Notify parent — if duplicate, parent gives sell value as money instead
      onBoosterJoker(jokerId);

      setPackState("success");
      setTimeout(() => {
        setPackState("idle");
        setPackResult(null);
        setActivePack(null);
      }, 4000);
    } catch (err) {
      // Insufficient balance → redirect to MiniPay Deposit deeplink
      if (handlePaymentFailure(err)) return;
      console.error("Booster pack error:", err);
      setPackState("error");
      setPackError(dict.paymentFailed[lang]);
      setTimeout(() => setPackState("idle"), 3000);
    }
  }, [isBusy, ownedIds, onBoosterJoker, lang]);

  const packStatusLabel = () => {
    switch (packState) {
      case "approving": return dict.approving[lang];
      case "buying": return dict.opening[lang];
      case "success": return dict.opened[lang];
      case "error": return dict.failed[lang];
      default: return "";
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-[3px] overflow-hidden">
      <GbaBackground blindKind="shop" />
      {/* Dark scrim on top of the background so text stays readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50 pointer-events-none z-0" />
      <div className="flex-1 flex flex-col p-3 overflow-y-auto relative z-10" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <div className="font-pixel-fat text-2xl txt-chrome text-center mb-2">{dict.shopTitle[lang]}</div>
        <div className="font-pixel text-sm text-[#ff9e2c] text-center mb-3">💰 ${money}</div>

      {/* For Sale header */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-pixel text-xs text-gray-400">{dict.forSale[lang]}</span>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {offers.map((def) => {
          const cost = jokerBaseCost(def);
          const canAfford = money >= cost;
          const alreadyOwned = ownedIds.has(def.id);
          const conflict = jokerConflictsWith(def, ownedJokers);
          const blocked = !!conflict;
          return (
            <div key={def.id} className="panel rounded-lg p-2 flex items-center gap-2">
              <div className="w-9 h-12 shrink-0 rounded-md overflow-hidden flex items-center justify-center relative p-0.5">
                <JokerArtworkFrame rarity={def.rarity} className="h-full w-full" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-pixel-fat text-sm text-white leading-none">{jokerName(def, lang)}</div>
                <div style={{ color: RARITY_COLOR[def.rarity] }} className="font-pixel text-[10px] leading-none mt-0.5 capitalize">{rarityName(def.rarity, lang)}</div>
                <div className="font-pixel text-[10px] text-gray-300 leading-tight mt-1">{jokerDesc(def, lang)}</div>
                {conflict && (
                  <div className="font-pixel text-[9px] text-[#ff2e88] leading-tight mt-1">
                    {fmt(dict.conflictsWith[lang], { name: jokerName(conflict.def, lang) })}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!canAfford || alreadyOwned || blocked}
                onClick={() => onBuy(def)}
                className="btn-chunky btn-green shrink-0 px-2 py-1 text-xs"
              >
                {alreadyOwned ? "✓" : blocked ? "✕" : `$${cost}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Booster Packs — 3 TCG-style 3D packs, now BELOW the For Sale jokers.
          Wrapped in a translucent purple panel so the info text stays readable
          against the animated background. */}
      <div className="mb-2 mt-1.5 rounded-xl border border-[#b026ff]/30 bg-[#1a0d3a]/70 backdrop-blur-sm p-2">
        <div className="font-pixel text-xs text-[#c9b8ff] mb-1.5 text-center">{dict.boosterPacks[lang]}</div>
        <div className="flex justify-center gap-4 items-center pt-1 pb-4 px-2">

          {PACK_THEMES.map((pack) => {
            const isActive = activePack === pack.id;
            const showSpinner = isActive && isBusy;
            const showSuccess = isActive && packState === "success";
            const showError = isActive && packState === "error";

            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => handleBuyPack(pack.id)}
                disabled={isBusy}
                onPointerMove={(e) => {
                  // Parallax tilt toward the cursor (mouse only — on touch the
                  // static 3D pose + press-flatten carry the feedback).
                  if (e.pointerType !== "mouse") return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const px = (e.clientX - r.left) / r.width - 0.5;
                  const py = (e.clientY - r.top) / r.height - 0.5;
                  e.currentTarget.style.setProperty("--ry", `${(px * 22).toFixed(1)}deg`);
                  e.currentTarget.style.setProperty("--rx", `${(-py * 16).toFixed(1)}deg`);
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.removeProperty("--ry");
                  e.currentTarget.style.removeProperty("--rx");
                }}
                className="booster-pack-3d relative flex flex-col items-center gap-1 group disabled:opacity-50"
                style={{
                  animation: isBusy && !isActive ? "none" : "float 3s ease-in-out infinite",
                  animationDelay: `${pack.id * 0.4}s`,
                }}
              >
                {/* Pack body — a real 6-face 3D box. Tilt is driven by --rx/--ry
                    (pointer parallax, mouse only); press flattens on tap. */}
                <div className="pack-body">
                  {/* Rear panel + four foil edges = the pack's real thickness */}
                  <div className="pack-back" />
                  <div className="pack-edge pack-edge--left" />
                  <div className="pack-edge pack-edge--right" />
                  <div className="pack-edge pack-edge--top" />
                  <div className="pack-edge pack-edge--bottom" />

                  {/* Tear-strip tab on top */}
                  <div className="pack-tear" style={{ background: `linear-gradient(180deg, ${pack.color}, ${pack.color}40)` }} />

                  {/* Pack face (front) — artwork, foil sweep, gloss, content */}
                  <div
                    className="pack-face flex flex-col items-center justify-center"
                    style={{
                      borderColor: pack.color,
                      background: `linear-gradient(160deg, ${pack.color}30 0%, ${pack.color}10 55%, #0a0420 100%)`,
                      boxShadow: showSuccess
                        ? `0 0 18px ${pack.glow}, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -8px 14px rgba(0,0,0,0.55), inset 2px 0 0 rgba(255,255,255,0.06), inset -2px 0 0 rgba(0,0,0,0.25), 0 12px 20px rgba(0,0,0,0.55)`
                        : `inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -8px 14px rgba(0,0,0,0.55), inset 2px 0 0 rgba(255,255,255,0.06), inset -2px 0 0 rgba(0,0,0,0.25), 0 12px 20px rgba(0,0,0,0.55), 0 0 10px ${pack.glow}`,
                    }}
                  >
                    {/* Diagonal static shine */}
                    <div className="pack-shine" />

                    {/* Moving foil sweep */}
                    <div className="pack-foil" />

                    {/* Center content */}
                    {showSpinner ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin z-10" />
                    ) : showSuccess ? (
                      <span className="text-xl z-10" style={{ animation: "pop 0.3s ease-out", filter: `drop-shadow(0 0 6px ${pack.glow})` }}>✨</span>
                    ) : showError ? (
                      <span className="text-xl z-10">❌</span>
                    ) : (
                      <span
                        className="text-xl z-10"
                        style={{ filter: `drop-shadow(0 0 4px ${pack.glow})` }}
                      >
                        📦
                      </span>
                    )}

                    {/* Pack name embossed on the face */}
                    <span
                      className="font-pixel text-[7.5px] mt-0.5 z-10 leading-none uppercase tracking-wider"
                      style={{ color: pack.color, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                    >
                      {pack.name}
                    </span>
                  </div>

                  {/* Ground shadow */}
                  <div className="pack-shadow" />
                </div>

                {/* Price tag below */}
                <span className="font-pixel text-[9px] text-[#ff9e2c] leading-none mt-1">$0.02</span>
              </button>
            );
          })}
        </div>

        {/* Status label for active pack */}
        {activePack !== null && (isBusy || packState === "success" || packState === "error") && (
          <div className="font-pixel text-[10px] text-center mt-2 leading-tight"
            style={{ color: packState === "error" ? "#ff2e88" : packState === "success" ? "#00f0ff" : "#ff9e2c" }}>
            {packStatusLabel()}
          </div>
        )}

        {/* Pack result display */}
        {packResult && (
          <div className={`mt-2 rounded-md p-2 flex items-center gap-2 anim-pop mx-auto max-w-[260px] ${
            packResult.duplicate ? "bg-[#2a0d5a] border border-[#ff9e2c]/30" : "bg-[#0a2a24] border border-[#00f0ff]/40"
          }`}>
            <div className="w-8 h-10 rounded overflow-hidden flex items-center justify-center shrink-0 p-0.5">
              <JokerArtworkFrame rarity={packResult.rarity} className="h-full w-full" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-pixel-fat text-sm text-white leading-none">{packResult.name}</div>
              <div style={{ color: RARITY_COLOR[packResult.rarity] }} className="font-pixel text-[10px] leading-none mt-0.5 capitalize">
                {rarityName(packResult.rarity, lang)}
              </div>
              <div className="font-pixel text-[9px] text-gray-400 mt-0.5">
                {packResult.duplicate ? dict.duplicateRefund[lang] : dict.newJokerAdded[lang]}
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {packError && (
          <div className="font-pixel text-[10px] text-[#ff2e88] text-center mt-1 leading-tight">
            {packError}
          </div>
        )}

        {/* Odds — transparent, no crypto jargon */}
        <div className="font-pixel text-[8px] text-white/55 leading-tight flex gap-3 flex-wrap justify-center mt-2">
          <span>{dict.commonPct[lang]}</span>
          <span>{dict.uncommonPct[lang]}</span>
          <span>{dict.rarePct[lang]}</span>
          <span>{dict.legendaryPct[lang]}</span>
        </div>
      </div>

      {ownedJokers.length > 0 && (
        <>
          <div className="font-pixel text-xs text-gray-400 mb-1">{dict.yourJokersSell[lang]}</div>
          <div className="flex gap-2 flex-wrap mb-4">
            {ownedJokers.map((oj, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSell(idx)}
                className="panel tap-target rounded-lg p-1.5 flex flex-col items-center gap-1 w-[60px] text-center hover:brightness-110 active:scale-95 transition-transform"
                title={fmt(dict.sellFor[lang], { amount: Math.floor(jokerBaseCost(oj.def) / 2) })}
              >
                <div className="w-8 h-10 rounded overflow-hidden flex items-center justify-center relative p-0.5">
                  <JokerArtworkFrame rarity={oj.def.rarity} className="h-full w-full" />
                </div>
                <div className="font-pixel text-[8px] text-gray-300 leading-none">{jokerName(oj.def, lang)}</div>
                <div className="font-pixel text-[9px] text-[#ff9e2c]">${Math.floor(jokerBaseCost(oj.def) / 2)}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Info note — no crypto/blockchain/on-chain jargon per MiniPay rules */}
      <div className="font-pixel text-[9px] text-white/60 text-center mb-2 leading-tight px-2">
        {dict.packInfo[lang]}
      </div>

      </div>

      {/* Sticky bottom panel for Next Blind action */}
      <div className="relative z-20 px-3 pb-3 pt-1.5 border-t border-[#b026ff]/35 bg-[#120630] flex shrink-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <button type="button" onClick={onClose} className="btn-chunky btn-blue w-full py-2 text-base">
          {dict.nextBlind[lang]}
        </button>
      </div>
    </div>
  );
}
