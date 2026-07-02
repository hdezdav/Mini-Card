import { JokerArt } from "@/components/PixelSprite";

export function EmptySlot({ className }: { className?: string }) {
  return <div className={`rounded-[8px] border-2 border-dashed border-[#b026ff]/25 bg-[#0a0420]/40 ${className ?? ""}`} style={{ boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6), inset 0 0 8px rgba(176,38,255,0.08)" }} />;
}

export function JokerCard({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`anim-bob relative overflow-hidden rounded-[9px] border-[2.5px] border-[#ff2e88] ${className ?? ""}`}
      style={{
        background: "linear-gradient(160deg,#2a0d5a 0%, #1a0d3a 60%, #0a0420 100%)",
        boxShadow: "inset 0 2px 0 rgba(0,240,255,0.18), 0 6px 10px rgba(0,0,0,0.55), 0 0 14px rgba(255,46,136,0.35)",
      }}
    >
      <span className="font-pixel absolute left-1 top-0 text-[0.7rem] leading-none" style={{ color: "#00f0ff", WebkitTextStroke: "0.4px rgba(0,0,0,0.5)", textShadow: "0 0 6px rgba(0,240,255,0.5)" }}>
        JOKER
      </span>
      <span className="font-pixel absolute right-1 bottom-0 rotate-180 text-[0.7rem] leading-none" style={{ color: "#00f0ff", WebkitTextStroke: "0.4px rgba(0,0,0,0.5)", textShadow: "0 0 6px rgba(0,240,255,0.5)" }}>
        JOKER
      </span>
      <div className="absolute inset-[16%_14%] flex items-center justify-center">
        <JokerArt />
      </div>
    </button>
  );
}

export function SpectralCard({ label = "HEX", className, onClick }: { label?: string; className?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`anim-bob relative overflow-hidden rounded-[9px] border-[2.5px] ${className ?? ""}`}
      style={{
        borderColor: "#00f0ff",
        background: "radial-gradient(120% 120% at 50% 30%, #2a0d5a 0%, #1a0d3a 45%, #0a0420 100%)",
        boxShadow: "inset 0 0 12px rgba(0,240,255,0.35), 0 6px 10px rgba(0,0,0,0.6), 0 0 14px rgba(176,38,255,0.3)",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 40 56" className="h-full w-full">
          <g fill="none" stroke="#00f0ff" strokeWidth="1.4" opacity="0.9" shapeRendering="geometricPrecision">
            <polygon points="20,10 30,20 20,30 10,20" />
            <polygon points="20,16 26,22 20,28 14,22" fill="#b026ff" opacity="0.5" />
            <circle cx="20" cy="20" r="14" opacity="0.4" />
            <line x1="20" y1="3" x2="20" y2="9" />
            <line x1="6" y1="20" x2="11" y2="20" />
            <line x1="34" y1="20" x2="29" y2="20" />
          </g>
        </svg>
      </div>
      <div className="absolute inset-x-1 bottom-[3px]">
        <div className="rounded-[3px] border border-[#00f0ff]/50 bg-[linear-gradient(180deg,#2a0d5a,#0a0420)] text-center font-pixel text-[0.62rem] leading-[1.1] text-[#00f0ff]">
          {label}
        </div>
      </div>
    </button>
  );
}

export function DeckBack({
  className,
  style,
  deckType = "red",
}: {
  className?: string;
  style?: React.CSSProperties;
  deckType?: string;
}) {
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

  return (
    <div
      className={`relative overflow-hidden rounded-[9px] border-[2.5px] border-[#b026ff]/60 bg-[#0a0420] ${className ?? ""}`}
      style={{
        boxShadow: "0 5px 8px rgba(0,0,0,0.55), 0 0 10px rgba(176,38,255,0.2)",
        ...style,
      }}
    >
      <img
        src={`/assets/cards/back-${backColor}.webp`}
        alt="Deck Back"
        className="h-full w-full object-cover pixelated"
        style={{
          imageRendering: "pixelated",
          // Synthwave tint on warm deck backs (red→magenta, green→cyan).
          filter: backColor === "red"
            ? "hue-rotate(285deg) saturate(1.4)"
            : backColor === "green"
            ? "hue-rotate(170deg) saturate(1.3)"
            : undefined,
        }}
      />
    </div>
  );
}