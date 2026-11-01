import { AttemptStatus, QuestionType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { seededShuffle } from '../utils/shuffle';
import { calculateScore, ScorableQuestion } from './scoring';
import { SaveAnswerInput } from '../schemas/attempt';

const GRACE_PERIOD_MS = 5000; // 5 seconds grace period for in-flight requests

export const joinQuizByCode = async (rawCode: string, studentId: string) => {
  const code = rawCode.trim().toUpperCase();

  const quiz = await prisma.quiz.findUnique({
    where: { accessCode: code },
    include: {
      _count: { select: { questions: true } },
    },
  });

  if (!quiz || !quiz.isPublished) {
    throw AppError.notFound('Quiz not found or is not currently published');
  }

  // Check attempt counts for student
  const [completedAttemptsCount, inProgressAttempt] = await Promise.all([
    prisma.attempt.count({
      where: {
        quizId: quiz.id,
        studentId,
        status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] },
      },
    }),
    prisma.attempt.findFirst({
      where: {
        quizId: quiz.id,
        studentId,
        status: AttemptStatus.IN_PROGRESS,
      },
      select: { id: true, expiresAt: true },
    }),
  ]);

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    durationMinutes: quiz.durationMinutes,
    startsAt: quiz.startsAt,
    endsAt: quiz.endsAt,
    maxAttempts: quiz.maxAttempts,
    passingPercent: quiz.passingPercent,
    totalQuestions: quiz._count.questions,
    attemptsUsed: completedAttemptsCount,
    hasInProgressAttempt: !!inProgressAttempt,
    inProgressAttemptId: inProgressAttempt?.id ?? null,
  };
};

export const startOrResumeAttempt = async (quizId: string, studentId: string) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (!quiz.isPublished) {
    throw AppError.badRequest('Quiz is not currently published');
  }

  const now = new Date();

  // Check schedule window
  if (quiz.startsAt && now < quiz.startsAt) {
    throw AppError.badRequest('Quiz has not started yet');
  }
  if (quiz.endsAt && now > quiz.endsAt) {
    throw AppError.badRequest('Quiz window has closed');
  }

  // Check for existing IN_PROGRESS attempt
  const existingAttempt = await prisma.attempt.findFirst({
    where: {
      quizId,
      studentId,
      status: AttemptStatus.IN_PROGRESS,
    },
    include: {
      answers: true,
    },
  });

  if (existingAttempt) {
    // If expired beyond grace period, auto-submit and proceed to max attempts check
    if (now.getTime() > existingAttempt.expiresAt.getTime() + GRACE_PERIOD_MS) {
      await submitAttempt(existingAttempt.id, studentId, true);
    } else {
      // Resume existing attempt
      return formatAttemptPayload(quiz, existingAttempt);
    }
  }

  // Count finished attempts
  const finishedAttemptsCount = await prisma.attempt.count({
    where: {
      quizId,
      studentId,
      status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] },
    },
  });

  if (finishedAttemptsCount >= quiz.maxAttempts) {
    throw AppError.conflict('Maximum attempt limit reached for this quiz');
  }

  // Calculate expiresAt = min(now + duration, endsAt)
  const durationMs = quiz.durationMinutes * 60 * 1000;
  let expiresAt = new Date(now.getTime() + durationMs);
  if (quiz.endsAt && quiz.endsAt < expiresAt) {
    expiresAt = quiz.endsAt;
  }

  // Generate random integer seed
  const seed = Math.floor(Math.random() * 1000000);

  const attempt = await prisma.attempt.create({
    data: {
      quizId,
      studentId,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: now,
      expiresAt,
      seed,
    },
    include: {
      answers: true,
    },
  });

  return formatAttemptPayload(quiz, attempt);
};

export const getAttemptState = async (attemptId: string, studentId: string) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: {
              options: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt) {
    throw AppError.notFound('Attempt not found');
  }

  if (attempt.studentId !== studentId) {
    throw AppError.forbidden('You do not have access to this attempt');
  }

  const now = new Date();

  // Lazy auto-submit if expired
  if (
    attempt.status === AttemptStatus.IN_PROGRESS &&
    now.getTime() > attempt.expiresAt.getTime() + GRACE_PERIOD_MS
  ) {
    const finalResult = await submitAttempt(attemptId, studentId, true);
    return {
      attempt: {
        ...attempt,
        status: AttemptStatus.AUTO_SUBMITTED,
        submittedAt: now,
      },
      isExpired: true,
      result: finalResult,
      serverNow: now.toISOString(),
    };
  }

  return formatAttemptPayload(attempt.quiz, attempt);
};

