import { describe, it, expect } from 'vitest';
import { calculateScore, ScorableQuestion } from '../../src/services/scoring';

describe('Scoring Service - Unit Tests', () => {
  const sampleSingleChoiceQuestion: ScorableQuestion = {
    id: 'q1',
    type: 'MCQ_SINGLE',
    marks: 4,
    negativeMarks: 1,
    options: [
      { id: 'opt1', isCorrect: true },
      { id: 'opt2', isCorrect: false },
      { id: 'opt3', isCorrect: false },
    ],
  };

  const sampleMultiChoiceQuestion: ScorableQuestion = {
    id: 'q2',
    type: 'MCQ_MULTI',
    marks: 6,
    negativeMarks: 2,
    options: [
      { id: 'm1', isCorrect: true },
      { id: 'm2', isCorrect: true },
      { id: 'm3', isCorrect: false },
      { id: 'm4', isCorrect: false },
    ],
  };

  const sampleTrueFalseQuestion: ScorableQuestion = {
    id: 'q3',
    type: 'TRUE_FALSE',
    marks: 2,
    negativeMarks: 0.5,
    options: [
      { id: 'tf_true', isCorrect: true },
      { id: 'tf_false', isCorrect: false },
    ],
  };

  it('1. MCQ_SINGLE: awards full marks when correct option is selected', () => {
    const result = calculateScore([sampleSingleChoiceQuestion], [{ questionId: 'q1', selectedOptionIds: ['opt1'] }], 50);
    expect(result.score).toBe(4);
    expect(result.totalMarks).toBe(4);
    expect(result.percentage).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.questionResults[0].isCorrect).toBe(true);
    expect(result.questionResults[0].marksAwarded).toBe(4);
  });

  it('2. MCQ_SINGLE: deducts negative marks when wrong option is selected', () => {
    const result = calculateScore([sampleSingleChoiceQuestion], [{ questionId: 'q1', selectedOptionIds: ['opt2'] }], 50);
    // Floor at 0 for overall attempt
    expect(result.score).toBe(0);
    expect(result.questionResults[0].isCorrect).toBe(false);
    expect(result.questionResults[0].marksAwarded).toBe(-1);
  });

  it('3. MCQ_SINGLE: awards 0 marks when no option is selected (unanswered)', () => {
    const result = calculateScore([sampleSingleChoiceQuestion], [{ questionId: 'q1', selectedOptionIds: [] }], 50);
    expect(result.score).toBe(0);
    expect(result.questionResults[0].isCorrect).toBe(false);
    expect(result.questionResults[0].marksAwarded).toBe(0);
  });

  it('4. MCQ_MULTI: awards full marks when exact set of correct options is selected', () => {
    const result = calculateScore([sampleMultiChoiceQuestion], [{ questionId: 'q2', selectedOptionIds: ['m1', 'm2'] }], 50);
    expect(result.score).toBe(6);
    expect(result.percentage).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.questionResults[0].isCorrect).toBe(true);
    expect(result.questionResults[0].marksAwarded).toBe(6);
  });

  it('5. MCQ_MULTI: penalizes partial match with negative marks (no partial credit)', () => {
    // Only 'm1' selected instead of 'm1' and 'm2'
    const result = calculateScore([sampleMultiChoiceQuestion], [{ questionId: 'q2', selectedOptionIds: ['m1'] }], 50);
    expect(result.questionResults[0].isCorrect).toBe(false);
    expect(result.questionResults[0].marksAwarded).toBe(-2);
  });

  it('6. MCQ_MULTI: penalizes extra wrong option selection with negative marks', () => {
    // 'm1', 'm2', and 'm3' selected
    const result = calculateScore([sampleMultiChoiceQuestion], [{ questionId: 'q2', selectedOptionIds: ['m1', 'm2', 'm3'] }], 50);
    expect(result.questionResults[0].isCorrect).toBe(false);
    expect(result.questionResults[0].marksAwarded).toBe(-2);
  });

  it('7. MCQ_MULTI: awards 0 marks when completely unanswered', () => {
    const result = calculateScore([sampleMultiChoiceQuestion], [{ questionId: 'q2', selectedOptionIds: [] }], 50);
    expect(result.score).toBe(0);
    expect(result.questionResults[0].isCorrect).toBe(false);
    expect(result.questionResults[0].marksAwarded).toBe(0);
  });

  it('8. TRUE_FALSE: awards marks for correct choice', () => {
    const result = calculateScore([sampleTrueFalseQuestion], [{ questionId: 'q3', selectedOptionIds: ['tf_true'] }], 50);
    expect(result.score).toBe(2);
    expect(result.questionResults[0].isCorrect).toBe(true);
    expect(result.questionResults[0].marksAwarded).toBe(2);
  });

  it('9. TRUE_FALSE: deducts negative marks for incorrect choice', () => {
    const result = calculateScore([sampleTrueFalseQuestion], [{ questionId: 'q3', selectedOptionIds: ['tf_false'] }], 50);
    expect(result.questionResults[0].isCorrect).toBe(false);
    expect(result.questionResults[0].marksAwarded).toBe(-0.5);
  });

  it('10. Floor at zero: overall attempt score is never below 0 even with severe penalties', () => {
    const harshQuestion: ScorableQuestion = {
      id: 'qh',
      type: 'MCQ_SINGLE',
      marks: 1,
      negativeMarks: 10,
      options: [
        { id: 'h1', isCorrect: true },
        { id: 'h2', isCorrect: false },
      ],
    };
    const result = calculateScore([harshQuestion], [{ questionId: 'qh', selectedOptionIds: ['h2'] }], 40);
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('11. Passing percentage: checks threshold correctly (exactly equal to passingPercent)', () => {
    const qA: ScorableQuestion = { id: 'qa', type: 'MCQ_SINGLE', marks: 10, negativeMarks: 0, options: [{ id: 'a1', isCorrect: true }] };
    const qB: ScorableQuestion = { id: 'qb', type: 'MCQ_SINGLE', marks: 10, negativeMarks: 0, options: [{ id: 'b1', isCorrect: true }] };

    // 10 out of 20 = 50%
    const result = calculateScore([qA, qB], [{ questionId: 'qa', selectedOptionIds: ['a1'] }], 50);
    expect(result.score).toBe(10);
    expect(result.totalMarks).toBe(20);
    expect(result.percentage).toBe(50);
    expect(result.passed).toBe(true);
  });

  it('12. Passing percentage: fails when 0.01 below threshold', () => {
    const qA: ScorableQuestion = { id: 'qa', type: 'MCQ_SINGLE', marks: 49, negativeMarks: 0, options: [{ id: 'a1', isCorrect: true }] };
    const qB: ScorableQuestion = { id: 'qb', type: 'MCQ_SINGLE', marks: 51, negativeMarks: 0, options: [{ id: 'b1', isCorrect: true }] };

    // 49 out of 100 = 49%
    const result = calculateScore([qA, qB], [{ questionId: 'qa', selectedOptionIds: ['a1'] }], 50);
    expect(result.percentage).toBe(49);
    expect(result.passed).toBe(false);
  });

  it('13. Filters out malicious/invalid option IDs that do not belong to the question', () => {
    const result = calculateScore([sampleSingleChoiceQuestion], [{ questionId: 'q1', selectedOptionIds: ['malicious_option_id'] }], 50);
    // Filtered to empty array => treated as unanswered
    expect(result.questionResults[0].selectedOptionIds).toEqual([]);
    expect(result.questionResults[0].marksAwarded).toBe(0);
  });

  it('14. Cumulative calculation with mixed question types and scores', () => {
    const questions = [sampleSingleChoiceQuestion, sampleMultiChoiceQuestion, sampleTrueFalseQuestion];
    // Q1: Correct (+4)
    // Q2: Wrong (-2)
    // Q3: Correct (+2)
    // Net raw score = 4 - 2 + 2 = 4
    // Total possible = 4 + 6 + 2 = 12
    // Percentage = (4 / 12) * 100 = 33.33%
    const answers = [
      { questionId: 'q1', selectedOptionIds: ['opt1'] },
      { questionId: 'q2', selectedOptionIds: ['m1', 'm3'] },
      { questionId: 'q3', selectedOptionIds: ['tf_true'] },
    ];
    const result = calculateScore(questions, answers, 40);
    expect(result.score).toBe(4);
    expect(result.totalMarks).toBe(12);
    expect(result.percentage).toBe(33.33);
    expect(result.passed).toBe(false);
  });

  it('15. Handles question omitted from student answers array gracefully', () => {
    const questions = [sampleSingleChoiceQuestion, sampleTrueFalseQuestion];
    // Student only answered Q1
    const answers = [{ questionId: 'q1', selectedOptionIds: ['opt1'] }];
    const result = calculateScore(questions, answers, 50);
    expect(result.score).toBe(4);
    expect(result.totalMarks).toBe(6);
    expect(result.questionResults.find((r) => r.questionId === 'q3')?.marksAwarded).toBe(0);
  });
});
