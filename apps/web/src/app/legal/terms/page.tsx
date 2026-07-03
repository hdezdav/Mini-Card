import type { Metadata } from "next";
import Link from "next/link";

// Force dynamic rendering so next-on-pages emits a lambda for this route
// (static prerendering triggers "Unable to find lambda for route" on Next 15.5).
// next-on-pages requires the edge runtime on all non-static routes.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service · MiniCard",
  description: "MiniCard Terms of Service",
};

export default function TermsPage() {
  return (
    <main className="min-h-[100dvh] w-full bg-[#0a0420] text-[#e8e6ff] font-pixel">
      <div className="mx-auto max-w-[640px] px-4 py-6">
        <Link href="/" className="text-[#00f0ff] text-xs hover:underline">
          ← Back to MiniCard
        </Link>
        <h1 className="font-pixel-fat text-2xl txt-chrome mt-4 mb-4">
          Terms of Service
        </h1>

        <div className="space-y-4 text-sm leading-relaxed text-gray-300">
          <p className="text-[11px] text-gray-500">Last updated: June 2026</p>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">1. Acceptance</h2>
            <p>
              By playing MiniCard, you agree to these Terms. If you do not agree, do not use the app.
              MiniCard is a browser-based card game that runs inside the MiniPay wallet.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">2. The Game</h2>
            <p>
              MiniCard is a free-to-play game. Certain optional actions — rerolling shop offers and
              bypassing the 24-hour cooldown — require a small payment of $0.01 USDT. These payments
              are voluntary; the core game is fully playable without them.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">3. Blockchain Transactions</h2>
            <p>
              Score submissions, username registration, and optional payments are on-chain
              transactions. You are responsible for approving each transaction in your wallet.
              Transactions are final and cannot be reversed. Network fees are handled automatically
              by MiniPay.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">4. No Warranties</h2>
            <p>
              MiniCard is provided “as is” without warranties of any kind. We do not guarantee
              uninterrupted access, that the game will be error-free, or that scores will remain
              permanently available on-chain.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">5. Eligibility</h2>
            <p>
              You must be of legal age in your jurisdiction to use this app. You are responsible for
              complying with your local laws regarding digital assets and stablecoins.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">6. Prohibited Conduct</h2>
            <p>
              You may not cheat, manipulate the leaderboard, exploit bugs, use bots, or attempt to
              disrupt the service. We may restrict access for violations.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">7. Changes</h2>
            <p>
              We may update these Terms at any time. Continued use after changes constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">8. Contact</h2>
            <p>
              Questions about these Terms? Reach us via the in-app support link or email
              <a href="mailto:support@minicard.game" className="text-[#00f0ff] hover:underline"> support@minicard.game</a>.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-[11px] text-gray-500 flex gap-3">
          <Link href="/privacy" className="text-[#00f0ff] hover:underline">Privacy Policy</Link>
          <Link href="/support" className="text-[#00f0ff] hover:underline">Support</Link>
        </div>
      </div>
    </main>
  );
}