export const saveAnswer = async (
  attemptId: string,
  studentId: string,
  input: SaveAnswerInput,
) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          questions: {
            where: { id: input.questionId },
            include: { options: true },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw AppError.notFound('Attempt not found');
  }

  if (attempt.studentId !== studentId) {
    throw AppError.forbidden('You do not have access to this attempt');
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw AppError.conflict('Attempt is already submitted');
  }

  const now = new Date();

  // Check if expired
  if (now.getTime() > attempt.expiresAt.getTime() + GRACE_PERIOD_MS) {
    await submitAttempt(attemptId, studentId, true);
    throw AppError.conflict('Quiz attempt time expired. Attempt has been auto-submitted.');
  }

  const question = attempt.quiz.questions[0];
  if (!question) {
    throw AppError.notFound('Question not found in this quiz');
  }

  // Validate that selectedOptionIds belong to the question
  const validOptionIds = new Set(question.options.map((o) => o.id));
  const invalidIds = input.selectedOptionIds.filter((id) => !validOptionIds.has(id));
  if (invalidIds.length > 0) {
    throw AppError.badRequest('One or more selected options do not belong to this question');
  }

  const answer = await prisma.answer.upsert({
    where: {
      attemptId_questionId: {
        attemptId,
        questionId: input.questionId,
      },
    },
    create: {
      attemptId,
      questionId: input.questionId,
      selectedOptionIds: input.selectedOptionIds,
      markedForReview: input.markedForReview,
    },
    update: {
      selectedOptionIds: input.selectedOptionIds,
      markedForReview: input.markedForReview,
    },
  });

  return answer;
};

export const recordTabSwitch = async (attemptId: string, studentId: string) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, studentId: true, status: true, tabSwitches: true },
  });

  if (!attempt) {
    throw AppError.notFound('Attempt not found');
  }

  if (attempt.studentId !== studentId) {
    throw AppError.forbidden('You do not have access to this attempt');
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    return { tabSwitches: attempt.tabSwitches };
  }

  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: { tabSwitches: { increment: 1 } },
    select: { tabSwitches: true },
  });

  return updated;
};

export const submitAttempt = async (
  attemptId: string,
  studentId?: string,
  autoSubmitted = false,
) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          questions: {
            include: { options: true },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt) {
    throw AppError.notFound('Attempt not found');
  }

  // Verify ownership if studentId is provided
  if (studentId && attempt.studentId !== studentId) {
    throw AppError.forbidden('You do not have access to this attempt');
  }

  // Idempotent: if already submitted, return current result
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    return getAttemptResult(attemptId, attempt.studentId);
  }

  const scorableQuestions: ScorableQuestion[] = attempt.quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    marks: q.marks,
    negativeMarks: q.negativeMarks,
    options: q.options.map((o) => ({
      id: o.id,
      isCorrect: o.isCorrect,
    })),
  }));

  const studentAnswers = attempt.answers.map((a) => ({
    questionId: a.questionId,
    selectedOptionIds: a.selectedOptionIds,
  }));

  const scoring = calculateScore(
    scorableQuestions,
    studentAnswers,
    attempt.quiz.passingPercent,
  );

  const status = autoSubmitted ? AttemptStatus.AUTO_SUBMITTED : AttemptStatus.SUBMITTED;
  const submittedAt = new Date();

  // Update attempt and answers in transaction
  await prisma.$transaction(async (tx) => {
    await tx.attempt.update({
      where: { id: attemptId },
      data: {
        status,
        submittedAt,
        score: scoring.score,
        totalMarks: scoring.totalMarks,
        percentage: scoring.percentage,
      },
    });

    // Save answer evaluation for every question (including unanswered ones)
    for (const qResult of scoring.questionResults) {
      await tx.answer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: qResult.questionId,
          },
        },
        create: {
          attemptId,
          questionId: qResult.questionId,
          selectedOptionIds: qResult.selectedOptionIds,
          isCorrect: qResult.isCorrect,
          marksAwarded: qResult.marksAwarded,
          markedForReview: false,
        },
        update: {
          isCorrect: qResult.isCorrect,
          marksAwarded: qResult.marksAwarded,
        },
      });
    }
  });

  return getAttemptResult(attemptId, attempt.studentId);
};

export const getAttemptResult = async (attemptId: string, studentId: string) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: {
              options: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt) {
    throw AppError.notFound('Attempt not found');
  }

  if (attempt.studentId !== studentId) {
    throw AppError.forbidden('You do not have access to this attempt');
  }

  if (attempt.status === AttemptStatus.IN_PROGRESS) {
    throw AppError.badRequest('Attempt has not been submitted yet');
  }

  const timeTakenSeconds =
    attempt.submittedAt && attempt.startedAt
      ? Math.max(0, Math.floor((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000))
      : 0;

  // Visibility check: Section 7.8
  if (!attempt.quiz.showResultsImmediately) {
    return {
      id: attempt.id,
      quizId: attempt.quizId,
      quizTitle: attempt.quiz.title,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      showResultsImmediately: false,
      message: 'Submitted. Your teacher will release results.',
    };
  }

  const answersMap = new Map<string, (typeof attempt.answers)[0]>();
  attempt.answers.forEach((a) => answersMap.set(a.questionId, a));

  const questionsReview = attempt.quiz.questions.map((q) => {
    const ans = answersMap.get(q.id);
    return {
      id: q.id,
      text: q.text,
      type: q.type,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      explanation: q.explanation,
      selectedOptionIds: ans?.selectedOptionIds || [],
      isCorrect: ans?.isCorrect ?? false,
      marksAwarded: ans?.marksAwarded ?? 0,
      options: q.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
      })),
    };
  });

  return {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle: attempt.quiz.title,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeTakenSeconds,
    score: attempt.score ?? 0,
    totalMarks: attempt.totalMarks ?? 0,
    percentage: attempt.percentage ?? 0,
    passingPercent: attempt.quiz.passingPercent,
    passed: (attempt.percentage ?? 0) >= attempt.quiz.passingPercent,
    tabSwitches: attempt.tabSwitches,
    showResultsImmediately: true,
    questions: questionsReview,
  };
};

