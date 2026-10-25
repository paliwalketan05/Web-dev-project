import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { CreateQuestionInput, UpdateQuestionInput } from '../schemas/question';

export const assertQuizUnlocked = async (quizId: string) => {
  const attemptsCount = await prisma.attempt.count({
    where: { quizId },
  });

  if (attemptsCount > 0) {
    throw AppError.conflict('Quiz is locked because student attempts already exist. Questions cannot be modified.');
  }
};

export const addQuestion = async (
  quizId: string,
  teacherId: string,
  input: CreateQuestionInput,
) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { teacherId: true },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  await assertQuizUnlocked(quizId);

  // Determine order if not specified
  let order = input.order;
  if (order === undefined) {
    const lastQuestion = await prisma.question.findFirst({
      where: { quizId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = (lastQuestion?.order ?? -1) + 1;
  }

  const question = await prisma.question.create({
    data: {
      quizId,
      text: input.text,
      type: input.type,
      marks: input.marks,
      negativeMarks: input.negativeMarks,
      explanation: input.explanation,
      order,
      options: {
        create: input.options.map((opt, idx) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          order: opt.order ?? idx,
        })),
      },
    },
    include: {
      options: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return question;
};

export const updateQuestion = async (
  questionId: string,
  teacherId: string,
  input: UpdateQuestionInput,
) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { quiz: { select: { id: true, teacherId: true } } },
  });

  if (!question) {
    throw AppError.notFound('Question not found');
  }

  if (question.quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this question');
  }

  await assertQuizUnlocked(question.quiz.id);

  // Update question and replace options in a transaction
  return prisma.$transaction(async (tx) => {
    if (input.options) {
      // Delete existing options
      await tx.option.deleteMany({
        where: { questionId },
      });

      // Create new options
      await tx.option.createMany({
        data: input.options.map((opt, idx) => ({
          questionId,
          text: opt.text,
          isCorrect: opt.isCorrect,
          order: opt.order ?? idx,
        })),
      });
    }

    const updated = await tx.question.update({
      where: { id: questionId },
      data: {
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.marks !== undefined ? { marks: input.marks } : {}),
        ...(input.negativeMarks !== undefined ? { negativeMarks: input.negativeMarks } : {}),
        ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
      },
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return updated;
  });
};

export const deleteQuestion = async (questionId: string, teacherId: string) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { quiz: { select: { id: true, teacherId: true } } },
  });

  if (!question) {
    throw AppError.notFound('Question not found');
  }

  if (question.quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this question');
  }

  await assertQuizUnlocked(question.quiz.id);

  await prisma.question.delete({
    where: { id: questionId },
  });

  return { message: 'Question deleted successfully' };
};

export const reorderQuestions = async (
  quizId: string,
  teacherId: string,
  orderedIds: string[],
) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { teacherId: true },
  });

  if (!quiz) {
    throw AppError.notFound('Quiz not found');
  }

  if (quiz.teacherId !== teacherId) {
    throw AppError.forbidden('You do not have access to this quiz');
  }

  await assertQuizUnlocked(quizId);

  // Update question orders in a transaction
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.question.update({
        where: { id, quizId },
        data: { order: index },
      }),
    ),
  );

  const updatedQuestions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: 'asc' },
    include: {
      options: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return updatedQuestions;
};
