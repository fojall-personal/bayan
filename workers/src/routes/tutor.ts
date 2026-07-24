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
5|export const tutorRoutes = new Hono<{ Bindings: { DB: Database } }>();
6|
7|// POST /api/tutor/chat — Chat with AI tutor (context-aware)
8|tutorRoutes.post('/chat', async (c) => {
9|  const { id: userId } = getCurrentUser();
10|  const db = getDB(c);
11|  const { message, conversationHistory } = await c.req.json();
12|
13|  try {
14|    // Load user context for personalized responses
15|    const [user, assessment, recentLessons, memorizationDue] =
16|      await Promise.all([
17|        db.get<Record<string, unknown>>(
18|          `SELECT * FROM users WHERE id = ?`,
19|          [userId]
20|        ),
21|        db.get<Record<string, unknown>>(
22|          `SELECT * FROM assessment_results ORDER BY completed_at DESC LIMIT 1`,
23|          [userId]
24|        ),
25|        db.query<Record<string, unknown>>(
26|          `SELECT * FROM lesson_progress WHERE user_id = ? ORDER BY last_practiced DESC LIMIT 5`,
27|          [userId]
28|        ),
29|        db.query<Record<string, unknown>>(
30|          `SELECT surah_id, status FROM memorization
31|           WHERE user_id = ? AND next_review <= datetime('now')
32|           LIMIT 10`,
33|          [userId]
34|        ),
35|      ]);
36|
37|    if (!user) {
38|      return c.json({ error: 'User not found' }, 404);
39|    }
40|
41|    // Calculate weak areas from recent quiz attempts
42|    const errors = await db.query<Record<string, unknown>>(
43|      `SELECT lesson_id, module, questions_correct, questions_answered
44|       FROM quiz_attempts WHERE user_id = ? ORDER BY completed_at DESC LIMIT 20`,
45|      [userId]
46|    );
47|
48|    const moduleErrors: Record<string, number> = {};
49|    errors.forEach((attempt) => {
50|      const rate = (attempt.questions_correct as number) /
51|        (attempt.questions_answered as number);
52|      moduleErrors[attempt.module as string] =
53|        (moduleErrors[attempt.module as string] || 0) + (1 - rate);
54|    });
55|
56|    const weakAreas = Object.entries(moduleErrors)
57|      .sort((a, b) => b[1] - a[1])
58|      .map(([mod]) => mod)
59|      .slice(0, 3);
60|
61|    // Generate contextual response
62|    const response = generateTutorResponse(message, {
63|      user,
64|      assessment,
65|      recentLessons: recentLessons.slice(0, 3),
66|      memorizationDue: memorizationDue || [],
67|      weakAreas,
68|      currentPath: user.current_path,
69|    });
70|
71|    // Save conversation
72|    await db.run(
73|      `INSERT INTO tutor_conversations (id, user_id, user_message, assistant_message, created_at)
74|       VALUES (randomblob(16), ?, ?, ?, datetime('now'))`,
75|      [userId, message, response]
76|    );
77|
78|    // Extract topics
79|    const topics = extractTopics(message);
80|    for (const topic of topics) {
81|      await db.run(
82|        `INSERT OR IGNORE INTO tutor_topic_history (id, user_id, topic, discussed_at)
83|         VALUES (randomblob(16), ?, ?, datetime('now'))`,
84|        [userId, topic]
85|      );
86|    }
87|
88|    return c.json({ data: { response, topics } });
89|  } catch (error) {
90|    console.error('Tutor chat error:', error);
91|    return c.json({ error: 'Internal server error' }, 500);
92|  }
93|});
94|
95|// GET /api/tutor/suggested-exercises — Get exercise recommendations based on error patterns
96|tutorRoutes.get('/suggested-exercises', async (c) => {
97|  const { id: userId } = getCurrentUser();
98|  const db = getDB(c);
99|
100|  try {
101|    const errors = await db.query<Record<string, unknown>>(
102|      `SELECT lesson_id, module, COUNT(*) as error_count
103|       FROM quiz_attempts
104|       WHERE user_id = ? AND questions_correct = 0
105|       GROUP BY lesson_id, module
106|       ORDER BY error_count DESC
107|       LIMIT 10`,
108|      [userId]
109|    );
110|
111|    const strong = await db.query<Record<string, unknown>>(
112|      `SELECT lesson_id, module, COUNT(*) as correct_count
113|       FROM quiz_attempts
114|       WHERE user_id = ? AND questions_correct > 0
115|       GROUP BY lesson_id, module
116|       ORDER BY correct_count DESC
117|       LIMIT 5`,
118|      [userId]
119|    );
120|
121|    const recommendations: any[] = [];
122|
123|    // Focus on weak areas (70%)
124|    errors.slice(0, 3).forEach((err) => {
125|      recommendations.push({
126|        type: 'weak_area_focus',
127|        lessonId: err.lesson_id,
128|        module: err.module,
129|        priority: 'high',
130|        reason: `${err.error_count} errors in this area`,
131|      });
132|    });
133|
134|    // Reinforce strong areas (20%)
135|    strong.slice(0, 2).forEach((s) => {
136|      recommendations.push({
137|        type: 'strong_area_reinforce',
138|        lessonId: s.lesson_id,
139|        module: s.module,
140|        priority: 'medium',
141|        reason: 'Strong performance in this area',
142|      });
143|    });
144|
145|    return c.json({ data: { recommendations } });
146|  } catch (error) {
147|    console.error('Suggested exercises error:', error);
148|    return c.json({ error: 'Internal server error' }, 500);
149|  }
150|});
151|
152|// POST /api/tutor/feedback — Generate feedback on audio recording
153|tutorRoutes.post('/feedback', async (c) => {
154|  const { id: userId } = getCurrentUser();
155|  const db = getDB(c);
156|  const { audioUrl, surahId, ayahFrom, ayahTo } = await c.req.json();
157|
158|  try {
159|    // In production, this would compare audio recordings
160|    // For MVP, return a placeholder response
161|    return c.json({
162|      data: {
163|        feedback: `Review completed. Compare your recitation of Surah ${surahId}, Ayahs ${ayahFrom}-${ayahTo} with the official recitation. Focus on clear pronunciation of each letter's articulation point (makharij).`,
164|      },
165|    });
166|  } catch (error) {
167|    console.error('Feedback error:', error);
168|    return c.json({ error: 'Internal server error' }, 500);
169|  }
170|});
171|
172|// GET /api/tutor/history — Get conversation history
173|tutorRoutes.get('/history', async (c) => {
174|  const { id: userId } = getCurrentUser();
175|  const db = getDB(c);
176|
177|  try {
178|    const history = await db.query<Record<string, unknown>>(
179|      `SELECT user_message, assistant_message, created_at
180|       FROM tutor_conversations
181|       WHERE user_id = ?
182|       ORDER BY created_at DESC
183|       LIMIT 50`,
184|      [userId]
185|    );
186|
187|    return c.json({
188|      data: history.map((h) => ({
189|        userMessage: h.user_message,
190|        assistantMessage: h.assistant_message,
191|        createdAt: h.created_at,
192|      })),
193|    });
194|  } catch (error) {
195|    console.error('Tutor history error:', error);
196|    return c.json({ error: 'Internal server error' }, 500);
197|  }
198|});
199|
200|// Generate contextual tutor response
201|function generateTutorResponse(message: string, context: any): string {
202|  const msg = message.toLowerCase();
203|
204|  if (msg.includes('madd')) {
205|    return `Great question about Madd! Since you're working on ${context.weakAreas.includes('grammar') ? 'grammar' : 'memorization'}, let me explain this in context.\n\nThere are three main types:\n1. **Madd Tabi'i** — 2 counts, like قَالَ\n2. **Madd Wajib** — 4-5 counts, like السَّآمَّة\n3. **Madd Lazim** — 6 counts, like الْحَآئِرِينَ\n\nWould you like practice exercises on Madd?`;
206|  }
207|
208|  if (msg.includes('grammar') || msg.includes('nahw') || msg.includes('سرف')) {
209|    return `Let's focus on grammar! Based on your recent attempts, you're doing well with basic nouns but could use more verb conjugation practice.\n\nTry this: هُوَ ___ الكِتَابَ\nOptions: أَكَلَ / كَتَبَ / قَرَأَ / ذَهَبَ\n\nThe answer is كَتَبَ (he wrote). You may be confusing verb patterns between Form I (فَعَلَ) and Form II (فَاعَلَ).`;
210|  }
211|
212|  if (msg.includes('memoriz') || msg.includes('hifz') || msg.includes('حفظ')) {
213|    const dueCount = context.memorizationDue.length;
214|    return `You have ${dueCount} ayahs due for review today. Here's a tip: review them in order, then test yourself by reciting from memory without looking.\n\nFor better retention, try the audio testing feature — listen to the ayah and type what you hear. This strengthens recall without visual cues.`;
215|  }
216|
217|  if (msg.includes('tajweed')) {
218|    return `Tajweed is essential for correct Quran recitation. Your current level suggests focusing on:\n\n• **Noon Saakin rules** — Idgham, Ikhfa, Izhar\n• **Madd types** — Tabi'i, Wajib, Lazim\n• **Qalqalah** — The bouncing sound of ق ط ب ج د\n\nWant me to generate practice exercises for a specific rule?`;
219|  }
220|
221|  return `I understand you're asking about "${message}". Based on your learning path (${context.currentPath}) and recent activity, I'd suggest:\n\n1. Practice your weak areas first\n2. Review your memorization due today\n3. Try a grammar exercise to reinforce what you've learned\n\nWould you like me to generate practice questions on a specific topic?`;
222|}
223|
224|// Extract topics from message
225|function extractTopics(message: string): string[] {
226|  const topics: string[] = [];
227|  const msg = message.toLowerCase();
228|
229|  if (msg.includes('madd') || msg.includes('مَدّ')) topics.push('madd');
230|  if (msg.includes('noon') || msg.includes('نون')) topics.push('noon-saakin');
231|  if (msg.includes('grammar') || msg.includes('nahw') || msg.includes('نحو')) topics.push('grammar');
232|  if (msg.includes('memoriz') || msg.includes('hifz') || msg.includes('حفظ')) topics.push('memorization');
233|  if (msg.includes('tajweed') || msg.includes('تجويد')) topics.push('tajweed');
234|  if (msg.includes('conjugat') || msg.includes('سرف')) topics.push('conjugation');
235|  if (msg.includes('balagha') || msg.includes('بلاغه')) topics.push('balagha');
236|
237|  return topics.length > 0 ? topics : ['general'];
238|}
239|