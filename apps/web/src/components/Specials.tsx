import { JokerArt } from "@/components/PixelSprite";

export function EmptySlot({ className }: { className?: string }) {
  return <div className={`rounded-[8px] border-2 border-dashed border-white/15 bg-black/15 ${className ?? ""}`} style={{ boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" }} />;
}

export function JokerCard({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`anim-bob relative overflow-hidden rounded-[9px] border-[2.5px] border-[#2a2a2a] ${className ?? ""}`}
      style={{
        background: "linear-gradient(160deg,#fbf7ec 0%, #f4eee0 60%, #e7ddc6 100%)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.7), 0 6px 10px rgba(0,0,0,0.5)",
      }}
    >
      <span className="font-pixel absolute left-1 top-0 text-[0.7rem] leading-none" style={{ color: "#d23bd2", WebkitTextStroke: "0.4px rgba(0,0,0,0.3)" }}>
        JOKER
      </span>
      <span className="font-pixel absolute right-1 bottom-0 rotate-180 text-[0.7rem] leading-none" style={{ color: "#d23bd2", WebkitTextStroke: "0.4px rgba(0,0,0,0.3)" }}>
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
        borderColor: "#a9c7e8",
        background: "radial-gradient(120% 120% at 50% 30%, #3a4f9a 0%, #1d2a63 45%, #0c1336 100%)",
        boxShadow: "inset 0 0 10px rgba(120,170,255,0.4), 0 6px 10px rgba(0,0,0,0.55)",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 40 56" className="h-full w-full">
          <g fill="none" stroke="#9fd0ff" strokeWidth="1.4" opacity="0.9" shapeRendering="geometricPrecision">
            <polygon points="20,10 30,20 20,30 10,20" />
            <polygon points="20,16 26,22 20,28 14,22" fill="#bfe3ff" opacity="0.5" />
            <circle cx="20" cy="20" r="14" opacity="0.4" />
            <line x1="20" y1="3" x2="20" y2="9" />
            <line x1="6" y1="20" x2="11" y2="20" />
            <line x1="34" y1="20" x2="29" y2="20" />
          </g>
        </svg>
      </div>
      <div className="absolute inset-x-1 bottom-[3px]">
        <div className="rounded-[3px] border border-[#6f8fd0] bg-[linear-gradient(180deg,#2a3c8a,#16204e)] text-center font-pixel text-[0.62rem] leading-[1.1] text-white">
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
      className={`relative overflow-hidden rounded-[9px] border-[2.5px] border-[#e9e2cf] bg-[#2d241e] ${className ?? ""}`}
      style={{
        boxShadow: "0 5px 8px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      <img
        src={`/assets/cards/back-${backColor}.webp`}
        alt="Deck Back"
        className="h-full w-full object-cover pixelated"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}