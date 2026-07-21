import type { CSSProperties } from "react";
import { JokerArt } from "@/components/PixelSprite";
import type { JokerRarity } from "@/lib/game";
import { RARITY_COLOR } from "@/lib/rarity";

interface JokerArtworkFrameProps {
  rarity: JokerRarity;
  className?: string;
}

export function JokerArtworkFrame({ rarity, className }: JokerArtworkFrameProps) {
  return (
    <div
      className={`joker-artwork-frame ${className ?? ""}`}
      data-rarity={rarity}
      style={{ "--joker-rarity-color": RARITY_COLOR[rarity] } as CSSProperties}
    >
      <JokerArt />
    </div>
  );
}
