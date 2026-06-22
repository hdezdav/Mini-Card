import type { ReactElement } from "react";

interface PixelSpriteProps {
  rows: string[];
  palette: Record<string, string>;
  className?: string;
  pixel?: number;
}

export function PixelSprite({
  rows,
  palette,
  className,
  pixel = 1,
}: PixelSpriteProps) {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const rects: ReactElement[] = [];

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * pixel}
          y={y * pixel}
          width={pixel}
          height={pixel}
          fill={color}
        />,
      );
    }
  }

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width * pixel} ${height * pixel}`}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      {rects}
    </svg>
  );
}

const FACE_PALETTE: Record<string, string> = {
  o: "#33240f",
  g: "#f2c93b",
  G: "#b8821a",
  s: "#f3c89a",
  S: "#d99a68",
  e: "#2a2a2a",
  b: "#e9e4d6",
  w: "#ffffff",
  r: "#c43d33",
  R: "#8a2a20",
  m: "#9c3b34",
  h: "#7a4a22",
  H: "#5a3416",
  t: "#3a7d9a",
  T: "#27566b",
  l: "#3a6db0",
  L: "#274d80",
  p: "#7a4a9a",
  n: "#3f8f63",
};

export const KING_SPRITE = [
  ".....o..o.....",
  "....og..go....",
  "...ogggggggo..",
  "..oggGggGggo..",
  "..oggggggggo..",
  "..osssssssso..",
  ".osssssssssso.",
  ".osseessees so",
  ".ossssssssso..",
  ".osssmmm sso..",
  ".obsssssssbo..",
  ".obbsssssbbo..",
  "..obbbbbbbbo..",
  "..orbbbbbbro..",
  ".orrrrrrrrrro.",
  ".orrrRRRRrrro.",
  ".orrrrrrrrrro.",
  "..oooooooooo..",
];

export const QUEEN_SPRITE = [
  ".....oggo.....",
  "....oggggo....",
  "...ogGggGgo...",
  "..ohhggggho...",
  ".ohhhssssh ho.",
  ".ohsssssssho..",
  ".ohsseessho...",
  ".ohssssssho...",
  ".ohsssmsssho..",
  ".ohhssssshho..",
  "..ohhssshho...",
  "...ohhhhho....",
  "..oppppppppo..",
  ".opppPPPPppo..",
  ".oppppppppppo.",
  ".oppwppppwppo.",
  ".opppppppppo..",
  "..oooooooooo..",
];

export const JACK_SPRITE = [
  ".....oo.......",
  "....ohho......",
  "...ohhhho.....",
  "..ohhhhhho....",
  "..ossssssoo...",
  ".osssssssso...",
  ".osseesssso...",
  ".ossssssso ...",
  ".osssmsssoo...",
  ".ossssssso....",
  "..oSsssSo.....",
  "..ollllllo....",
  ".ollllllllo...",
  ".ollLLllllo...",
  ".ollllllllo...",
  ".ollllllllo...",
  "..olllllllo...",
  "..ooooooooo...",
];

export function FaceArt({ rank }: { rank: "J" | "Q" | "K" }) {
  const rows = rank === "K" ? KING_SPRITE : rank === "Q" ? QUEEN_SPRITE : JACK_SPRITE;

  return (
    <PixelSprite
      rows={rows}
      palette={FACE_PALETTE}
      className="h-full w-full pixelated drop-shadow-[0_1px_0_rgba(0,0,0,0.25)]"
    />
  );
}

const JOKER_PALETTE: Record<string, string> = {
  o: "#1c1c1c",
  w: "#f6f3ea",
  s: "#f3c89a",
  e: "#2a2a2a",
  m: "#c0392b",
  r: "#e23b3b",
  g: "#3aa35a",
  b: "#3a6db0",
  y: "#f2c93b",
  p: "#9a4aa3",
};

export const JOKER_SPRITE = [
  "...oo....oo...",
  "..orro..obbo..",
  "..orrooooobbo.",
  ".oggrrgggbbgo.",
  ".oggggggggggo.",
  "..osssssssso..",
  ".ossssssssss o",
  ".osseesseesso.",
  ".ossssssssso..",
  ".osssmmmm sso.",
  "..ossmmmmsso..",
  "..osssssssso..",
  ".oyyyyyyyyyyo.",
  ".oyprprprprpyo",
  ".oyyyyyyyyyyo.",
  "..oo......oo..",
];

export function JokerArt({ className }: { className?: string }) {
  return (
    <img
      src="/assets/cards/JOKER.webp"
      alt="Joker"
      className={`h-full w-full object-contain pixelated ${className ?? ""}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}