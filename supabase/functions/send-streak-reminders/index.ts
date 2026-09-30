/**
 * Sends the daily streak reminders.
 *
 * Runs on Deno as a Supabase edge function because Web Push is not something
 * Postgres can do: each message needs a VAPID JWT signed with ES256 and a body
 * encrypted to the subscription's own key with ECDH + HKDF + AES-128-GCM. The
 * database decides *who* gets a message (`streak_reminder_candidates`); this
 * decides how to deliver it and records what happened.
 *
 * Invoked once a day by pg_cron via pg_net — see migration 0027.
 *
 * Two secrets are required and the function refuses to run without them:
 *   VAPID_PUBLIC_KEY   - the same key the browser subscribes with
 *   VAPID_PRIVATE_KEY  - the signing key; never leaves this function
 */

import webpush from "npm:web-push@3.6.7"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { authorizePrivilegedRequest } from "../_shared/privileged-request.ts"

interface Candidate {
  o_endpoint: string
  o_p256dh: string
  o_auth: string
  o_display_name: string
  o_streak: number
  o_language: string
}

/**
 * The reminder text, in the player's own language.
 *
 * Kept here rather than imported from the app's i18n bundle: an edge function
 * cannot reach into the Next.js source tree, and a notification with a missing
 * translation is worse than a short hardcoded one. Six languages, matching the
 * app's six.
 *
 * The tone is a nudge, not a threat. "Your streak ends today" is accurate and
 * enough — a learning app does not need to manufacture panic about a number.
 */
function message(lang: string, name: string, streak: number): { title: string; body: string } {
  const who = name ? name.split(" ")[0] : ""
  switch (lang) {
    case "ha":
      return {
        title: who ? `${who}, kwanaki ${streak} a jere` : `Kwanaki ${streak} a jere`,
        body: "Yau ce ranar da zai ƙare. Tambaya ɗaya kawai za ta ci gaba da shi.",
      }
    case "ar":
      return {
        title: who ? `${who}، ${streak} يوماً متتالياً` : `${streak} يوماً متتالياً`,
        body: "اليوم ينتهي إن لم تُجب. سؤال واحد يكفي لمواصلته.",
      }
    case "fr":
      return {
        title: who ? `${who}, ${streak} jours d'affilée` : `${streak} jours d'affilée`,
        body: "Votre série s'arrête aujourd'hui. Une seule question suffit à la garder.",
      }
    case "ms":
      return {
        title: who ? `${who}, ${streak} hari berturut-turut` : `${streak} hari berturut-turut`,
        body: "Rentetan anda tamat hari ini. Satu soalan sudah cukup untuk mengekalkannya.",
      }
    case "id":
      return {
        title: who ? `${who}, ${streak} hari beruntun` : `${streak} hari beruntun`,
        body: "Runtutanmu berakhir hari ini. Satu soal saja cukup untuk menjaganya.",
      }
    default:
      return {
        title: who ? `${who}, ${streak} days in a row` : `${streak} days in a row`,
        body: "Your streak ends today. One question keeps it going.",
      }
  }
}

Deno.serve(async (req) => {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) return Response.json({ error: "Supabase credentials missing" }, { status: 500 })
  const supabase = createClient(supabaseUrl, serviceKey)
  const denied = await authorizePrivilegedRequest(req, supabase)
  if (denied) return denied

  if (!publicKey || !privateKey || !supabaseUrl || !serviceKey) {
    // Fail loudly rather than silently sending nothing every day for a month.
    return new Response(
      JSON.stringify({ error: "Missing VAPID keys or Supabase credentials." }),
      { status: 500, headers: { "content-type": "application/json" } },
    )
  }

  // `mailto:` is required by the VAPID spec so a push service has somewhere to
  // report abuse. It is sent to the push service, never to the player.
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@ilmhunt.app",
    publicKey,
    privateKey,
  )

  const { data, error } = await supabase.rpc("streak_reminder_candidates")
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }

  const candidates = (data ?? []) as Candidate[]
  let sent = 0
  let gone = 0
  let failed = 0

  // Sequential on purpose. This runs once a day against a list that is short
  // by construction — only players whose streak breaks today — and a burst of
  // parallel requests to a push service is the fastest way to get rate
  // limited.
  for (const c of candidates) {
    const { title, body } = message(c.o_language, c.o_display_name, c.o_streak)
    try {
      await webpush.sendNotification(
        {
          endpoint: c.o_endpoint,
          keys: { p256dh: c.o_p256dh, auth: c.o_auth },
        },
        JSON.stringify({ title, body, lang: c.o_language, url: "/home" }),
        { TTL: 6 * 60 * 60 }, // Pointless to deliver after today is over.
      )
      sent += 1
      await supabase.rpc("record_push_result", {
        p_endpoint: c.o_endpoint,
        p_ok: true,
        p_gone: false,
      })
    } catch (err) {
      // 404 and 410 mean the subscription is genuinely dead — the browser was
      // uninstalled, the permission revoked, the endpoint expired. Those rows
      // are deleted rather than retried daily forever.
      const status = (err as { statusCode?: number }).statusCode
      const isGone = status === 404 || status === 410
      if (isGone) gone += 1
      else failed += 1
      await supabase.rpc("record_push_result", {
        p_endpoint: c.o_endpoint,
        p_ok: false,
        p_gone: isGone,
      })
    }
  }

  return new Response(JSON.stringify({ candidates: candidates.length, sent, gone, failed }), {
    headers: { "content-type": "application/json" },
  })
})
