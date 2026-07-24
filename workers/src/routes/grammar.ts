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

4|import { parseArabicSentence, checkGrammarErrors, VERB_CONJUGATIONS } from '../lib/grammar-parser';
5|
6|export const grammarRoutes = new Hono<{ Bindings: { DB: Database } }>();
7|
8|// GET /api/grammar/deepdive/:category — Get deep-dive content for nahw/sarf/balagha
9|grammarRoutes.get('/deepdive/:category', async (c) => {
10|  const { category } = c.req.param();
11|  const { id: userId } = getCurrentUser();
12|  const db = getDB(c);
13|
14|  try {
15|    const mastery = await db.get<Record<string, unknown>>(
16|      `SELECT * FROM grammar_mastery WHERE user_id = ? AND category = ?`,
17|      [userId, category]
18|    );
19|
20|    const lessons = await db.query<Record<string, unknown>>(
21|      `SELECT * FROM lessons WHERE module = 'grammar' AND level >= ? ORDER BY level ASC`,
22|      [(mastery?.mastery_level as number) || 1]
23|    );
24|
25|    return c.json({
26|      data: {
27|        category,
28|        lessons: lessons.map((l) => ({
29|          ...l,
30|          content: JSON.parse((l.content as string) || '{}'),
31|          exercises: JSON.parse((l.exercises as string) || '[]'),
32|        })),
33|        mastery: mastery
34|          ? {
35|              category: mastery.category,
36|              masteryLevel: mastery.mastery_level,
37|              totalAttempts: mastery.total_attempts,
38|              correctAttempts: mastery.correct_attempts,
39|            }
40|          : { category, masteryLevel: 1, totalAttempts: 0, correctAttempts: 0 },
41|      },
42|    });
43|  } catch (error) {
44|    console.error('Grammar deepdive error:', error);
45|    return c.json({ error: 'Internal server error' }, 500);
46|  }
47|});
48|
49|// POST /api/grammar/parse — Parse an Arabic sentence
50|grammarRoutes.post('/parse', async (c) => {
51|  const { id: userId } = getCurrentUser();
52|  const { sentence } = await c.req.json();
53|
54|  try {
55|    const parsed = parseArabicSentence(sentence);
56|    const errors = checkGrammarErrors(sentence, parsed);
57|
58|    return c.json({
59|      data: {
60|        parsed,
61|        errors,
62|        suggestions: errors.map((e) => e.suggestion),
63|      },
64|    });
65|  } catch (error) {
66|    console.error('Grammar parse error:', error);
67|    return c.json({ error: 'Internal server error' }, 500);
68|  }
69|});
70|
71|// GET /api/grammar/conjugations — Get verb conjugation tables
72|grammarRoutes.get('/conjugations', async (c) => {
73|  return c.json({
74|    data: Object.entries(VERB_CONJUGATIONS).map(([root, forms]) => ({
75|      root,
76|      forms,
77|    })),
78|  });
79|});
80|
81|// POST /api/grammar/exercise — Submit grammar exercise answer
82|grammarRoutes.post('/exercise', async (c) => {
83|  const { id: userId } = getCurrentUser();
84|  const db = getDB(c);
85|  const { exerciseId, answer, correct } = await c.req.json();
86|
87|  try {
88|    await db.run(
89|      `INSERT INTO grammar_exercises (id, user_id, exercise_id, answer, correct, answered_at)
90|       VALUES (randomblob(16), ?, ?, ?, ?, datetime('now'))`,
91|      [userId, exerciseId, answer, correct ? 1 : 0]
92|    );
93|
94|    // Update mastery
95|    const category = await db.get<Record<string, unknown>>(
96|      `SELECT module FROM lessons WHERE id = ?`,
97|      [exerciseId]
98|    );
99|
100|    if (category) {
101|      await db.run(
102|        `INSERT INTO grammar_mastery (user_id, category, total_attempts, correct_attempts)
103|         VALUES (?, ?, 1, ?)
104|         ON CONFLICT(user_id, category) DO UPDATE SET
105|           total_attempts = total_attempts + 1,
106|           correct_attempts = CASE WHEN ? = 1 THEN correct_attempts + 1 ELSE correct_attempts END,
107|           updated_at = datetime('now')`,
108|        [userId, category.module, correct ? 1 : 0, correct ? 1 : 0]
109|      );
110|    }
111|
112|    return c.json({ data: { success: true, correct } });
113|  } catch (error) {
114|    console.error('Grammar exercise error:', error);
115|    return c.json({ error: 'Internal server error' }, 500);
116|  }
117|});
118|
119|// GET /api/grammar/mastery — Get grammar mastery by category
120|grammarRoutes.get('/mastery', async (c) => {
121|  const { id: userId } = getCurrentUser();
122|  const db = getDB(c);
123|
124|  try {
125|    const mastery = await db.query<Record<string, unknown>>(
126|      `SELECT * FROM grammar_mastery WHERE user_id = ?`,
127|      [userId]
128|    );
129|
130|    return c.json({
131|      data: mastery.map((m) => ({
132|        category: m.category,
133|        masteryLevel: m.mastery_level,
134|        totalAttempts: m.total_attempts,
135|        correctAttempts: m.correct_attempts,
136|        percentage: m.total_attempts > 0
137|          ? Math.round(((m.correct_attempts as number) / m.total_attempts) * 100)
138|          : 0,
139|      })),
140|    });
141|  } catch (error) {
142|    console.error('Grammar mastery error:', error);
143|    return c.json({ error: 'Internal server error' }, 500);
144|  }
145|});
146|