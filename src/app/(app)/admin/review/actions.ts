'use server';

import { createClient } from '@/lib/supabase/server';
import { draftQuestions } from '@/ai/flows/draft-questions';
import { revalidatePath } from 'next/cache';
import { reviewEditSchema, type ReviewEdit } from '@/lib/question-review';

async function requireReviewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not signed in.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'reviewer' && profile.role !== 'admin')) {
    throw new Error('Not authorized. This page is restricted to content reviewers.');
  }

  return { supabase, userId: user.id };
}

export type GenerateResult =
  | { ok: true; draftedCount: number }
  | { ok: false; error: string };

export async function generateDraftQuestions(formData: FormData): Promise<GenerateResult> {
  try {
    // No `userId` here any more: nothing in this function records a reviewer,
    // because drafting is not reviewing.
    const { supabase } = await requireReviewer();

    const categoryId = String(formData.get('categoryId') ?? '');
    const categoryName = String(formData.get('categoryName') ?? '');
    const count = Number(formData.get('count') ?? 5);
    const difficulty = String(formData.get('difficulty') ?? 'medium') as 'easy' | 'medium' | 'hard';
    const language = String(formData.get('language') ?? 'en') as 'ha' | 'en' | 'fr' | 'ar' | 'id' | 'ms';

    if (!categoryId || !categoryName) {
      return { ok: false, error: 'Missing category.' };
    }

    const { questions } = await draftQuestions({ categoryName, count, difficulty, language });

    if (questions.length === 0) {
      return { ok: false, error: 'The model could not produce any citable questions for this batch. Try a smaller count or a different category.' };
    }

    const rows = questions.map(q => ({
      category_id: categoryId,
      difficulty,
      language,
      madhab_tag: q.madhabTag,
      question_text: q.questionText,
      choices: q.choices,
      correct_choice_index: q.correctChoiceIndex,
      explanation: q.explanation,
      citation_reference: q.citationReference + (q.confidenceFlag === 'needs_scholar_verification' ? ' [AI: please verify]' : ''),
      source_type: 'ai_drafted',
      // Always enters the queue. There used to be an `autoPublish` flag here
      // that sent a freshly drafted question straight to `published` with the
      // generating admin recorded as its reviewer — a model marking its own
      // homework, on Islamic content, which is the one thing this project
      // says it will not do. A draft is reviewed by a person or it is not
      // published.
      review_status: 'ai_drafted' as const,
    }));

    const { error } = await supabase.from('questions').insert(rows);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath('/admin/review');
    return { ok: true, draftedCount: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error.' };
  }
}

export async function approveQuestion(
  questionId: string,
  edited: ReviewEdit
) {
  const { supabase, userId } = await requireReviewer();
  const parsed = reviewEditSchema.safeParse(edited);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const valid = parsed.data;

  const { data, error } = await supabase
    .from('questions')
    .update({
      question_text: valid.questionText,
      choices: valid.choices,
      correct_choice_index: valid.correctChoiceIndex,
      explanation: valid.explanation,
      citation_reference: valid.citationReference,
      madhab_tag: valid.madhabTag,
      review_status: 'published',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', questionId)
    .eq('review_status', 'ai_drafted')
    .select('id');

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('This question is no longer pending review. Refresh the queue.');
  revalidatePath('/admin/review');
}

export async function rejectQuestion(questionId: string) {
  const { supabase, userId } = await requireReviewer();

  const { data, error } = await supabase
    .from('questions')
    .update({
      review_status: 'rejected',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', questionId)
    .eq('review_status', 'ai_drafted')
    .select('id');

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('This question is no longer pending review. Refresh the queue.');
  revalidatePath('/admin/review');
}
