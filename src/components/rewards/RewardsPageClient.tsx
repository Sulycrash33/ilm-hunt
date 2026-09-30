"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { useAsyncAction } from "@/hooks/use-async-action"

import { PageHeader } from "@/components/layout/PageHeader"
import { Gift } from "lucide-react"

import { motion } from "framer-motion"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { PremiumCard } from "@/components/ui/premium-card"
import {
  claimDailyLogin,
  spinWheel,
  type SpinResult,
  type DailyTaskProgress,
} from "@/app/(app)/rewards/actions"
import { SpinWheel, type SpinSegment } from "@/components/rewards/SpinWheel"
import { DailyChallengeCard } from "@/components/challenges/DailyChallengeCard"
import type { DailyChallengeView } from "@/app/(app)/challenges/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { formatCountdown } from "@/lib/countdown"
import type { Translations } from "@/lib/i18n"

interface LoginReward {
  day_number: number
  coins: number
  xp: number
  is_special: boolean
}

/**
 * How long the wheel actually stays locked, in milliseconds.
 *
 * **Twenty-four hours, not four.** This file used to say four in two places and
 * the copy said "every 4 hours" in all six languages, while `spin_wheel_rpc`
 * has refused anything inside twenty-four hours since migration 0008 — which
 * describes the wheel as a "once-a-day cadence" and means it. So the countdown
 * ran to zero, invited the player to spin, and the server answered "Come back
 * later for today's gift." The promise was wrong, not the cooldown; the copy
 * moved to match the database rather than the other way round.
 *
 * One constant, because the two places that had the number disagreed with the
 * server independently and would have drifted again.
 */
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000

