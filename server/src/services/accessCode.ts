import { prisma } from '../utils/prisma';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateRawAccessCode = (): string => {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }
  return code;
};

export const generateUniqueAccessCode = async (maxRetries = 10): Promise<string> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateRawAccessCode();
    const existing = await prisma.quiz.findUnique({
      where: { accessCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique access code after multiple attempts');
};