interface StudentQuizSummary {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    durationMinutes: number;
    accessCode: string;
    totalQuestions: number;
    startsAt: Date | null;
    endsAt: Date | null;
    maxAttempts: number;
    passingPercent: number;
  };
  latestAttempt: {
    id: string;
    status: AttemptStatus;
    score: number | null;
    percentage: number | null;
    startedAt: Date;
    submittedAt: Date | null;
  };
  attemptsCount: number;
}

export const getStudentQuizzes = async (studentId: string) => {
  // Quizzes the student has attempted
  const attempts = await prisma.attempt.findMany({
    where: { studentId },
    include: {
      quiz: {
        include: {
          _count: { select: { questions: true } },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  // Group by quiz
  const quizMap = new Map<string, StudentQuizSummary>();
  for (const att of attempts) {
    if (!quizMap.has(att.quizId)) {
      quizMap.set(att.quizId, {
        quiz: {
          id: att.quiz.id,
          title: att.quiz.title,
          description: att.quiz.description,
          durationMinutes: att.quiz.durationMinutes,
          accessCode: att.quiz.accessCode,
          totalQuestions: att.quiz._count.questions,
          startsAt: att.quiz.startsAt,
          endsAt: att.quiz.endsAt,
          maxAttempts: att.quiz.maxAttempts,
          passingPercent: att.quiz.passingPercent,
        },
        latestAttempt: {
          id: att.id,
          status: att.status,
          score: att.score,
          percentage: att.percentage,
          startedAt: att.startedAt,
          submittedAt: att.submittedAt,
        },
        attemptsCount: 1,
      });
    } else {
      const existing = quizMap.get(att.quizId);
      if (existing) {
        existing.attemptsCount += 1;
      }
    }
  }

  return Array.from(quizMap.values());
};

export const getStudentAttempts = async (studentId: string) => {
  const attempts = await prisma.attempt.findMany({
    where: { studentId },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          passingPercent: true,
          showResultsImmediately: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  return attempts.map((att) => {
    const isVisible = att.quiz.showResultsImmediately && att.status !== AttemptStatus.IN_PROGRESS;
    return {
      id: att.id,
      quizId: att.quiz.id,
      quizTitle: att.quiz.title,
      status: att.status,
      startedAt: att.startedAt,
      submittedAt: att.submittedAt,
      score: isVisible ? att.score : null,
      totalMarks: isVisible ? att.totalMarks : null,
      percentage: isVisible ? att.percentage : null,
      passed: isVisible ? (att.percentage ?? 0) >= att.quiz.passingPercent : null,
      showResultsImmediately: att.quiz.showResultsImmediately,
    };
  });
};

interface QuestionForPayload {
  id: string;
  text: string;
  type: QuestionType;
  marks: number;
  negativeMarks: number;
  options: { id: string; text: string; order: number }[];
}

interface QuizForPayload {
  title: string;
  durationMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questions: QuestionForPayload[];
}

interface AttemptForPayload {
  id: string;
  quizId: string;
  status: AttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  tabSwitches: number;
  seed: number;
  answers?: {
    questionId: string;
    selectedOptionIds: string[];
    markedForReview: boolean;
  }[];
}

const formatAttemptPayload = (quiz: QuizForPayload, attempt: AttemptForPayload) => {
  let questions = [...quiz.questions];

  // Seeded shuffle of questions if enabled
  if (quiz.shuffleQuestions) {
    questions = seededShuffle(questions, attempt.seed);
  }

  // Options delivery: NEVER include isCorrect or explanation
  const sanitizedQuestions = questions.map((q, idx) => {
    let options = [...q.options];
    if (quiz.shuffleOptions) {
      options = seededShuffle(options, attempt.seed + idx + 1);
    }
    return {
      id: q.id,
      text: q.text,
      type: q.type,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      options: options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        order: opt.order,
      })),
    };
  });

  return {
    attempt: {
      id: attempt.id,
      quizId: attempt.quizId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      tabSwitches: attempt.tabSwitches,
    },
    quizTitle: quiz.title,
    durationMinutes: quiz.durationMinutes,
    questions: sanitizedQuestions,
    savedAnswers: (attempt.answers || []).map((ans) => ({
      questionId: ans.questionId,
      selectedOptionIds: ans.selectedOptionIds,
      markedForReview: ans.markedForReview,
    })),
    expiresAt: attempt.expiresAt,
    serverNow: new Date().toISOString(),
  };
};
