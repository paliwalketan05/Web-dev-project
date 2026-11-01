import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/utils/prisma';

describe('QuizArena Backend API Integration Tests', () => {
  const timestamp = Date.now();
  let teacherToken: string;
  let teacherId: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let studentId: string;
  let quizId: string;
  let accessCode: string;
  let qSingleId: string;
  let qMultiId: string;
  let qTfId: string;
  let qSingleCorrectOptId: string;
  let qSingleWrongOptId: string;
  let qMultiOpt1Id: string;
  let qMultiOpt2Id: string;
  let qTfCorrectOptId: string;
  let attemptId: string;

  beforeAll(async () => {
    // Register Teacher 1
    const resT1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Primary Teacher',
        email: `teacher_int_${timestamp}@example.com`,
        password: 'Password123',
        role: 'TEACHER',
      });
    expect(resT1.status).toBe(201);
    teacherToken = resT1.body.token;
    teacherId = resT1.body.user.id;

    // Register Teacher 2 (for ownership tests)
    const resT2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Secondary Teacher',
        email: `teacher2_int_${timestamp}@example.com`,
        password: 'Password123',
        role: 'TEACHER',
      });
    expect(resT2.status).toBe(201);
    otherTeacherToken = resT2.body.token;

    // Register Student
    const resS = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Integration Student',
        email: `student_int_${timestamp}@example.com`,
        password: 'Password123',
        role: 'STUDENT',
      });
    expect(resS.status).toBe(201);
    studentToken = resS.body.token;
    studentId = resS.body.user.id;
  });

  describe('1. Authentication and Authorization', () => {
    it('16. Register: Rejects duplicate email with 409 CONFLICT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: `student_int_${timestamp}@example.com`,
          password: 'Password123',
          role: 'STUDENT',
        });
      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('CONFLICT');
    });

    it('17. Login: Rejects invalid password with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `student_int_${timestamp}@example.com`,
          password: 'WrongPassword99',
        });
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('18. Login: Succeeds with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `student_int_${timestamp}@example.com`,
          password: 'Password123',
        });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(`student_int_${timestamp}@example.com`);
    });

    it('19. /me: Returns current user from token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(studentId);
      expect(res.body.role).toBe('STUDENT');
    });

    it('20. Role Guards: Student calling Teacher route receives 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/teacher/stats')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('21. Role Guards: Teacher calling Student route receives 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/student/quizzes')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('22. Protected routes: Rejects missing Authorization header with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Teacher Quiz Management & Publish Validation', () => {
    it('23. Teacher can create a quiz (created unpublished with 6-char code)', async () => {
      const res = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Full Lifecycle Integration Quiz',
          description: 'Testing complete quiz flow from creation to analysis',
          durationMinutes: 10,
          maxAttempts: 1,
          passingPercent: 50,
          showResultsImmediately: false, // Initially false to test visibility release!
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.accessCode).toHaveLength(6);
      expect(res.body.isPublished).toBe(false);

      quizId = res.body.id;
      accessCode = res.body.accessCode;
    });

    it('24. Publish Validation: Rejects publishing quiz without questions with 400', async () => {
      const res = await request(app)
        .patch(`/api/quizzes/${quizId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isPublished: true });
      expect(res.status).toBe(400);
      expect(res.body.error?.details).toBeDefined();
    });

    it('25. Teacher adds questions of all three types', async () => {
      // 1. MCQ_SINGLE
      const resSingle = await request(app)
        .post(`/api/quizzes/${quizId}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          text: 'What is the capital of France?',
          type: 'MCQ_SINGLE',
          marks: 5,
          negativeMarks: 1,
          explanation: 'Paris is the capital of France.',
          options: [
            { text: 'Paris', isCorrect: true },
            { text: 'London', isCorrect: false },
          ],
        });
      expect(resSingle.status).toBe(201);
      qSingleId = resSingle.body.id;
      qSingleCorrectOptId = resSingle.body.options.find((o: any) => o.isCorrect).id;
      qSingleWrongOptId = resSingle.body.options.find((o: any) => !o.isCorrect).id;

      // 2. MCQ_MULTI
      const resMulti = await request(app)
        .post(`/api/quizzes/${quizId}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          text: 'Which numbers are even?',
          type: 'MCQ_MULTI',
          marks: 5,
          negativeMarks: 2,
          options: [
            { text: '2', isCorrect: true },
            { text: '4', isCorrect: true },
            { text: '5', isCorrect: false },
          ],
        });
      expect(resMulti.status).toBe(201);
      qMultiId = resMulti.body.id;
      qMultiOpt1Id = resMulti.body.options[0].id;
      qMultiOpt2Id = resMulti.body.options[1].id;

      // 3. TRUE_FALSE
      const resTf = await request(app)
        .post(`/api/quizzes/${quizId}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          text: 'Water boils at 100 degrees Celsius under standard conditions.',
          type: 'TRUE_FALSE',
          marks: 2,
          negativeMarks: 0,
          options: [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false },
          ],
        });
      expect(resTf.status).toBe(201);
      qTfId = resTf.body.id;
      qTfCorrectOptId = resTf.body.options.find((o: any) => o.isCorrect).id;
    });

    it('26. Publish Validation: Successfully publishes valid quiz', async () => {
      const res = await request(app)
        .patch(`/api/quizzes/${quizId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isPublished: true });
      expect(res.status).toBe(200);
      expect(res.body.isPublished).toBe(true);
    });

    it('27. Ownership check: Another teacher cannot access or modify this quiz', async () => {
      const getRes = await request(app)
        .get(`/api/quizzes/${quizId}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`);
      expect(getRes.status).toBe(403);

      const putRes = await request(app)
        .put(`/api/quizzes/${quizId}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({ title: 'Hacked Title' });
      expect(putRes.status).toBe(403);
    });
  });

  describe('3. Student Attempt Lifecycle & Engine', () => {
    it('28. Student joins quiz using access code (case-insensitive)', async () => {
      const res = await request(app)
        .post('/api/quizzes/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ accessCode: accessCode.toLowerCase() });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(quizId);
      expect(res.body.title).toBe('Full Lifecycle Integration Quiz');
      expect(res.body.totalQuestions).toBe(3);
      expect(res.body.questions).toBeUndefined(); // Question contents withheld until start
    });

    it('29. Student starts attempt and receives sanitized questions (no correct flags)', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${quizId}/attempts`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.attempt?.id).toBeDefined();
      expect(res.body.questions).toHaveLength(3);

      attemptId = res.body.attempt.id;

      // Assert zero leaks of isCorrect or explanation
      for (const q of res.body.questions) {
        expect(q.explanation).toBeUndefined();
        for (const opt of q.options) {
          expect(opt.isCorrect).toBeUndefined();
        }
      }
    });

    it('30. Locking Rule: Modifying quiz questions while attempt exists is rejected with 409', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${quizId}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          text: 'Locked new question',
          type: 'TRUE_FALSE',
          marks: 1,
          options: [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false },
          ],
        });
      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('CONFLICT');
    });

    it('31. Autosave: Student saves answers to attempt', async () => {
      // Answer Q1 Correctly (+5)
      const a1Res = await request(app)
        .put(`/api/attempts/${attemptId}/answers`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: qSingleId,
          selectedOptionIds: [qSingleCorrectOptId],
          markedForReview: false,
        });
      expect(a1Res.status).toBe(200);

      // Answer Q2 Correctly (+5)
      const a2Res = await request(app)
        .put(`/api/attempts/${attemptId}/answers`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: qMultiId,
          selectedOptionIds: [qMultiOpt1Id, qMultiOpt2Id],
          markedForReview: false,
        });
      expect(a2Res.status).toBe(200);

      // Answer Q3 Correctly (+2)
      const a3Res = await request(app)
        .put(`/api/attempts/${attemptId}/answers`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: qTfId,
          selectedOptionIds: [qTfCorrectOptId],
          markedForReview: false,
        });
      expect(a3Res.status).toBe(200);
    });

    it('32. Tab-switch counter increments accurately', async () => {
      const res = await request(app)
        .post(`/api/attempts/${attemptId}/tab-switch`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.tabSwitches).toBe(1);
    });

    it('33. Submission: Idempotent submit scores the attempt', async () => {
      const res1 = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('SUBMITTED');
      expect(res1.body.showResultsImmediately).toBe(false);
      expect(res1.body.message).toBe('Submitted. Your teacher will release results.');

      // Idempotency: Second submit returns identical result
      const res2 = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('SUBMITTED');
      expect(res2.body.showResultsImmediately).toBe(false);
    });

    it('34. Max attempts enforcement: Rejects second attempt with 409 CONFLICT', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${quizId}/attempts`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('CONFLICT');
    });

    it('35. Result Visibility: Hidden when showResultsImmediately is false', async () => {
      const res = await request(app)
        .get(`/api/attempts/${attemptId}/result`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.showResultsImmediately).toBe(false);
      expect(res.body.message).toBe('Submitted. Your teacher will release results.');
      expect(res.body.questions).toBeUndefined();
    });

    it('36. Result Visibility: Releases full answers and explanations once teacher toggles release', async () => {
      // Teacher releases results
      const relRes = await request(app)
        .patch(`/api/quizzes/${quizId}/release-results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ showResultsImmediately: true });
      expect(relRes.status).toBe(200);

      // Student checks result again
      const res = await request(app)
        .get(`/api/attempts/${attemptId}/result`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.showResultsImmediately).toBe(true);
      expect(res.body.score).toBe(12);
      expect(res.body.questions).toHaveLength(3);
      expect(res.body.questions[0].explanation).toBeDefined();
    });

    it('37. Expiry Auto-Submit: Expired in-progress attempt is auto-submitted upon next request', async () => {
      // Create another quiz allowing 2 attempts
      const qRes = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Expiry Integration Quiz',
          durationMinutes: 5,
          maxAttempts: 2,
        });
      const expQuizId = qRes.body.id;

      await request(app)
        .post(`/api/quizzes/${expQuizId}/questions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          text: 'Quick question',
          type: 'TRUE_FALSE',
          marks: 1,
          options: [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false },
          ],
        });

      await request(app)
        .patch(`/api/quizzes/${expQuizId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isPublished: true });

      // Start attempt
      const startRes = await request(app)
        .post(`/api/quizzes/${expQuizId}/attempts`)
        .set('Authorization', `Bearer ${studentToken}`);
      const expAttId = startRes.body.attempt.id;

      // Backdate expiresAt in DB
      await prisma.attempt.update({
        where: { id: expAttId },
        data: { expiresAt: new Date(Date.now() - 60000) },
      });

      // Student requests attempt state -> auto-submits
      const stateRes = await request(app)
        .get(`/api/attempts/${expAttId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(stateRes.status).toBe(200);
      expect(stateRes.body.attempt.status).toBe('AUTO_SUBMITTED');
    });
  });

  describe('4. Teacher Analytics, Attempt Review and CSV Export', () => {
    it('37. Teacher views attempts list with pagination', async () => {
      const res = await request(app)
        .get(`/api/quizzes/${quizId}/attempts?page=1&pageSize=10`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].studentEmail).toBe(`student_int_${timestamp}@example.com`);
      expect(res.body.data[0].tabSwitches).toBe(1);
    });

    it('38. Teacher reviews specific student attempt in detail', async () => {
      const res = await request(app)
        .get(`/api/attempts/${attemptId}/review`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.student.email).toBe(`student_int_${timestamp}@example.com`);
      expect(res.body.score).toBe(12);
      expect(res.body.questions).toHaveLength(3);
      expect(res.body.tabSwitches).toBe(1);
    });

    it('39. Teacher accesses quiz analytics', async () => {
      const res = await request(app)
        .get(`/api/quizzes/${quizId}/analytics`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.attempts).toBe(1);
      expect(res.body.average).toBe(100);
      expect(res.body.passRate).toBe(100);
      expect(res.body.distribution).toHaveLength(10);
      expect(res.body.questionAccuracy).toHaveLength(3);
    });

    it('40. Teacher downloads CSV export with correct headers and data', async () => {
      const res = await request(app)
        .get(`/api/quizzes/${quizId}/export.csv`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Student Name');
      expect(res.text).toContain('Student Email');
      expect(res.text).toContain(`student_int_${timestamp}@example.com`);
    });
  });
});
