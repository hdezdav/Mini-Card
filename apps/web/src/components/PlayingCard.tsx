import type { CSSProperties } from "react";
import type { Card, Rank, Suit, DeckType } from "@/lib/game";

interface PlayingCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  card: Card;
  selected?: boolean;
  scoring?: boolean;
  dimmed?: boolean;
  facedown?: boolean;
  deckType?: DeckType;
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
    ? `/assets/cards/back-${backColor}.png`
    : `/assets/cards/${rank}-${suitChar}.png`;

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
            ? "0 0 0 2.5px #ffd86b, 0 6px 12px rgba(0,0,0,0.5)"
            : "0 4px 6px rgba(0,0,0,0.35)",
          background: "#2d241e",
        }}
      >
        <img
          src={imgSrc}
          alt={facedown ? "Card Back" : `${rank} of ${suit}`}
          className="h-full w-full object-cover pixelated"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    </button>
  );
}