export function RewardsPageClient({
  dailyTask,
  dailyChallenge,
  streakCount,
  longestStreak,
  streakFreezesAvailable,
  coins: initialCoins,
  totalXp: initialXp,
  lastSpinAt,
  claimedToday: initialClaimedToday,
  currentDayNumber,
  loginRewards,
  spinRewards,
}: {
  dailyTask: DailyTaskProgress
  /** Today's five questions. Null on a day the arena cannot fill a challenge. */
  dailyChallenge: DailyChallengeView | null
  streakCount: number
  longestStreak: number
  streakFreezesAvailable: number
  coins: number
  totalXp: number
  lastSpinAt: string | null
  claimedToday: boolean
  currentDayNumber: number
  loginRewards: LoginReward[]
  spinRewards: SpinSegment[]
}) {
  const { t, dir } = useLanguage()
  const reduce = useGameReducedMotion()
  const actionLock = useRef(false)
  const [coins, setCoins] = useState(initialCoins)
  const [xp, setXp] = useState(initialXp)
  const [claimedToday, setClaimedToday] = useState(initialClaimedToday)
  /**
   * Today's questions, seeded from the server and corrected by it.
   *
   * Held in state rather than read straight from the prop because the claim
   * itself reports the count: if the player answered questions in another tab
   * since this page loaded, the refusal carries the true number and the bar
   * moves to match instead of arguing with the button.
   */
  const [taskAnswered, setTaskAnswered] = useState(dailyTask.answered)
  const taskRequired = dailyTask.required
  const taskDone = taskRequired > 0 && taskAnswered >= taskRequired
  const taskPercent = taskRequired > 0 ? Math.min(100, Math.round((taskAnswered / taskRequired) * 100)) : 0
  const [message, setMessage] = useState<string | null>(null)
  const [spinAvailableAt, setSpinAvailableAt] = useState<string | null>(
    lastSpinAt ? new Date(new Date(lastSpinAt).getTime() + SPIN_COOLDOWN_MS).toISOString() : null
  )
  const [now, setNow] = useState(() => Date.now())
  const [isPending, startTransition] = useAsyncAction(() => setMessage(t("somethingWentWrong")))
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  /** The segment the wheel is travelling to, or null when it is at rest. */
  const [spinTarget, setSpinTarget] = useState<number | null>(null)
  /** The awarded prize, held back until the wheel stops so it is not spoiled. */
  const [pendingSpin, setPendingSpin] = useState<SpinResult | null>(null)
  /** Bumped once per spin so an identical target still starts the wheel. */
  const [spinToken, setSpinToken] = useState(0)

  /**
   * Once a second, not once every thirty.
   *
   * At a thirty-second interval the countdown below sat on the same
   * "4h 0m" for half a minute at a time, which reads as a frozen screen
   * rather than a wait — there was no way to tell a running timer from a
   * hung one. A seconds field only helps if something moves it.
   */
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  /**
   * `floor`, not `ceil`, and always a seconds field.
   *
   * The old version rounded up to whole minutes, so a wait of twelve seconds
   * displayed as "1m" and stayed there — the last minute of every countdown
   * was a full minute of a number that never changed, immediately before the
   * button was supposed to come alive. Seconds are zero-padded so the width
   * does not jitter as they count down.
   */
  // One definition, shared with the daily challenge's countdown. See
  // `src/lib/countdown.ts`.
  const countdown = (ms: number): string => formatCountdown(ms, t("countdownNow"))

  const spinReady = !spinAvailableAt || new Date(spinAvailableAt).getTime() <= now

  const handleClaim = () => {
    if (actionLock.current) return
    actionLock.current = true
    setMessage(null)
    setPendingAction("claim")
    startTransition(async () => {
      try {
      const result = await claimDailyLogin()
      if (result.success) {
        setClaimedToday(true)
        // Coins only. Migration 0058 zeroed the ladder's XP: a gift may hand
        // the player coins, it may not hand them rank. The RPC still reports
        // an `xpAwarded`, and it is now always 0, so adding it to the header
        // and printing "+0 XP" would be noise at best and a promise the app no
        // longer keeps at worst.
        setCoins((c) => c + (result.coinsAwarded ?? 0))
        setMessage(t("claimSuccessMsg", { day: result.dayNumber ?? "", coins: result.coinsAwarded ?? 0 }))
      } else if (result.alreadyClaimedToday) {
        setClaimedToday(true)
        setMessage(t("alreadyClaimedMsg"))
      } else if (result.taskIncomplete) {
        // The server refused because today's questions are not done. It also
        // reports how far along the player is, so the bar corrects itself from
        // the authority rather than from whatever this page loaded with.
        setTaskAnswered(result.taskAnswered ?? taskAnswered)
        setMessage(t("dailyTaskLocked", { required: result.taskRequired ?? taskRequired }))
      } else {
        setMessage(result.error ?? t("claimErrorMsg"))
      }
      } catch { setMessage(t("claimErrorMsg")) }
      finally { actionLock.current = false; setPendingAction(null) }
    })
  }

  /**
   * The prize is awarded before the wheel moves, and revealed after it stops.
   *
   * `spin_wheel_rpc` picks, awards and records in one call, so by the time the
   * animation starts the coins are already on the profile. That ordering is
   * deliberate and not reversible: the server cannot be asked to "confirm"
   * afterwards without opening a window where a player who closes the tab
   * mid-spin has been shown a prize they were never paid.
   *
   * What it costs is that the totals in the header would give the answer away
   * four seconds early, so the balance updates are held in `pendingSpin` and
   * applied by `handleSpinSettled` when the wheel comes to rest. Nothing is at
   * risk in that gap — the money is already banked; only the reveal is
   * waiting.
   */
  const handleSpin = () => {
    if (actionLock.current || !spinReady) return
    actionLock.current = true
    setPendingAction("spin")
    setMessage(null)
    startTransition(async () => {
      try {
      const result = await spinWheel()
      if (result.success) {
        // Matched on type and value rather than on the label, because the
        // label is English text from the database and the segment captions are
        // built from the numbers so they can be translated.
        const index = spinRewards.findIndex(
          (r) => r.type === result.type && r.value === result.value,
        )
        setPendingSpin(result)
        // A prize the wheel has no segment for cannot be landed on. It should
        // not happen — both come from `spin_rewards` — but a silent no-op that
        // leaves the player watching a still wheel forever is the worse
        // failure, so the reveal skips straight to the sentence.
        if (index === -1) {
          setSpinTarget(null)
          applySpinResult(result)
        } else {
          setSpinTarget(index)
          setSpinToken((n) => n + 1)
        }
      } else {
        if (result.nextAvailableAt) setSpinAvailableAt(result.nextAvailableAt)
        setMessage(result.error ?? t("spinErrorMsg"))
        actionLock.current = false
        setPendingAction(null)
      }
      } catch { actionLock.current = false; setPendingAction(null); setMessage(t("spinErrorMsg")) }
    })
  }

  const applySpinResult = (result: SpinResult) => {
    if (result.type === "coins") setCoins((c) => c + (result.value ?? 0))
    else setXp((x) => x + (result.value ?? 0))
    setSpinAvailableAt(new Date(Date.now() + SPIN_COOLDOWN_MS).toISOString())
    setMessage(t("spinWonMsg", { label: result.label ?? "" }))
    setPendingSpin(null)
    actionLock.current = false
    setPendingAction(null)
  }

  const handleSpinSettled = () => {
    if (pendingSpin) applySpinResult(pendingSpin)
  }

  return (
    <div dir={dir} className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      <PageHeader title={t("rewardsCenter")} subtitle={t("realProgressRealPrizes")} icon={Gift} actions={<span className="rounded-xl border border-tertiary/30 bg-tertiary/10 px-4 py-3 font-bold text-tertiary">{coins.toLocaleString()} {t("coinsWord")}</span>} />

      {message && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          // The wheel itself is hidden from assistive technology, so this is
          // the only place a screen reader learns what was won. It has to
          // announce on change rather than only on focus.
          role="status"
          aria-live="polite"
          className="mb-6 rounded-xl border border-tertiary/25 bg-tertiary/10 p-4 text-sm text-on-surface"
        >
          {message}
        </motion.div>
      )}

      {/* Streak stats */}
      <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="font-bold text-3xl text-primary">{streakCount}</p>
            <p className="font-label-caps text-label-caps text-on-surface-variant">{t("currentStreak").toUpperCase()}</p>
          </div>
          <div>
            <p className="font-bold text-3xl text-secondary">{longestStreak}</p>
            <p className="font-label-caps text-label-caps text-on-surface-variant">{t("longestStreak").toUpperCase()}</p>
          </div>
          <div>
            <p className="font-bold text-3xl text-tertiary">{streakFreezesAvailable}</p>
            <p className="font-label-caps text-label-caps text-on-surface-variant">{t("streakFreezesLabel")}</p>
          </div>
          <div>
            <p className="font-bold text-3xl text-primary-fixed">{xp.toLocaleString()}</p>
            <p className="font-label-caps text-label-caps text-on-surface-variant">{t("totalXp").toUpperCase()}</p>
          </div>
        </div>
      </motion.div>

      {/* The day, in one panel: the five questions, then what finishing them
          pays.

          These were two features with one body. The "daily challenge" — five
          questions the server picks for everyone, on `/challenges` — and the
          "daily login reward" — answer five questions, collect the day's coins,
          here — are the same five questions and the same day. The player met
          them on two screens under two names, and the one on this page did not
          even lead to the questions: its "Start answering" pointed at `/quiz`,
          the category grid, which is precisely the complaint #73 and #77 were
          each supposed to have closed. Reported a third time, from this screen.

          So the challenge moves in above the ladder, and the ladder becomes
          what it was always meant to be from here: the answer to "what do I get
          for doing this". One card, one task, one place to press. It is the
          same `DailyChallengeCard` component, so there is still exactly one
          definition of what the challenge says and what it pays. */}
      <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 mb-8">
        {dailyChallenge && (
          <div className="mb-6">
            <DailyChallengeCard challenge={dailyChallenge} />
          </div>
        )}
        <h2 className="font-headline-md text-headline-md text-on-surface mb-4">{t("dailyLoginRewards")}</h2>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
          {loginRewards.map((r) => {
            const isPast = r.day_number < currentDayNumber || (r.day_number === currentDayNumber && claimedToday)
            const isToday = r.day_number === currentDayNumber && !claimedToday
            return (
              <div
                key={r.day_number}
                className={`rounded-lg p-2 text-center border ${
                  isPast
                    ? "bg-primary/20 border-primary/40"
                    : isToday
                      ? "bg-tertiary/20 border-tertiary/50"
                      : "bg-surface-container-high border-white/5"
                }`}
              >
                <p className="text-xs text-on-surface-variant">{t("dayLabel", { day: r.day_number })}</p>
                <p className="text-sm font-bold text-on-surface">{r.coins} <span className="sr-only">{t("coinsWord")}</span></p>
                {isPast && <p className="text-xs text-primary">✓</p>}
              </div>
            )
          })}
        </div>
        {/* The day's task, for a day with no challenge on it.

            This reward used to pay for opening the app. 0053 attaches a
            condition to it and enforces that condition in the database; this
            strip is what makes the condition visible, because a button that
            refuses without saying why is a bug as far as the player is
            concerned. Hidden once claimed: at that point the task is history
            and the only useful thing to say is that the reward is spent.

            Hidden too whenever there *is* a challenge above, because then this
            strip is a second progress bar for the same five questions with a
            worse link on it — two bars disagreeing about one day is the
            confusion this whole change is undoing. The challenge card carries
            the bar; the claim button below still names the condition when it
            is not met, so nothing goes unexplained.

            It survives for the days the arena cannot fill a challenge. On those
            the gate is still real and still has to be reachable, and `/quiz` is
            then the honest destination rather than the wrong one: any five
            answers satisfy `daily_task_progress()`, from any room. */}
        {!dailyChallenge && !claimedToday && taskRequired > 0 && (
          <div className="mb-4 rounded-lg border border-white/5 bg-surface-container-high/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-on-surface">
                {t("dailyTaskTitle", { required: taskRequired })}
              </p>
              <span
                className={`font-bold tabular-nums shrink-0 ${taskDone ? "text-success" : "text-on-surface-variant"}`}
              >
                {Math.min(taskAnswered, taskRequired)}/{taskRequired}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${taskDone ? "bg-success" : "bg-gradient-to-r from-primary to-primary-fixed-dim"}`}
                style={{ width: `${taskPercent}%` }}
              />
            </div>
            {!taskDone && (
              <Link
                href="/quiz"
                className="mt-3 inline-flex items-center gap-1 font-bold text-sm text-primary hover:underline"
              >
                {t("dailyTaskCta")}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
        )}

        <PremiumButton
          variant="primary"
          onClick={handleClaim}
          disabled={claimedToday || !taskDone || pendingAction !== null}
        >
          {claimedToday
            ? t("claimedForToday")
            : isPending && pendingAction === "claim"
              ? t("claimingLabel")
              : !taskDone
                ? t("dailyTaskLocked", { required: taskRequired })
                : t("claimDayReward", { day: currentDayNumber })}
        </PremiumButton>
      </motion.div>

      <div className="max-w-2xl mx-auto mb-8">
        {/* Spin wheel - real, server-computed, cooldown-gated */}
        <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-4">{t("freeSpinTitle")}</h2>
          <p className="text-on-surface-variant text-sm mb-4">{t("freeSpinDesc")}</p>

          <SpinWheel
            segments={spinRewards}
            targetIndex={spinTarget}
            spinToken={spinToken}
            onSettled={handleSpinSettled}
          />

          <PremiumButton
            variant="primary"
            onClick={handleSpin}
            disabled={!spinReady || pendingAction !== null || spinRewards.length === 0}
          >
            {pendingAction === "spin"
              ? t("spinningLabel")
              : spinReady
                ? t("spinNowLabel")
                : t("nextSpinIn", { time: countdown(new Date(spinAvailableAt!).getTime() - now) })}
          </PremiumButton>
        </motion.div>

        {/* The chests are NOT here, and their absence is the point.
            Everything on this screen is something you get for showing up: the
            day's coins, the free spin, the streak count. An earned chest sitting
            among them reads as another handout, which is the confusion 0058
            spent a whole migration undoing. They live on `/achievements`, with
            the other things you had to earn. See migration 0061. */}
      </div>

      <p className="text-xs text-on-surface-variant text-center">
        <PremiumBadge variant="secondary" size="sm" className="mr-2">{t("noteLabel")}</PremiumBadge>
        {t("rewardsFootnote")}
      </p>
    </div>
  )
}
