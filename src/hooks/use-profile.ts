"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ProfileGameState {
  id: string;
  displayName: string | null;
  /** The avatar picked at onboarding, e.g. "m-3". Rendered by PremiumAvatar. */
  avatarId: string | null;
  coins: number;
  highScore: number;
  streakCount: number;
  lastSpinAt: string | null;
  totalXp: number;
}

type ProfilePatch = Partial<{
  coins: number;
  highScore: number;
  streakCount: number;
  lastSpinAt: string;
  totalXp: number;
}>;

/**
 * Replaces the old localStorage-only game state (coins, highScore,
 * dailyStreak, lastSpinTime) with the real cross-device `profiles` row.
 * Falls back to sensible defaults while loading or if signed out.
 */
export function useProfile() {
  const [profile, setProfile] = useState<ProfileGameState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_id, coins, high_score, streak_count, last_spin_at, total_xp")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile({
          id: data.id,
          displayName: data.display_name,
          avatarId: data.avatar_id,
          coins: data.coins,
          highScore: data.high_score,
          streakCount: data.streak_count,
          lastSpinAt: data.last_spin_at,
          totalXp: data.total_xp,
        });
      }
    } catch {
      // A failed refresh retains the last loaded balance and rank.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const dbPatch: Record<string, number | string> = {};
    if (patch.coins !== undefined) dbPatch.coins = patch.coins;
    if (patch.highScore !== undefined) dbPatch.high_score = patch.highScore;
    if (patch.streakCount !== undefined) dbPatch.streak_count = patch.streakCount;
    if (patch.lastSpinAt !== undefined) dbPatch.last_spin_at = patch.lastSpinAt;
    if (patch.totalXp !== undefined) dbPatch.total_xp = patch.totalXp;

    const { error } = await supabase.from("profiles").update(dbPatch).eq("id", user.id);
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  }, []);

  return { profile, loading, updateProfile, refresh };
}
