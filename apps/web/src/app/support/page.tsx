import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support · MiniCard",
  description: "Get help with MiniCard",
};

export default function SupportPage() {
  return (
    <main className="min-h-[100dvh] w-full bg-[#070b09] text-[#edf6ef] font-pixel">
      <div className="mx-auto max-w-[640px] px-4 py-6">
        <Link href="/" className="text-[#38d08f] text-xs hover:underline">
          ← Back to MiniCard
        </Link>
        <h1 className="font-pixel-fat text-2xl text-[#facc15] txt-outline mt-4 mb-4">
          Support
        </h1>

        <div className="space-y-3 text-sm leading-relaxed text-gray-300">
          <p>
            Need help with MiniCard? We respond to critical issues within 24 hours. Pick whichever
            channel works best for you:
          </p>

          <a
            href="https://t.me/minicard_game"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-black/30 border border-white/10 rounded-lg p-3 hover:border-[#38d08f]/40 transition-colors"
          >
            <div className="font-pixel-fat text-base text-[#38d08f]">Telegram</div>
            <div className="text-[11px] text-gray-400 mt-0.5">@minicard_game — fastest response</div>
          </a>

          <a
            href="mailto:support@minicard.game"
            className="block bg-black/30 border border-white/10 rounded-lg p-3 hover:border-[#38d08f]/40 transition-colors"
          >
            <div className="font-pixel-fat text-base text-[#38d08f]">Email</div>
            <div className="text-[11px] text-gray-400 mt-0.5">support@minicard.game</div>
          </a>

          <div className="bg-black/20 border border-white/5 rounded-lg p-3 mt-4">
            <div className="font-pixel text-[11px] text-gray-400 mb-1">Common issues</div>
            <ul className="text-[11px] text-gray-400 space-y-1 list-disc list-inside">
              <li>Payment didn’t go through? Make sure you have enough USDT for the $0.01 plus the network fee.</li>
              <li>Score not on the leaderboard? You must approve the on-chain transaction in your wallet.</li>
              <li>Stuck on cooldown? Wait 24h or pay $0.01 USDT to play again immediately.</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-[11px] text-gray-500 flex gap-3">
          <Link href="/legal/terms" className="text-[#38d08f] hover:underline">Terms of Service</Link>
          <Link href="/legal/privacy" className="text-[#38d08f] hover:underline">Privacy Policy</Link>
        </div>
      </div>
    </main>
  );
}
