import { AttemptStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

export interface AttemptsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AttemptStatus;
}

export const getQuizAttemptsForTeacher = async (
  quizId: string,
  teacherId: string,
  query: AttemptsQuery,
) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, teacherId: true, title: true, passingPercent: true },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 10));
  const skip = (page - 1) * pageSize;

  const where: Prisma.AttemptWhereInput = {
    quizId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          student: {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };

  const [total, attempts] = await Promise.all([
    prisma.attempt.count({ where }),
    prisma.attempt.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startedAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const data = attempts.map((att) => {
    const timeTakenSeconds =
      att.submittedAt && att.startedAt
        ? Math.max(0, Math.floor((att.submittedAt.getTime() - att.startedAt.getTime()) / 1000))
        : null;

    const passed =
      att.percentage !== null && att.percentage !== undefined
        ? att.percentage >= quiz.passingPercent
        : null;

    return {
      id: att.id,
      quizId: att.quizId,
      studentId: att.studentId,
      studentName: att.student.name,
      studentEmail: att.student.email,
      status: att.status,
      score: att.score,
      totalMarks: att.totalMarks,
      percentage: att.percentage,
      passed,
      tabSwitches: att.tabSwitches,
      startedAt: att.startedAt,
      submittedAt: att.submittedAt,
      timeTakenSeconds,
    };
  });

  return {
    data,
    page,
    pageSize,
    total,
  };
};

export const getAttemptReviewForTeacher = async (attemptId: string, teacherId: string) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
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

  if (attempt.quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to review this attempt');
  }

  const timeTakenSeconds =
    attempt.submittedAt && attempt.startedAt
      ? Math.max(0, Math.floor((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000))
      : 0;

  const passed =
    attempt.percentage !== null && attempt.percentage !== undefined
      ? attempt.percentage >= attempt.quiz.passingPercent
      : false;

  const answersMap = new Map<string, (typeof attempt.answers)[0]>();
  attempt.answers.forEach((ans) => answersMap.set(ans.questionId, ans));

  const questionsReview = attempt.quiz.questions.map((q) => {
    const ans = answersMap.get(q.id);
    return {
      id: q.id,
      text: q.text,
      type: q.type,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      explanation: q.explanation,
      order: q.order,
      selectedOptionIds: ans?.selectedOptionIds || [],
      isCorrect: ans?.isCorrect ?? false,
      marksAwarded: ans?.marksAwarded ?? 0,
      markedForReview: ans?.markedForReview ?? false,
      options: q.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        order: opt.order,
      })),
    };
  });

  return {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle: attempt.quiz.title,
    student: attempt.student,
    status: attempt.status,
    score: attempt.score ?? 0,
    totalMarks: attempt.totalMarks ?? 0,
    percentage: attempt.percentage ?? 0,
    passingPercent: attempt.quiz.passingPercent,
    passed,
    tabSwitches: attempt.tabSwitches,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeTakenSeconds,
    questions: questionsReview,
  };
};

