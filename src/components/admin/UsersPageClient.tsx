"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AlertTriangle, ChevronDown, Loader2, Trash2, Ban, RotateCcw } from "lucide-react"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { useToast } from "@/hooks/use-toast"
import {
  deleteUser,
  setUserRole,
  setUserSuspended,
  getPlayerDetail,
  type AdminUser,
  type PlayerDetail,
} from "@/app/(app)/admin/users/actions"

interface UsersPageClientProps {
  users: AdminUser[]
}

function shortDate(iso: string | null): string {
  if (!iso) return "never"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function pct(correct: number, total: number): string {
  if (!total) return "—"
  return `${Math.round((correct / total) * 100)}%`
}

/**
 * The register, with the account controls on it.
 *
 * Removing a player is irreversible and takes their attempts, runs, XP and
 * league standing with it, so a single tap must not be able to do it: the
 * button only arms a confirmation that names the account and counts what
 * goes, and the confirmation is what calls the action. Same shape as the
 * reset card on the profile page, for the same reason.
 *
 * Suspension sits next to it as the reversible option, because most of the
 * time "stop this person playing" is what is actually wanted and deleting
 * their history to achieve it is a loss.
 *
 * Admin pages are outside the i18n bundle by convention — the guard in
 * `npm run test:i18n` exempts this directory — so the copy here is English.
 */
export function UsersPageClient({ users }: UsersPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const reduce = useReducedMotion()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState<string>("all")
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, PlayerDetail>>({})
  const [detailBusy, setDetailBusy] = useState<string | null>(null)

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.displayName?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()) ||
                         (user.email?.toLowerCase() ?? "").includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === "all" || user.role === filterRole
    return matchesSearch && matchesRole
  })

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string; email?: string }>, done: string) {
    if (busyId) return
    setBusyId(id)
    const result = await fn()
    setBusyId(null)
    setConfirmingId(null)

    if (!result.ok) {
      toast({ variant: "destructive", title: "That did not work", description: result.error })
      return
    }
    toast({ title: `${done} ${result.email ?? ""}`.trim() })
    router.refresh()
  }

  async function toggleDetail(user: AdminUser) {
    if (openId === user.id) {
      setOpenId(null)
      return
    }
    setOpenId(user.id)
    if (detail[user.id]) return

    setDetailBusy(user.id)
    const result = await getPlayerDetail(user.id)
    setDetailBusy(null)
    if (!result.ok) {
      toast({ variant: "destructive", title: "Could not load that player", description: result.error })
      return
    }
    setDetail((prev) => ({ ...prev, [user.id]: result.detail }))
  }

  return (
    <div className="min-h-[100dvh] px-5 py-6 max-w-7xl mx-auto">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-primary mb-2">
          User Management
        </h1>
        <p className="text-on-surface-variant">
          {users.length} {users.length === 1 ? "account" : "accounts"}
          {users.some((u) => u.suspended) && ` · ${users.filter((u) => u.suspended).length} suspended`}
        </p>
      </motion.div>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-surface-container border border-white/10 rounded-lg text-on-surface placeholder:text-on-surface-variant/50"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          aria-label="Filter by role"
          className="px-4 py-2 bg-surface-container border border-white/10 rounded-lg text-on-surface"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="reviewer">Reviewer</option>
          <option value="user">User</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <PremiumCard className="p-8 text-center">
            <p className="text-on-surface-variant">No users found.</p>
          </PremiumCard>
        ) : (
          filteredUsers.map((user) => (
            <motion.div
              key={user.id}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PremiumCard className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">
                        {(user.displayName ?? "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-on-surface truncate">
                        {user.displayName ?? "Unknown"}
                        {user.isSelf && (
                          <span className="ml-2 text-xs font-normal text-on-surface-variant">(you)</span>
                        )}
                        {user.suspended && (
                          <span className="ml-2 rounded bg-error/15 px-2 py-0.5 text-xs font-semibold text-error">
                            suspended
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-on-surface-variant truncate">{user.email ?? "No email"}</p>
                      <p className="text-xs text-on-surface-variant/70">
                        Joined {shortDate(user.createdAt)} · Last seen {shortDate(user.lastSignInAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-primary">{user.totalXp} XP</p>
                      <p className="text-sm text-on-surface-variant">
                        {user.attempts} answered · {user.streakCount} day streak
                      </p>
                    </div>

                    {user.isSelf ? (
                      <PremiumBadge variant="primary">{user.role}</PremiumBadge>
                    ) : (
                      <select
                        value={user.role}
                        disabled={busyId !== null}
                        aria-label={`Role for ${user.displayName ?? user.email ?? "this account"}`}
                        onChange={(e) =>
                          run(user.id, () => setUserRole(user.id, e.target.value), "Role changed for")
                        }
                        className="px-3 py-2 bg-surface-container border border-white/10 rounded-lg text-sm text-on-surface disabled:opacity-50"
                      >
                        <option value="user">user</option>
                        <option value="reviewer">reviewer</option>
                        <option value="admin">admin</option>
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleDetail(user)}
                      aria-label={`Show detail for ${user.displayName ?? user.email ?? "this account"}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-white/5"
                    >
                      {detailBusy === user.id
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <ChevronDown className={`h-4 w-4 transition-transform ${openId === user.id ? "rotate-180" : ""}`} aria-hidden="true" />}
                      Detail
                    </button>

                    {!user.isSelf && (
                      <>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() =>
                            run(
                              user.id,
                              () => setUserSuspended(user.id, !user.suspended),
                              user.suspended ? "Restored" : "Suspended",
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white/5 disabled:opacity-50"
                        >
                          {user.suspended
                            ? <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            : <Ban className="h-4 w-4" aria-hidden="true" />}
                          {user.suspended ? "Restore" : "Suspend"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmingId(user.id)}
                          disabled={busyId !== null}
                          aria-label={`Remove ${user.displayName ?? user.email ?? "this account"}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-3 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/15 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {openId === user.id && detail[user.id] && (
                  <PlayerDetailPanel detail={detail[user.id]} />
                )}

                {confirmingId === user.id && (
                  <div className="mt-4 space-y-3 rounded-lg border border-error/40 bg-error/5 p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-error shrink-0" aria-hidden="true" />
                      <p className="font-semibold text-on-surface">
                        Remove {user.email ?? user.displayName ?? "this account"}?
                      </p>
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      This deletes the sign-in and everything attached to it: {user.attempts} answered{" "}
                      {user.attempts === 1 ? "question" : "questions"}, every run, {user.totalXp} XP,
                      achievements and league standing. It cannot be undone. Suspending keeps all of it
                      and still stops them signing in.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => run(user.id, () => deleteUser(user.id), "Removed")}
                        disabled={busyId !== null}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {busyId === user.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {busyId === user.id ? "Removing..." : "Remove permanently"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={busyId !== null}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-on-surface-variant transition-colors hover:bg-white/5 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </PremiumCard>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

/** What a support decision actually needs: not just who they are, but what
 * they have played and where their attention went. */
function PlayerDetailPanel({ detail }: { detail: PlayerDetail }) {
  const { totals, categories, runs, league } = detail

  return (
    <div className="mt-4 grid gap-4 rounded-lg border border-white/10 bg-surface-container/50 p-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
          Totals
        </h4>
        <dl className="space-y-1 text-sm">
          <Row k="Answered" v={String(totals.attempts)} />
          <Row k="Correct" v={`${totals.correct} (${pct(totals.correct, totals.attempts)})`} />
          <Row k="XP from answers" v={String(totals.xp_from_attempts)} />
          <Row k="First answer" v={shortDate(totals.first_seen)} />
          <Row k="Last answer" v={shortDate(totals.last_seen)} />
          <Row k="Language" v={detail.profile.preferred_language} />
          <Row k="Longest streak" v={`${detail.profile.longest_streak} days`} />
          <Row k="Coins" v={String(detail.profile.coins)} />
        </dl>
      </div>

      <div>
        <h4 className="mb-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
          Categories played
        </h4>
        {categories.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nothing answered yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {categories.map((c) => (
              <li key={c.name} className="flex justify-between gap-3">
                <span className="truncate text-on-surface">{c.name}</span>
                <span className="shrink-0 text-on-surface-variant">
                  {c.attempts} · {pct(c.correct, c.attempts)} · max tier {c.max_tier ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
          Recent runs
        </h4>
        {runs.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No runs recorded.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {runs.slice(0, 8).map((r, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate text-on-surface">{r.category ?? "Mixed"}</span>
                <span className="shrink-0 text-on-surface-variant">
                  {r.status} · {r.correct}/{r.correct + r.wrong} · {r.xp_earned} XP
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
          League history
        </h4>
        {league.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Never placed in a cohort.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {league.map((l) => (
              <li key={l.week_start} className="flex justify-between gap-3">
                <span className="text-on-surface">Week of {shortDate(l.week_start)}</span>
                <span className="shrink-0 text-on-surface-variant">
                  cohort {l.cohort} · {l.rank ? `rank ${l.rank}` : "unranked"}
                  {l.promoted ? " · promoted" : l.relegated ? " · relegated" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-on-surface-variant">{k}</dt>
      <dd className="text-on-surface">{v}</dd>
    </div>
  )
}
