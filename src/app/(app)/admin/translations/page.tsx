import { createClient } from "@/lib/supabase/server"
import { TranslationsPageClient } from "@/components/admin/TranslationsPageClient"
import { getTranslationProgress, getFailures, getTranslationWorkerStatus } from "./actions"

/**
 * Where the automatic translation runs are watched and corrected.
 *
 * Admin pages are English by convention and exempt from the i18n guard, which
 * is a little pointed on this one and still right: it is a control room, not
 * player-facing copy.
 */
export default async function TranslationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div className="flex items-center justify-center min-h-[100dvh]"><p>Please sign in to access admin.</p></div>
  }

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    return <div className="flex items-center justify-center min-h-[100dvh]"><p>Access denied. Admin only.</p></div>
  }

  const [progress, failures, worker] = await Promise.all([
    getTranslationProgress(), getFailures(50), getTranslationWorkerStatus(),
  ])

  // Counted in the database rather than fetched and measured here. PostgREST
  // caps an unbounded select at 1,000 rows, and this repository has been
  // bitten by that twice — with 5,220 questions and up to 26,100 translations,
  // any count taken by reading rows would be wrong and confident about it.
  const { count: questionCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "published")
    .eq("pool", "category")

  const { count: translatedCount } = await supabase
    .from("question_translations")
    .select("question_id", { count: "exact", head: true })

  return (
    <TranslationsPageClient
      progress={progress.ok ? progress.rows : []}
      progressError={progress.ok ? null : progress.error}
      failures={failures.ok ? failures.rows : []}
      publishedQuestions={questionCount ?? 0}
      translationsWritten={translatedCount ?? 0}
      workerStatus={worker.ok ? worker.status : null}
      workerError={worker.ok ? null : worker.error}
    />
  )
}
