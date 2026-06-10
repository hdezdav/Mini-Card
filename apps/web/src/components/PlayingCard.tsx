import type { CSSProperties } from "react";
import type { Card, Rank, Suit } from "@/lib/game";
import { SUIT_IS_RED } from "@/lib/game";
import { FaceArt } from "@/components/PixelSprite";

const SUIT_MAPS: Record<Suit, string[]> = {
  diamonds: ["...xx...", "..xxxx..", ".xxxxxx.", "xxxxxxxx", "xxxxxxxx", ".xxxxxx.", "..xxxx..", "...xx..."],
  hearts: [".xx..xx.", "xxxxxxxx", "xxxxxxxx", "xxxxxxxx", ".xxxxxx.", "..xxxx..", "...xx...", "........"],
  spades: ["...xx...", "..xxxx..", ".xxxxxx.", "xxxxxxxx", "xxxxxxxx", ".x.xx.x.", "...xx...", "..xxxx.."],
  clubs: ["...xx...", "..xxxx..", "..xxxx..", "xxxxxxxx", "xxxxxxxx", "xx.xx.xx", "...xx...", "..xxxx.."],
};

function SuitIcon({ suit, className, style }: { suit: Suit; className?: string; style?: CSSProperties }) {
  const color = SUIT_IS_RED[suit] ? "var(--suit-red)" : "var(--suit-black)";
  const rows = SUIT_MAPS[suit];
  const rects: JSX.Element[] = [];

  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      if (rows[y][x] === "x") {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />);
      }
    }
  }

  return (
    <svg className={className} style={style} viewBox="0 0 8 8" shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet">
      {rects}
    </svg>
  );
}

type Pip = [number, number, boolean];
const COL_L = 27;
const COL_C = 50;
const COL_R = 73;

const PIP_LAYOUTS: Partial<Record<Rank, Pip[]>> = {
  "2": [[COL_C, 16, false], [COL_C, 84, true]],
  "3": [[COL_C, 16, false], [COL_C, 50, false], [COL_C, 84, true]],
  "4": [[COL_L, 16, false], [COL_R, 16, false], [COL_L, 84, true], [COL_R, 84, true]],
  "5": [[COL_L, 16, false], [COL_R, 16, false], [COL_C, 50, false], [COL_L, 84, true], [COL_R, 84, true]],
  "6": [[COL_L, 16, false], [COL_R, 16, false], [COL_L, 50, false], [COL_R, 50, false], [COL_L, 84, true], [COL_R, 84, true]],
  "7": [[COL_L, 16, false], [COL_R, 16, false], [COL_C, 33, false], [COL_L, 50, false], [COL_R, 50, false], [COL_L, 84, true], [COL_R, 84, true]],
  "8": [[COL_L, 16, false], [COL_R, 16, false], [COL_C, 33, false], [COL_L, 50, false], [COL_R, 50, false], [COL_C, 67, true], [COL_L, 84, true], [COL_R, 84, true]],
  "9": [[COL_L, 14, false], [COL_R, 14, false], [COL_L, 38, false], [COL_R, 38, false], [COL_C, 50, false], [COL_L, 62, true], [COL_R, 62, true], [COL_L, 86, true], [COL_R, 86, true]],
  "10": [[COL_L, 14, false], [COL_R, 14, false], [COL_C, 26, false], [COL_L, 38, false], [COL_R, 38, false], [COL_L, 62, true], [COL_R, 62, true], [COL_C, 74, true], [COL_L, 86, true], [COL_R, 86, true]],
};

interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  scoring?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

export function PlayingCard({ card, selected, scoring, dimmed, onClick, style, className }: PlayingCardProps) {
  const { rank, suit } = card;
  const isFace = rank === "J" || rank === "Q" || rank === "K";
  const isAce = rank === "A";
  const rankColor = SUIT_IS_RED[suit] ? "var(--suit-red)" : "var(--suit-black)";
  const pips = PIP_LAYOUTS[rank];

  return (
    <button type="button" onClick={onClick} style={style} className={`group relative shrink-0 select-none outline-none ${className ?? ""}`}>
      <div
        className={`relative h-full w-full rounded-[10px] border-[2.5px] transition-transform duration-100 ${dimmed ? "opacity-40" : ""}`}
        style={{
          background: "linear-gradient(160deg, #fbf7ec 0%, var(--card-face) 60%, #e7ddc6 100%)",
          borderColor: scoring ? "#ffd86b" : "var(--card-edge)",
          boxShadow: scoring ? "0 0 0 2px #ffd86b, 0 6px 10px rgba(0,0,0,0.45)" : "inset 0 2px 0 rgba(255,255,255,0.7), 0 5px 8px rgba(0,0,0,0.4)",
        }}
      >
        <div className="absolute left-[5px] top-[1px] flex flex-col items-center leading-none">
          <span className="font-pixel" style={{ color: rankColor, fontSize: rank === "10" ? "1.05rem" : "1.25rem", lineHeight: 0.9, WebkitTextStroke: "0.5px rgba(0,0,0,0.25)" }}>
            {rank}
          </span>
          <SuitIcon suit={suit} className="-mt-[1px] h-[11px] w-[11px]" />
        </div>

        <div className="absolute right-[5px] bottom-[1px] flex flex-col items-center leading-none rotate-180">
          <span className="font-pixel" style={{ color: rankColor, fontSize: rank === "10" ? "1.05rem" : "1.25rem", lineHeight: 0.9, WebkitTextStroke: "0.5px rgba(0,0,0,0.25)" }}>
            {rank}
          </span>
          <SuitIcon suit={suit} className="-mt-[1px] h-[11px] w-[11px]" />
        </div>

        {isFace ? (
          <div className="absolute inset-[18px_14px] flex items-center justify-center">
            <div className="h-full w-full rounded-[4px] border border-black/15 p-[2px]" style={{ background: "rgba(255,255,255,0.35)" }}>
              <FaceArt rank={rank as "J" | "Q" | "K"} />
            </div>
          </div>
        ) : isAce ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <SuitIcon suit={suit} className="h-[46%] w-[46%]" />
          </div>
        ) : (
          <div className="absolute inset-[16%_22%]">
            {pips?.map(([x, y, flip], index) => (
              <SuitIcon
                key={index}
                suit={suit}
                className="absolute h-[20%] w-[20%]"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%,-50%) ${flip ? "rotate(180deg)" : ""}`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}