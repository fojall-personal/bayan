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

4|import { applySM2 } from '../lib/space-repetition';
5|
6|export const memorizationRoutes = new Hono<{ Bindings: { DB: Database } }>();
7|
8|// GET /api/memorization/surah/:surahId — Get surah progress
9|memorizationRoutes.get('/surah/:surahId', async (c) => {
10|  const { surahId } = c.req.param();
11|  const { id: userId } = getCurrentUser();
12|  const db = getDB(c);
13|
14|  try {
15|    const entries = await db.query<Record<string, unknown>>(
16|      `SELECT * FROM memorization WHERE user_id = ? AND surah_id = ? ORDER BY ayah_from ASC`,
17|      [userId, surahId]
18|    );
19|
20|    return c.json({ surahId, entries });
21|  } catch (error) {
22|    console.error('Memorization surah error:', error);
23|    return c.json({ error: 'Internal server error' }, 500);
24|  }
25|});
26|
27|// GET /api/memorization/all — Get all memorization entries for user
28|memorizationRoutes.get('/all', async (c) => {
29|  const { id: userId } = getCurrentUser();
30|  const db = getDB(c);
31|
32|  try {
33|    const all = await db.query<Record<string, unknown>>(
34|      `SELECT surah_id, status, COUNT(*) as ayah_count FROM memorization
35|       WHERE user_id = ? GROUP BY surah_id, status`,
36|      [userId]
37|    );
38|
39|    return c.json({ entries: all });
40|  } catch (error) {
41|    console.error('Memorization all error:', error);
42|    return c.json({ error: 'Internal server error' }, 500);
43|  }
44|});
45|
46|// POST /api/memorization/add — Add a new memorization entry
47|memorizationRoutes.post('/add', async (c) => {
48|  const { id: userId } = getCurrentUser();
49|  const db = getDB(c);
50|  const { surahId, ayahFrom, ayahTo } = await c.req.json();
51|
52|  try {
53|    // Check if entry already exists
54|    const existing = await db.get<Record<string, unknown>>(
55|      `SELECT * FROM memorization WHERE user_id = ? AND surah_id = ? AND ayah_from = ? AND ayah_to = ?`,
56|      [userId, surahId, ayahFrom, ayahTo]
57|    );
58|
59|    if (existing) {
60|      return c.json({ error: 'Entry already exists' }, 409);
61|    }
62|
63|    await db.run(
64|      `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, next_review, quality, interval, ease_factor, revision_count)
65|       VALUES (?, ?, ?, ?, ?, 'learning', datetime('now', '+1 day'), 0, 0, 2.5, 0)`,
66|      [crypto.randomUUID(), userId, surahId, ayahFrom, ayahTo]
67|    );
68|
69|    return c.json({
70|      success: true,
71|      entry: { surahId, ayahFrom, ayahTo, status: 'learning' },
72|    });
73|  } catch (error) {
74|    console.error('Memorization add error:', error);
75|    return c.json({ error: 'Internal server error' }, 500);
76|  }
77|});
78|
79|// POST /api/memorization/:id/review — Review a memorization entry (SM-2)
80|memorizationRoutes.post('/:id/review', async (c) => {
81|  const { id } = c.req.param();
82|  const { id: userId } = getCurrentUser();
83|  const db = getDB(c);
84|  const { quality } = await c.req.json();
85|
86|  try {
87|    const entry = await db.get<Record<string, unknown>>(
88|      `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
89|      [id, userId]
90|    );
91|
92|    if (!entry) {
93|      return c.json({ error: 'Entry not found' }, 404);
94|    }
95|
96|    // Apply SM-2 algorithm
97|    const sm2Entry = {
98|      id: entry.id as string,
99|      quality: (entry.quality as number) || 0,
100|      interval: (entry.interval as number) || 0,
101|      ease_factor: (entry.ease_factor as number) || 2.5,
102|      reviews_count: (entry.revision_count as number) || 0,
103|      status: (entry.status as string) || 'learning',
104|      next_review: (entry.next_review as string) || '',
105|    };
106|
107|    const result = applySM2(sm2Entry, quality);
108|
109|    // Update entry
110|    await db.run(
111|      `UPDATE memorization SET
112|         quality = ?,
113|         last_reviewed = datetime('now'),
114|         next_review = ?,
115|         revision_count = revision_count + 1,
116|         status = ?,
117|         ease_factor = ?,
118|         interval = ?
119|       WHERE id = ? AND user_id = ?`,
120|      [
121|        quality,
122|        result.nextReview,
123|        result.status,
124|        result.easeFactor,
125|        result.interval,
126|        id,
127|        userId,
128|      ]
129|    );
130|
131|    return c.json({
132|      success: true,
133|      nextReview: result.nextReview,
134|      status: result.status,
135|      interval: result.interval,
136|    });
137|  } catch (error) {
138|    console.error('Memorization review error:', error);
139|    return c.json({ error: 'Internal server error' }, 500);
140|  }
141|});
142|
143|// POST /api/memorization/:id/recall — Next-ayah recall exercise
144|memorizationRoutes.post('/:id/recall', async (c) => {
145|  const { id } = c.req.param();
146|  const { id: userId } = getCurrentUser();
147|  const db = getDB(c);
148|  const { recalledAyah } = await c.req.json();
149|
150|  try {
151|    const entry = await db.get<Record<string, unknown>>(
152|      `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
153|      [id, userId]
154|    );
155|
156|    if (!entry) {
157|      return c.json({ error: 'Entry not found' }, 404);
158|    }
159|
160|    // Get the next ayah in the surah
161|    const nextAyah = (entry.ayah_to as number) + 1;
162|
163|    // Check if user's recall matches
164|    const isCorrect = recalledAyah === nextAyah;
165|
166|    // Update review based on recall
167|    const newQuality = isCorrect ? 5 : Math.max(1, (entry.quality as number) - 2);
168|    const sm2Entry = {
169|      id: entry.id as string,
170|      quality: (entry.quality as number) || 0,
171|      interval: (entry.interval as number) || 0,
172|      ease_factor: (entry.ease_factor as number) || 2.5,
173|      reviews_count: (entry.revision_count as number) || 0,
174|      status: (entry.status as string) || 'learning',
175|      next_review: (entry.next_review as string) || '',
176|    };
177|
178|    const result = applySM2(sm2Entry, newQuality);
179|
180|    await db.run(
181|      `UPDATE memorization SET
182|         next_review = ?,
183|         quality = ?,
184|         last_reviewed = datetime('now'),
185|         revision_count = revision_count + 1,
186|         status = ?
187|       WHERE id = ? AND user_id = ?`,
188|      [
189|        result.nextReview,
190|        newQuality,
191|        result.status,
192|        id,
193|        userId,
194|      ]
195|    );
196|
197|    return c.json({
198|      success: true,
199|      correct: isCorrect,
200|      nextAyah,
201|      newQuality,
202|    });
203|  } catch (error) {
204|    console.error('Memorization recall error:', error);
205|    return c.json({ error: 'Internal server error' }, 500);
206|  }
207|});
208|
209|// GET /api/memorization/review/today — Get today's review targets
210|memorizationRoutes.get('/review/today', async (c) => {
211|  const { id: userId } = getCurrentUser();
212|  const db = getDB(c);
213|
214|  try {
215|    const due = await db.query<Record<string, unknown>>(
216|      `SELECT m.*,
217|              q.verse_text as ayah_text,
218|              q.verse_simple as verse_simple
219|       FROM memorization m
220|       LEFT JOIN quran_verses q ON m.surah_id = q.surah AND m.ayah_to = q.ayah
221|       WHERE m.user_id = ? AND m.next_review <= datetime('now')
222|       ORDER BY m.next_review ASC`,
223|      [userId]
224|    );
225|
226|    return c.json({ due });
227|  } catch (error) {
228|    console.error('Memorization today error:', error);
229|    return c.json({ error: 'Internal server error' }, 500);
230|  }
231|});
232|
233|// GET /api/memorization/surahs — Get all surahs with memorization status
234|memorizationRoutes.get('/surahs', async (c) => {
235|  const { id: userId } = getCurrentUser();
236|  const db = getDB(c);
237|
238|  try {
239|    const surahs = await db.query<Record<string, unknown>>(
240|      `SELECT surah_id,
241|              SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered,
242|              SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) as learning,
243|              SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
244|              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_ayahs
245|       FROM memorization
246|       WHERE user_id = ?
247|       GROUP BY surah_id
248|       ORDER BY surah_id ASC`,
249|      [userId]
250|    );
251|
252|    return c.json({ surahs });
253|  } catch (error) {
254|    console.error('Memorization surahs error:', error);
255|    return c.json({ error: 'Internal server error' }, 500);
256|  }
257|});
258|