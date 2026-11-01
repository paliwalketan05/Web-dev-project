import { QuestionType } from '@prisma/client';

export interface ScorableOption {
  id: string;
  isCorrect: boolean;
}

export interface ScorableQuestion {
  id: string;
  type: QuestionType;
  marks: number;
  negativeMarks: number;
  options: ScorableOption[];
}

export interface StudentAnswerInput {
  questionId: string;
  selectedOptionIds: string[];
}

export interface PerQuestionScoreResult {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  marksAwarded: number;
}

export interface ScoringResult {
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  questionResults: PerQuestionScoreResult[];
}

export const calculateScore = (
  questions: ScorableQuestion[],
  studentAnswers: StudentAnswerInput[],
  passingPercent: number,
): ScoringResult => {
  // Map student answers by questionId for fast lookup
  const answerMap = new Map<string, string[]>();
  for (const ans of studentAnswers) {
    answerMap.set(ans.questionId, ans.selectedOptionIds || []);
  }

  let totalPossibleMarks = 0;
  let rawScore = 0;
  const questionResults: PerQuestionScoreResult[] = [];

  for (const question of questions) {
    totalPossibleMarks += question.marks;
    const selectedIds = answerMap.get(question.id) || [];

    // Filter to options that exist in the question to prevent malicious ids
    const validOptionIds = new Set(question.options.map((o) => o.id));
    const cleanSelectedIds = selectedIds.filter((id) => validOptionIds.has(id));

    const correctOptionIds = new Set(
      question.options.filter((o) => o.isCorrect).map((o) => o.id),
    );

    let isCorrect = false;
    let marksAwarded = 0;

    if (cleanSelectedIds.length === 0) {
      // No option selected
      isCorrect = false;
      marksAwarded = 0;
    } else if (question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE') {
      const selectedId = cleanSelectedIds[0];
      if (correctOptionIds.has(selectedId) && cleanSelectedIds.length === 1) {
        isCorrect = true;
        marksAwarded = question.marks;
      } else {
        isCorrect = false;
        marksAwarded = -Math.abs(question.negativeMarks);
      }
    } else if (question.type === 'MCQ_MULTI') {
      // Selected set must exactly equal correct set
      const selectedSet = new Set(cleanSelectedIds);
      const isExactMatch =
        selectedSet.size === correctOptionIds.size &&
        [...selectedSet].every((id) => correctOptionIds.has(id));

      if (isExactMatch) {
        isCorrect = true;
        marksAwarded = question.marks;
      } else {
        isCorrect = false;
        marksAwarded = -Math.abs(question.negativeMarks);
      }
    }

    rawScore += marksAwarded;
    questionResults.push({
      questionId: question.id,
      selectedOptionIds: cleanSelectedIds,
      isCorrect,
      marksAwarded,
    });
  }

  // The attempt total is the sum of per-question marks and is never below 0
  const finalScore = Math.max(0, Math.round(rawScore * 100) / 100);

  const percentage =
    totalPossibleMarks > 0
      ? Math.round((finalScore / totalPossibleMarks) * 10000) / 100
      : 0;

  const passed = percentage >= passingPercent;

  return {
    score: finalScore,
    totalMarks: totalPossibleMarks,
    percentage,
    passed,
    questionResults,
  };
};
