"use client";

import { Coins, Package, Zap, Brain, SkipForward, Gem, Timer, LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Translations } from "@/lib/i18n";
import type { LifelinePrice } from "@/app/(app)/quiz/actions";

interface LifelineDockProps {
  prices: LifelinePrice[];
  coins: number;
  used: string[];
  /** Blocks the dock while an answer is being graded or the reveal is showing. */
  locked: boolean;
  /** The lifeline currently being charged, if any. */
  pending: string | null;
  onUse: (id: string) => void;
}

/** Display metadata per lifeline. The cost is NOT here — it comes from the
 * database via `getLifelinePrices`, so the price shown is the price charged. */
const LIFELINE_META: Record<string, { icon: LucideIcon; nameKey: keyof Translations; descKey: keyof Translations }> = {
  "fifty-fifty": { icon: Zap, nameKey: "lifelineFiftyFifty", descKey: "lifelineFiftyFiftyDesc" },
  "ask-imam": { icon: Brain, nameKey: "lifelineAskImam", descKey: "lifelineAskImamDesc" },
  skip: { icon: SkipForward, nameKey: "lifelineSkip", descKey: "lifelineSkipDesc" },
  "double-points": { icon: Gem, nameKey: "lifelineDoublePoints", descKey: "lifelineDoublePointsDesc" },
  "time-boost": { icon: Timer, nameKey: "lifelineTimeBoost", descKey: "lifelineTimeBoostDesc" },
};

export function LifelineDock({ prices, coins, used, locked, pending, onUse }: LifelineDockProps) {
  const { t } = useLanguage();

  return (
    <section aria-label={t("lifelines")} className="space-y-3">
      <h3 className="text-label-caps uppercase tracking-wider text-on-surface-variant">
        {t("lifelines")}
      </h3>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {prices.map((lifeline) => {
          const meta = LIFELINE_META[lifeline.id];
          if (!meta) return null;

          const isUsed = used.includes(lifeline.id);
          // A stocked lifeline is spent from inventory, so coins are irrelevant
          // to whether it can be used.
          const inStock = lifeline.owned > 0;
          const affordable = inStock || coins >= lifeline.cost;
          const isPending = pending === lifeline.id;
          const Icon = meta.icon;
          const disabled = isUsed || !affordable || locked || pending !== null;

          return (
            <button
              key={lifeline.id}
              type="button"
              disabled={disabled}
              aria-busy={isPending}
              onClick={() => onUse(lifeline.id)}
              title={t(meta.descKey)}
              aria-label={
                inStock
                  ? `${t(meta.nameKey)} · ${t("ownedCount", { count: lifeline.owned })}`
                  : `${t(meta.nameKey)} · ${lifeline.cost} ${t("coinsWord")}`
              }
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                disabled
                  ? "border-outline-variant/40 bg-surface-container opacity-45"
                  : inStock
                    ? "border-primary/40 bg-surface-container hover:border-primary hover:bg-surface-container-high"
                    : "border-tertiary/30 bg-surface-container hover:border-tertiary hover:bg-surface-container-high",

              )}
            >
              {isPending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
              <span className="text-center text-xs font-medium leading-tight text-on-surface">
                {t(meta.nameKey)}
              </span>
              {inStock ? (
                <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-primary">
                  <Package className="h-3 w-3" aria-hidden="true" />
                  {t("ownedCount", { count: lifeline.owned })}
                </span>
              ) : (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs tabular-nums",
                    affordable ? "text-tertiary" : "text-error",
                  )}
                >
                  <Coins className="h-3 w-3" aria-hidden="true" />
                  {lifeline.cost}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
