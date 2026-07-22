import type { CSSProperties } from "react";
import type { Card, Rank, Suit, DeckType } from "@/lib/game";
import { dict, fmt, suitName, type Lang } from "@/lib/i18n";

interface PlayingCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  card: Card;
  selected?: boolean;
  scoring?: boolean;
  dimmed?: boolean;
  facedown?: boolean;
  deckType?: DeckType;
  lang?: Lang;
}

export function PlayingCard({
  card,
  selected,
  scoring,
  dimmed,
  onClick,
  style,
  className,
  facedown = false,
  deckType = "red",
  lang = "es",
  ...rest
}: PlayingCardProps) {
  const { rank, suit } = card;

  // Map suit to the char in the filenames (S, H, D, C)
  const suitChar =
    suit === "spades"
      ? "S"
      : suit === "hearts"
      ? "H"
      : suit === "diamonds"
      ? "D"
      : "C";

  // Map deckType to back color file
  // Default to red back if it's painted or unrecognized
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

  const imgSrc = facedown
    ? `/assets/cards/back-${backColor}.webp`
    : `/assets/cards/${rank}-${suitChar}.webp`;

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`group relative shrink-0 select-none outline-none ${className ?? ""}`}
      {...rest}
    >
      <div
        className={`relative h-full w-full overflow-hidden rounded-[8px] transition-transform duration-100 ${
          dimmed ? "opacity-40" : ""
        }`}
        style={{
          boxShadow: scoring
            ? "0 0 0 2.5px #00f0ff, 0 0 14px rgba(0,240,255,0.6), 0 6px 12px rgba(0,0,0,0.5)"
            : "0 4px 6px rgba(0,0,0,0.45), 0 0 8px rgba(176,38,255,0.12)",
          background: "#0a0420",
        }}
      >
        <img
          src={imgSrc}
          alt={facedown ? dict.cardBack[lang] : fmt(dict.cardOf[lang], { rank, suit: suitName(suit, lang) })}
          className="h-full w-full object-cover pixelated"
          style={{
            imageRendering: "pixelated",
            // Synthwave tint on warm deck backs (red→magenta, green→cyan).
            // Neutral backs (blue/yellow/black) keep their hue.
            filter: facedown && backColor === "red"
              ? "hue-rotate(285deg) saturate(1.4)"
              : facedown && backColor === "green"
              ? "hue-rotate(170deg) saturate(1.3)"
              : undefined,
          }}
        />
      </div>
    </button>
  );
}