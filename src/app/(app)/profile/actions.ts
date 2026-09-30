"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type ResetProgressResult =
  | { ok: true; attemptsCleared: number; runsCleared: number; achievementsCleared: number }
  | { ok: false; error: string }

/**
 * Wipe the signed-in player's progress and put them back at zero.
 *
 * The real work is `reset_my_progress()` (migration 0022), a SECURITY DEFINER
 * function that takes **no arguments** and resets `auth.uid()`. That shape is
 * deliberate: this action cannot be made to reset a different player, because
 * there is no user id to pass it in the first place.
 *
 * Progress only — display name, avatar, language and age range survive. See
 * the migration for exactly what is cleared and what is kept, and why.
 */
export async function resetMyProgress(): Promise<ResetProgressResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const { data, error } = await supabase.rpc("reset_my_progress")
  if (error) return { ok: false, error: error.message || "Could not reset your progress." }

  const row = (data ?? {}) as {
    attempts_cleared?: number
    runs_cleared?: number
    achievements_cleared?: number
  }

  // The level map, the home dashboard and the leaderboard all read this
  // player's derived state, so they are stale the moment the reset lands.
  revalidatePath("/profile")
  revalidatePath("/home")
  revalidatePath("/quiz")
  revalidatePath("/leaderboard")
  revalidatePath("/achievements")
  revalidatePath("/quiz/[id]", "page")
  revalidatePath("/quiz/[id]/[tier]", "page")
  revalidatePath("/challenges")
  revalidatePath("/rewards")
  revalidatePath("/store")
  revalidatePath("/review")
  revalidatePath("/play/[mode]", "page")

  return {
    ok: true,
    attemptsCleared: row.attempts_cleared ?? 0,
    runsCleared: row.runs_cleared ?? 0,
    achievementsCleared: row.achievements_cleared ?? 0,
  }
}
