'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { reviewQuestionQuality, type QualityQuestion, type QualityReport } from '@/lib/question-quality';

/**
 * The question console.
 *
 * The page this replaces selected every question with no limit. PostgREST
 * caps an unbounded response at 1,000 rows, so an administrator saw 1,000 of
 * 5,220 and nothing said so. Everything here is counted and sliced in the
 * database (`admin_list_questions`, migration 0033), which is the same fix
 * migration 0029 applied to the category grid.
 */

export interface AdminQuestion {
  id: string;
  text: string;
  category: string | null;
  categoryId: string | null;
  tier: number | null;
  difficulty: string;
  status: string;
  sourceType: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  citation: string | null;
  scholarApproved: boolean;
  reviewedAt: string | null;
}

export interface QuestionFilters {
  search?: string;
  categoryId?: string;
  tier?: number;
  status?: string;
  /** 'scholar' or 'unreviewed' — whether a person has vouched for it. */
  source?: string;
  limit?: number;
  offset?: number;
}

export type ListQuestionsResult =
  | { ok: true; questions: AdminQuestion[]; total: number }
  | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    throw new Error('Not authorized. This page is restricted to administrators.');
  }
  return { supabase };
}

/** Read-only, on-demand scan. Keyset paging avoids the API's 1,000-row ceiling. */
export async function getQuestionQualityReport(): Promise<
  { ok: true; report: QualityReport } | { ok: false; error: string }
> {
  try {
    const { supabase } = await requireAdmin();
    const questions: QualityQuestion[] = [];
    let cursor: string | null = null;
    let complete = false;
    const batchSize = 1_000;
    const maximum = 50_000;
    while (questions.length < maximum) {
      let query = supabase.from('questions')
        .select('id, question_text, choices, tier, category_id, categories(name)')
        .eq('review_status', 'published').order('id').limit(batchSize);
      if (cursor) query = query.gt('id', cursor);
      const { data, error } = await query;
      if (error) throw new Error('Could not scan the question bank. Please try again.');
      const rows = data ?? [];
      for (const row of rows as any[]) questions.push({
        id: row.id, text: row.question_text ?? '', choices: row.choices ?? [],
        category: row.categories?.name ?? null, categoryId: row.category_id ?? null,
        tier: row.tier ?? null,
      });
      if (rows.length < batchSize) { complete = true; break; }
      const nextCursor = rows[rows.length - 1].id as string;
      if (nextCursor === cursor) throw new Error('Question scan could not advance. Please try again.');
      cursor = nextCursor;
    }
    return { ok: true, report: {
      scanned: questions.length, complete, checkedAt: new Date().toISOString(),
      issues: reviewQuestionQuality(questions),
    } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not scan questions.' };
  }
}

export async function listQuestions(f: QuestionFilters = {}): Promise<ListQuestionsResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.rpc('admin_list_questions', {
      p_search: f.search?.trim() || null,
      p_category_id: f.categoryId || null,
      p_tier: f.tier ?? null,
      p_status: f.status || null,
      p_source: f.source || null,
      p_limit: f.limit ?? 25,
      p_offset: f.offset ?? 0,
    });
    if (error) return { ok: false, error: error.message };

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      total: rows.length > 0 ? Number(rows[0].o_total ?? 0) : 0,
      questions: rows.map((r) => ({
        id: String(r.o_id),
        text: String(r.o_question_text ?? ''),
        category: (r.o_category as string | null) ?? null,
        categoryId: (r.o_category_id as string | null) ?? null,
        tier: r.o_tier === null ? null : Number(r.o_tier),
        difficulty: String(r.o_difficulty ?? ''),
        status: String(r.o_status ?? ''),
        sourceType: String(r.o_source_type ?? ''),
        choices: (r.o_choices as string[]) ?? [],
        correctIndex: Number(r.o_correct_index ?? 0),
        explanation: (r.o_explanation as string | null) ?? null,
        citation: (r.o_citation as string | null) ?? null,
        scholarApproved: Boolean(r.o_scholar_ok),
        reviewedAt: (r.o_reviewed_at as string | null) ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not load questions.' };
  }
}

export interface QuestionSummary {
  total: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  categories: Array<{ id: string; name: string; total: number; scholar_approved: number }>;
}

export type SummaryResult =
  | { ok: true; summary: QuestionSummary }
  | { ok: false; error: string };

export async function getQuestionSummary(): Promise<SummaryResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.rpc('admin_question_summary');
    if (error) return { ok: false, error: error.message };
    return { ok: true, summary: data as QuestionSummary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not load the summary.' };
  }
}

export type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Marks a question reviewed.
 *
 * `scholarApproved` is a separate fact from `status` on purpose. Setting
 * `review_status` to the enum's `scholar_approved` value would make the
 * question unplayable — `submit_quiz_answer` accepts only `published` — so
 * approval is recorded in its own column and the question stays in the game.
 * See migration 0033.
 */
export async function reviewQuestion(
  questionId: string,
  opts: { status?: 'published' | 'rejected'; scholarApproved?: boolean },
): Promise<ReviewResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc('admin_set_question_status', {
      p_question_id: questionId,
      p_status: opts.status ?? null,
      p_scholar_approved: opts.scholarApproved ?? null,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin/questions');
    revalidatePath('/admin');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not update that question.' };
  }
}

export interface QuestionEdit {
  id: string;
  text: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
  citation?: string;
  tier?: number;
  categoryId?: string;
}

/**
 * Correcting a question in place.
 *
 * Until this existed the console could publish, reject and record scholar
 * approval, but could not fix a typo: a reviewer who spotted a wrong answer
 * could only reject the whole question.
 *
 * Editing clears scholar approval, in `admin_update_question` rather than
 * here, because what a scholar vouched for is no longer what the question
 * says. It does not unpublish: the question stays playable throughout, which
 * is the rule migration 0033 set and the reason approval got its own column.
 */
export async function editQuestion(edit: QuestionEdit): Promise<ReviewResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc('admin_update_question', {
      p_question_id: edit.id,
      p_text: edit.text,
      p_choices: edit.choices,
      p_correct_index: edit.correctIndex,
      p_explanation: edit.explanation ?? null,
      p_citation: edit.citation ?? null,
      p_tier: edit.tier ?? null,
      p_category_id: edit.categoryId ?? null,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin/questions');
    revalidatePath('/admin');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save that question.' };
  }
}

/**
 * Rewriting the explanation, and nothing else.
 *
 * Kept apart from `editQuestion` because the two are different acts.
 * `admin_update_question` can change the question, the choices and which one
 * is correct, so it withdraws scholar approval. This one cannot reach any of
 * those, so approval survives it (migration 0041).
 *
 * That distinction is what lets the explanations project and the review
 * project run in either order. Putting a rewrite of all 5,220 explanations
 * through the full editor would quietly un-approve every question it passed.
 */
export async function setQuestionExplanation(
  questionId: string,
  explanation: string,
  citation?: string,
): Promise<ReviewResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc('admin_set_question_explanation', {
      p_question_id: questionId,
      p_explanation: explanation,
      p_citation: citation ?? null,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin/questions');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save that explanation.' };
  }
}
