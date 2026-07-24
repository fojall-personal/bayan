1|import { Hono } from 'hono';
2|import { Database } from '../lib/db';
3|import { getCurrentUser } from '../index';

function getDB(c: any) {
  const raw = c.env.DB;
  if (raw && typeof raw.prepare === 'function') {
    return new Database(raw);
  }
  return raw;
}

4|import { calculateCompositeScore, assignLearningPath, generateAssessmentResult } from '../lib/scoring';
5|
6|export const assessmentRoutes = new Hono<{ Bindings: { DB: Database } }>();
7|
8|// GET /api/assessment/start — Get assessment questions
9|assessmentRoutes.get('/start', async (c) => {
10|  // Placeholder — will be populated in Module 2
11|  return c.json({
12|    data: {
13|      modules: ['literacy', 'comprehension', 'grammar', 'memorization'],
14|      total_questions: 60,
15|      estimated_minutes: 30,
16|    },
17|  });
18|});
19|
20|// POST /api/assessment/submit — Submit assessment answers
21|assessmentRoutes.post('/submit', async (c) => {
22|  const { id: userId } = getCurrentUser();
23|  const db = getDB(c);
24|  const { literacy_score, comprehension_score, grammar_score, memorization_score } =
25|    await c.req.json();
26|
27|  try {
28|    const scores = {
29|      literacy: literacy_score || 0,
30|      comprehension: comprehension_score || 0,
31|      grammar: grammar_score || 0,
32|      memorization: memorization_score || 0,
33|    };
34|
35|    const result = generateAssessmentResult(scores, userId);
36|
37|    // Save to database
38|    await db.run(
39|      `INSERT INTO assessment_results (id, user_id, completed_at, literacy_score, comprehension_score, grammar_score, memorization_score, level, details)
40|       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
41|      [
42|        result.id,
43|        userId,
44|        result.completed_at,
45|        result.literacy_score,
46|        result.comprehension_score,
47|        result.grammar_score,
48|        result.memorization_score,
49|        result.level,
50|        JSON.stringify(result.details),
51|      ]
52|    );
53|
54|    // Update user's learning path
55|    await db.run(
56|      `UPDATE users SET current_path = ?, onboarding_completed = 1, updated_at = datetime('now') WHERE id = ?`,
57|      [result.path, userId]
58|    );
59|
60|    return c.json({
61|      data: {
62|        id: result.id,
63|        level: result.level,
64|        path: result.path,
65|        composite_score: result.composite_score,
66|        weakest_area: result.details.weakest_area,
67|        strongest_area: result.details.strongest_area,
68|        path_description: result.details.paths[result.path].description,
69|      },
70|    });
71|  } catch (error) {
72|    console.error('Assessment submit error:', error);
73|    return c.json({ error: 'Internal server error' }, 500);
74|  }
75|});
76|
77|// GET /api/assessment/results — Get latest assessment results
78|assessmentRoutes.get('/results', async (c) => {
79|  const { id: userId } = getCurrentUser();
80|  const db = getDB(c);
81|
82|  try {
83|    const result = await db.get<Record<string, unknown>>(
84|      `SELECT * FROM assessment_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1`,
85|      [userId]
86|    );
87|
88|    if (!result) {
89|      return c.json({ data: null });
90|    }
91|
92|    return c.json({
93|      data: {
94|        ...result,
95|        details: JSON.parse((result.details as string) || '{}'),
96|      },
97|    });
98|  } catch (error) {
99|    console.error('Assessment results error:', error);
100|    return c.json({ error: 'Internal server error' }, 500);
101|  }
102|});
103|