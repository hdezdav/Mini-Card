import type { Metadata } from "next";
import Link from "next/link";

// Force dynamic rendering so next-on-pages emits a lambda for this route
// (static prerendering triggers "Unable to find lambda for route" on Next 15.5).
// next-on-pages requires the edge runtime on all non-static routes.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy · MiniCard",
  description: "MiniCard Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] w-full bg-[#0a0420] text-[#e8e6ff] font-pixel">
      <div className="mx-auto max-w-[640px] px-4 py-6">
        <Link href="/" className="text-[#00f0ff] text-xs hover:underline">
          ← Back to MiniCard
        </Link>
        <h1 className="font-pixel-fat text-2xl txt-chrome mt-4 mb-4">
          Privacy Policy
        </h1>

        <div className="space-y-4 text-sm leading-relaxed text-gray-300">
          <p className="text-[11px] text-gray-500">Last updated: June 2026</p>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">1. What We Collect</h2>
            <p>
              MiniCard is a non-custodial app. We do not ask for your name, email, phone number, or
              personal information. The only identifier we use is your wallet address, which is
              public on the Celo blockchain.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">2. On-Chain Data</h2>
            <p>
              When you submit a score, register a username, or make an optional payment, that data is
              recorded publicly on the Celo blockchain. This includes your wallet address, your chosen
              username, your score, the round reached, and the transaction timestamp. This data is
              visible to anyone and cannot be deleted.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">3. Local Storage</h2>
            <p>
              We store your selected deck type and your local leaderboard history in your browser’s
              local storage. This data never leaves your device.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">4. Analytics</h2>
            <p>
              We use privacy-respecting web analytics to understand aggregate usage (how many people
              play, from which countries, retention). We do not link this data to your wallet address
              or identity. See our <Link href="/stats" className="text-[#00f0ff] hover:underline">public stats page</Link>.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">5. No Selling of Data</h2>
            <p>
              We do not sell, rent, or share your data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">6. Third-Party Services</h2>
            <p>
              The app runs inside MiniPay and on the Celo network. Their respective privacy practices
              apply to data they process. We encourage you to review MiniPay’s and Celo’s policies.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">7. Children</h2>
            <p>
              MiniCard is not directed at children under the legal age in their jurisdiction. We do
              not knowingly collect data from them.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">8. Changes</h2>
            <p>
              We may update this Privacy Policy at any time. Continued use after changes constitutes
              acceptance.
            </p>
          </section>

          <section>
            <h2 className="font-pixel-fat text-base text-white mb-1">9. Contact</h2>
            <p>
              Privacy questions? Email
              <a href="mailto:support@minicard.game" className="text-[#00f0ff] hover:underline"> support@minicard.game</a>.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-[11px] text-gray-500 flex gap-3">
          <Link href="/legal/terms" className="text-[#00f0ff] hover:underline">Terms of Service</Link>
          <Link href="/support" className="text-[#00f0ff] hover:underline">Support</Link>
        </div>
      </div>
    </main>
  );
}
