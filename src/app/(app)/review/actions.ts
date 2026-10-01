"use server";

import { createClient } from "@/lib/supabase/server";
import { localiseQuestions } from "@/lib/quiz-service";
import type { QuizQuestion } from "@/lib/types";

/**
 * Spaced review.
 *
 * `user_question_schedule` (migration 0009) holds a due date per question per
 * player, maintained by an SM-2 trigger on `attempts`. These read from it.
 *
 * The same rule as the rest of the quiz applies: a question fetched for review
 * never carries its own answer. `correct_choice_index`, `explanation` and
 * `citation_reference` stay in the database until `submitAnswer` grades a
 * committed choice.
 */

/** How many questions one review session serves at most. Not exported: a
 * "use server" module may only export async functions. */
const REVIEW_SESSION_SIZE = 15;

export interface ReviewStatus {
  /** Questions due today or earlier. */
  due: number;
  /** Questions scheduled but not yet due — the pipeline behind today. */
  scheduled: number;
  /** The soonest upcoming due date, when nothing is due right now. */
  nextDueOn: string | null;
}

export async function getReviewStatus(): Promise<ReviewStatus> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw new Error("Could not authenticate review request");
  if (!user) return { due: 0, scheduled: 0, nextDueOn: null };

  // The existing SM-2 trigger stores due dates against the database's UTC day.
  const today = new Date().toISOString().slice(0, 10);

  const [dueResult, scheduledResult, nextResult] = await Promise.all([
    supabase
      .from("user_question_schedule")
      .select("question_id, questions!inner(id)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("questions.review_status", "published")
      .lte("due_on", today),
    supabase
      .from("user_question_schedule")
      .select("question_id, questions!inner(id)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("questions.review_status", "published")
      .gt("due_on", today),
    supabase
      .from("user_question_schedule")
      .select("due_on, questions!inner(id)")
      .eq("user_id", user.id)
      .eq("questions.review_status", "published")
      .gt("due_on", today)
      .order("due_on")
      .limit(1),
  ]);

  if (dueResult.error || scheduledResult.error || nextResult.error) throw new Error("Could not load review status");
  return {
    due: dueResult.count ?? 0,
    scheduled: scheduledResult.count ?? 0,
    nextDueOn: nextResult.data?.[0]?.due_on ?? null,
  };
}

/**
 * The questions due for review, oldest due date first so the most overdue come
 * back soonest.
 *
 * Only published questions are returned: a question pulled from circulation
 * after a player answered it should not reappear in their review queue.
 */
export async function getDueReviewQuestions(
  limit: number = REVIEW_SESSION_SIZE,
): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw new Error("Could not authenticate review request");
  if (!user) return [];

  const today = new Date().toISOString().slice(0, 10);
  const sessionLimit = Number.isFinite(limit) ? Math.max(1, Math.min(REVIEW_SESSION_SIZE, Math.floor(limit))) : REVIEW_SESSION_SIZE;

  const { data, error } = await supabase
    .from("user_question_schedule")
    .select("question_id, due_on, questions!inner(id, question_text, choices, difficulty, tier, review_status)")
    .eq("user_id", user.id)
    .lte("due_on", today)
    .eq("questions.review_status", "published")
    .order("due_on")
    .order("question_id")
    .limit(sessionLimit);

  if (error) throw new Error("Could not load review questions");
  return localiseQuestions((data ?? []).map((row: any) => row.questions));
}

export interface ReviewSession {
  questions: QuizQuestion[];
  status: ReviewStatus;
}

export async function getReviewSession(): Promise<ReviewSession> {
  const [questions, status] = await Promise.all([getDueReviewQuestions(), getReviewStatus()]);
  return { questions, status };
}