export const getQuizAnalytics = async (quizId: string, teacherId: string) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: {
          options: true,
        },
      },
    },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  // Get all completed attempts
  const completedAttempts = await prisma.attempt.findMany({
    where: {
      quizId,
      status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] },
    },
    include: {
      answers: true,
    },
  });

  const totalAttempts = completedAttempts.length;

  // Initialise 10 buckets: 0-9%, 10-19%, ..., 90-100%
  const distribution = [
    { range: '0-9%', min: 0, max: 9.99, count: 0 },
    { range: '10-19%', min: 10, max: 19.99, count: 0 },
    { range: '20-29%', min: 20, max: 29.99, count: 0 },
    { range: '30-39%', min: 30, max: 39.99, count: 0 },
    { range: '40-49%', min: 40, max: 49.99, count: 0 },
    { range: '50-59%', min: 50, max: 59.99, count: 0 },
    { range: '60-69%', min: 60, max: 69.99, count: 0 },
    { range: '70-79%', min: 70, max: 79.99, count: 0 },
    { range: '80-89%', min: 80, max: 89.99, count: 0 },
    { range: '90-100%', min: 90, max: 100, count: 0 },
  ];

  if (totalAttempts === 0) {
    const questionAccuracy = quiz.questions.map((q) => ({
      questionId: q.id,
      text: q.text,
      type: q.type,
      marks: q.marks,
      totalAttempts: 0,
      correctAttempts: 0,
      accuracyPercentage: 0,
    }));

    return {
      quizId: quiz.id,
      quizTitle: quiz.title,
      attempts: 0,
      average: 0,
      highest: 0,
      lowest: 0,
      passRate: 0,
      distribution: distribution.map(({ range, count }) => ({ range, count })),
      questionAccuracy,
    };
  }

  let totalPercentage = 0;
  let highestPercentage = -Infinity;
  let lowestPercentage = Infinity;
  let passedCount = 0;

  // Track per-question correctness count
  const questionCorrectCount = new Map<string, number>();
  quiz.questions.forEach((q) => questionCorrectCount.set(q.id, 0));

  for (const att of completedAttempts) {
    const pct = att.percentage ?? 0;
    totalPercentage += pct;

    if (pct > highestPercentage) highestPercentage = pct;
    if (pct < lowestPercentage) lowestPercentage = pct;

    if (pct >= quiz.passingPercent) {
      passedCount += 1;
    }

    // Bucket distribution
    const bucket = distribution.find((b) => pct >= b.min && pct <= b.max);
    if (bucket) {
      bucket.count += 1;
    } else if (pct > 100) {
      distribution[distribution.length - 1].count += 1;
    }

    // Answer correctness
    for (const ans of att.answers) {
      if (ans.isCorrect && questionCorrectCount.has(ans.questionId)) {
        questionCorrectCount.set(
          ans.questionId,
          questionCorrectCount.get(ans.questionId)! + 1,
        );
      }
    }
  }

  const average = Math.round((totalPercentage / totalAttempts) * 100) / 100;
  const passRate = Math.round((passedCount / totalAttempts) * 10000) / 100;

  // Accuracy per question, sorted most missed first (ascending accuracy)
  const questionAccuracy = quiz.questions
    .map((q) => {
      const correct = questionCorrectCount.get(q.id) || 0;
      const accuracyPercentage =
        totalAttempts > 0
          ? Math.round((correct / totalAttempts) * 10000) / 100
          : 0;

      return {
        questionId: q.id,
        text: q.text,
        type: q.type,
        marks: q.marks,
        totalAttempts,
        correctAttempts: correct,
        accuracyPercentage,
      };
    })
    .sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    attempts: totalAttempts,
    average,
    highest: highestPercentage === -Infinity ? 0 : highestPercentage,
    lowest: lowestPercentage === Infinity ? 0 : lowestPercentage,
    passRate,
    distribution: distribution.map(({ range, count }) => ({ range, count })),
    questionAccuracy,
  };
};

export const exportQuizResultsCsv = async (quizId: string, teacherId: string): Promise<string> => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, teacherId: true, title: true, passingPercent: true },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to export this quiz');
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      quizId,
    },
    include: {
      student: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  const escapeCsv = (str: string | number | null | undefined): string => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headers = [
    'Student Name',
    'Student Email',
    'Status',
    'Score',
    'Total Marks',
    'Percentage',
    'Result',
    'Time Taken (seconds)',
    'Tab Switches',
    'Started At',
    'Submitted At',
  ];

  const rows = attempts.map((att) => {
    const timeTaken =
      att.submittedAt && att.startedAt
        ? Math.max(0, Math.floor((att.submittedAt.getTime() - att.startedAt.getTime()) / 1000))
        : '';

    const passed =
      att.percentage !== null && att.percentage !== undefined
        ? att.percentage >= quiz.passingPercent
          ? 'PASS'
          : 'FAIL'
        : 'N/A';

    return [
      escapeCsv(att.student.name),
      escapeCsv(att.student.email),
      escapeCsv(att.status),
      escapeCsv(att.score ?? ''),
      escapeCsv(att.totalMarks ?? ''),
      escapeCsv(att.percentage !== null && att.percentage !== undefined ? `${att.percentage}%` : ''),
      escapeCsv(passed),
      escapeCsv(timeTaken),
      escapeCsv(att.tabSwitches),
      escapeCsv(att.startedAt.toISOString()),
      escapeCsv(att.submittedAt ? att.submittedAt.toISOString() : ''),
    ].join(',');
  });

  // UTF-8 BOM prefix for Excel
  const bom = '\uFEFF';
  return bom + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
};
