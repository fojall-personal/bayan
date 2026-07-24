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

4|
5|export const tajweedRoutes = new Hono<{ Bindings: { DB: Database } }>();
6|
7|// GET /api/tajweed/rules — Get all tajweed rules with examples
8|tajweedRoutes.get('/rules', async (c) => {
9|  const db = getDB(c);
10|
11|  try {
12|    const rules = await db.query<Record<string, unknown>>(
13|      `SELECT * FROM tajweed_rules ORDER BY name ASC`
14|    );
15|
16|    return c.json({
17|      data: rules.map((r) => ({
18|        id: r.id,
19|        name: r.name,
20|        description: r.description,
21|        color: r.color,
22|        colorName: r.color_name,
23|      })),
24|    });
25|  } catch (error) {
26|    console.error('Tajweed rules error:', error);
27|    return c.json({ error: 'Internal server error' }, 500);
28|  }
29|});
30|
31|// GET /api/tajweed/verses/:surahId — Get verses with tajweed tags for a surah
32|tajweedRoutes.get('/verses/:surahId', async (c) => {
33|  const { surahId } = c.req.param();
34|  const db = getDB(c);
35|
36|  try {
37|    const verses = await db.query<Record<string, unknown>>(
38|      `SELECT surah, ayah, text_uthmani, text_simple, tajweed_tags
39|       FROM quran_verses
40|       WHERE surah = ?
41|       ORDER BY ayah ASC`,
42|      [surahId]
43|    );
44|
45|    return c.json({
46|      surahId: Number(surahId),
47|      verses: verses.map((v) => ({
48|        surah: v.surah,
49|        ayah: v.ayah,
50|        text_uthmani: v.text_uthmani,
51|        text_simple: v.text_simple,
52|        tajweed_tags: v.tajweed_tags ? JSON.parse(v.tajweed_tags as string) : [],
53|      })),
54|    });
55|  } catch (error) {
56|    console.error('Tajweed verses error:', error);
57|    return c.json({ error: 'Internal server error' }, 500);
58|  }
59|});
60|
61|// GET /api/tajweed/mastery — Get user's tajweed mastery by rule
62|tajweedRoutes.get('/mastery', async (c) => {
63|  const { id: userId } = getCurrentUser();
64|  const db = getDB(c);
65|
66|  try {
67|    const mastery = await db.query<Record<string, unknown>>(
68|      `SELECT r.id as rule_id, r.name, r.color, r.color_name,
69|              COUNT(tp.id) as total_attempts,
70|              SUM(CASE WHEN tp.correct = 1 THEN 1 ELSE 0 END) as correct,
71|              CASE WHEN COUNT(tp.id) > 0 THEN
72|                ROUND(SUM(CASE WHEN tp.correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(tp.id), 1)
73|              ELSE 0 END as mastery_percentage
74|       FROM tajweed_rules r
75|       LEFT JOIN tajweed_practice tp ON r.id = tp.rule_id AND tp.user_id = ?
76|       GROUP BY r.id, r.name, r.color, r.color_name
77|       ORDER BY mastery_percentage DESC`,
78|      [userId]
79|    );
80|
81|    return c.json({
82|      data: mastery.map((m) => ({
83|        ruleId: m.rule_id,
84|        name: m.name,
85|        color: m.color,
86|        colorName: m.color_name,
87|        totalAttempts: m.total_attempts,
88|        correct: m.correct,
89|        masteryPercentage: m.mastery_percentage,
90|      })),
91|    });
92|  } catch (error) {
93|    console.error('Tajweed mastery error:', error);
94|    return c.json({ error: 'Internal server error' }, 500);
95|  }
96|});
97|
98|// POST /api/tajweed/practice/:ruleId/submit — Submit practice result
99|tajweedRoutes.post('/practice/:ruleId/submit', async (c) => {
100|  const { ruleId } = c.req.param();
101|  const { id: userId } = getCurrentUser();
102|  const db = getDB(c);
103|  const { wordId, correct, timeSpent } = await c.req.json();
104|
105|  try {
106|    await db.run(
107|      `INSERT OR REPLACE INTO tajweed_practice (id, user_id, rule_id, word_id, correct, time_spent, practiced_at)
108|       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
109|      [crypto.randomUUID(), userId, ruleId, wordId, correct ? 1 : 0, timeSpent]
110|    );
111|
112|    const totalAttempts = await db.get<Record<string, unknown>>(
113|      `SELECT COUNT(*) as count FROM tajweed_practice WHERE user_id = ? AND rule_id = ?`,
114|      [userId, ruleId]
115|    );
116|    const correctAttempts = await db.get<Record<string, unknown>>(
117|      `SELECT COUNT(*) as count FROM tajweed_practice WHERE user_id = ? AND rule_id = ? AND correct = 1`,
118|      [userId, ruleId]
119|    );
120|
121|    const mastery = totalAttempts?.count
122|      ? Math.round(((correctAttempts?.count || 0) / totalAttempts.count) * 100)
123|      : 0;
124|
125|    return c.json({
126|      data: { success: true, mastery, totalAttempts: totalAttempts?.count || 0 },
127|    });
128|  } catch (error) {
129|    console.error('Tajweed practice submit error:', error);
130|    return c.json({ error: 'Internal server error' }, 500);
131|  }
132|});
133|