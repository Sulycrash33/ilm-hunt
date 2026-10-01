import type { LucideIcon } from 'lucide-react';
import type { RankSlug } from '@/components/icons/RankEmblems';

export interface Rank {
  level: number;
  /**
   * Matches `rank_tiers.slug`, which is what the database keys on and what
   * `RANK_EMBLEMS` is keyed by.
   *
   * New. `Rank` carried a display `title` and nothing else identifying, so a
   * rank read off `profiles` and a rank derived here had no field in common
   * and could not be matched at all without comparing prose. `achievement-
   * rarity.ts` had already needed the ladder as slugs and had solved it by
   * writing all nine out again; it reads them from here now.
   */
  slug: RankSlug;
  title: string;
  icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
  theme: string;
  minPoints: number;
}

export interface Category {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color?: string;
}

export type QuestionType = 'multiple-choice' | 'true-false' | 'fill-in-the-blank';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  answer: string | boolean;
  explanation: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  points?: number;
  timeLimit?: number;
}

/**
 * A question as sent to the browser for a live quiz. Deliberately OMITS the
 * correct answer, explanation, and citation — those are only revealed by the
 * `submitAnswer` server action AFTER the player commits to a choice, so the
 * answer key can never be read from the client (devtools, network tab, etc.).
 */
export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  /** The question's actual database subject, including mixed-topic modes. */
  categoryName?: string;
  /**
   * The coarse three-way band, kept for display and for the XP the server
   * grants. The ladder no longer runs on this — see `tier`.
   */
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  /**
   * Which of the nine ranks this question is pitched at, 1 (Mubtadi) to 9
   * (Mujaddid). Mirrors `questions.tier`. This is what the Hunt ladder climbs.
   */
  tier: number;
  points: number;
  timeLimit: number;
}

/** Result returned by the server after grading a single answer. */
export interface GradeResult {
  correct: boolean;
  correctIndex: number;
  explanation: string;
  citation: string;
  xpEarned: number;
}

/**
 * An achievement that was earned *by this answer* — not one already held.
 * `submitAnswer` returns these so the game can congratulate the player in the
 * run itself, which is the only moment the reward means anything.
 */
export interface EarnedAchievement {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

// Achievement System Types
export interface Reward {
  coins: number;
  xp: number;
  badge?: string;
  title?: string;
}

export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  category: string;
  progress: number;
  target: number;
  completed: boolean;
  reward: Reward;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface Challenge {
  id: number;
  title: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  reward: Reward;
  timeLeft: string;
  completed: boolean;
}

// Category Detail Page Types
export interface Topic {
  id: string;
  name: string;
  description: string;
  questions: number;
  completed: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  unlocked: boolean;
}

export interface CategoryAchievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

export interface CategoryDetails {
  id: string;
  name: string;
  icon: string;
  description: string;
  difficulty: string;
  questions: number;
  completed: number;
  mastery: number;
  estimatedTime: string;
  xpReward: number;
  unlocked: boolean;
  color: string;
  topics: Topic[];
  achievements: CategoryAchievement[];
}

// Leaderboard Types
export interface LeaderboardUser {
  rank: number;
  name: string;
  points: number;
  rank_title: string;
  streak?: number;
  country: string;
  avatar: string;
  badge?: string;
  questionsAnswered?: number;
}

export interface CategoryLeader {
  category: string;
  icon: string;
  leader: string;
  points: number;
  rank_title: string;
  country: string;
}

// Reward Center Types
export interface SpinReward {
  id: number
  name: string
  icon: string
  probability: number
  value: number
  type: "coins" | "xp" | "lifeline" | "badge"
}

export interface DailyReward {
  day: number
  coins: number
  xp: number
  bonus: string | null
}
