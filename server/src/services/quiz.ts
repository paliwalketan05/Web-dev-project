import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError, ApiErrorDetail } from '../utils/errors';
import { CreateQuizInput, UpdateQuizInput, QuizListQuery } from '../schemas/quiz';
import { generateUniqueAccessCode } from './accessCode';

export const validateQuizForPublishing = async (quizId: string) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: {
          options: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  const errors: ApiErrorDetail[] = [];

  if (!quiz.title || quiz.title.trim() === '') {
    errors.push({ field: 'title', message: 'Quiz must have a title' });
  }

  if (quiz.durationMinutes < 1) {
    errors.push({ field: 'durationMinutes', message: 'Duration must be at least 1 minute' });
  }

  if (quiz.startsAt && quiz.endsAt && quiz.endsAt <= quiz.startsAt) {
    errors.push({ field: 'endsAt', message: 'End time must be after start time' });
  }

  if (quiz.maxAttempts < 1) {
    errors.push({ field: 'maxAttempts', message: 'Max attempts must be at least 1' });
  }

  if (quiz.passingPercent < 0 || quiz.passingPercent > 100) {
    errors.push({ field: 'passingPercent', message: 'Passing percentage must be between 0 and 100' });
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    errors.push({ field: 'questions', message: 'Quiz must contain at least one question' });
  }

  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    const questionNum = i + 1;
    const correctCount = q.options.filter((o) => o.isCorrect).length;

    if (q.type === 'MCQ_SINGLE') {
      if (q.options.length < 2) {
        errors.push({
          field: `question[${questionNum}]`,
          message: `Question ${questionNum} ("${q.text.slice(0, 30)}..."): Single choice must have at least 2 options`,
        });
      }
      if (correctCount !== 1) {
        errors.push({
          field: `question[${questionNum}]`,
          message: `Question ${questionNum} ("${q.text.slice(0, 30)}..."): Single choice must have exactly 1 correct option (found ${correctCount})`,
        });
      }
    } else if (q.type === 'MCQ_MULTI') {
      if (q.options.length < 2) {
        errors.push({
          field: `question[${questionNum}]`,
          message: `Question ${questionNum} ("${q.text.slice(0, 30)}..."): Multiple choice must have at least 2 options`,
        });
      }
      if (correctCount < 1) {
        errors.push({
          field: `question[${questionNum}]`,
          message: `Question ${questionNum} ("${q.text.slice(0, 30)}..."): Multiple choice must have at least 1 correct option`,
        });
      }
    } else if (q.type === 'TRUE_FALSE') {
      if (q.options.length !== 2) {
        errors.push({
          field: `question[${questionNum}]`,
          message: `Question ${questionNum} ("${q.text.slice(0, 30)}..."): True/False question must have exactly 2 options (True and False)`,
        });
      }
      if (correctCount !== 1) {
        errors.push({
          field: `question[${questionNum}]`,
          message: `Question ${questionNum} ("${q.text.slice(0, 30)}..."): True/False must have exactly 1 correct option`,
        });
      }
    }
  }

  if (errors.length > 0) {
    throw AppError.badRequest('Quiz validation failed for publishing', errors);
  }

  return quiz;
};

export const createQuiz = async (teacherId: string, input: CreateQuizInput) => {
  const accessCode = await generateUniqueAccessCode();

  const quiz = await prisma.quiz.create({
    data: {
      title: input.title,
      description: input.description,
      accessCode,
      teacherId,
      durationMinutes: input.durationMinutes,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      maxAttempts: input.maxAttempts,
      passingPercent: input.passingPercent,
      shuffleQuestions: input.shuffleQuestions,
      shuffleOptions: input.shuffleOptions,
      showResultsImmediately: input.showResultsImmediately,
      isPublished: false,
    },
    include: {
      questions: {
        include: { options: true },
      },
    },
  });

  return quiz;
};

export const getTeacherQuizzes = async (teacherId: string, query: QuizListQuery) => {
  const { page, pageSize, search } = query;
  const skip = (page - 1) * pageSize;

  const where: Prisma.QuizWhereInput = {
    teacherId,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { accessCode: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, data] = await Promise.all([
    prisma.quiz.count({ where }),
    prisma.quiz.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            questions: true,
            attempts: true,
          },
        },
      },
    }),
  ]);

  return {
    data,
    page,
    pageSize,
    total,
  };
};

export const getTeacherQuizById = async (quizId: string, teacherId: string) => {
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
      _count: {
        select: {
          attempts: true,
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

  return quiz;
};

export const updateQuizSettings = async (quizId: string, teacherId: string, input: UpdateQuizInput) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      _count: { select: { attempts: true } },
    },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
      ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts } : {}),
      ...(input.passingPercent !== undefined ? { passingPercent: input.passingPercent } : {}),
      ...(input.shuffleQuestions !== undefined ? { shuffleQuestions: input.shuffleQuestions } : {}),
      ...(input.shuffleOptions !== undefined ? { shuffleOptions: input.shuffleOptions } : {}),
      ...(input.showResultsImmediately !== undefined ? { showResultsImmediately: input.showResultsImmediately } : {}),
    },
  });

  return updated;
};

export const deleteQuiz = async (quizId: string, teacherId: string) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  await prisma.quiz.delete({
    where: { id: quizId },
  });

  return { message: 'Quiz deleted successfully' };
};

export const setPublishState = async (quizId: string, teacherId: string, isPublished: boolean) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  if (isPublished) {
    // Run full validation
    await validateQuizForPublishing(quizId);
  }

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: { isPublished },
  });

  return updated;
};

export const setResultsVisibility = async (
  quizId: string,
  teacherId: string,
  showResultsImmediately: boolean,
) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: { showResultsImmediately },
  });

  return updated;
};

export const regenerateAccessCode = async (quizId: string, teacherId: string) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  const newCode = await generateUniqueAccessCode();

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: { accessCode: newCode },
  });

  return updated;
};
