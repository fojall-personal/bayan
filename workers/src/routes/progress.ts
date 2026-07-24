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
5|export const progressRoutes = new Hono<{ Bindings: { DB: Database } }>();
6|
7|// GET /api/progress/dashboard — Complete dashboard data
8|progressRoutes.get('/dashboard', async (c) => {
9|  const { id: userId } = getCurrentUser();
10|  const db = getDB(c);
11|
12|  try {
13|    // Fetch all dashboard data
14|    const [user, latestAssessment, lessonProgress, dueMemorization, streak] =
15|      await Promise.all([
16|        db.get<Record<string, unknown>>(
17|          `SELECT * FROM users WHERE id = ?`,
18|          [userId]
19|        ),
20|        db.get<Record<string, unknown>>(
21|          `SELECT * FROM assessment_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1`,
22|          [userId]
23|        ),
24|        db.query<Record<string, unknown>>(
25|          `SELECT * FROM lesson_progress WHERE user_id = ? ORDER BY last_practiced DESC LIMIT 10`,
26|          [userId]
27|        ),
28|        db.query<Record<string, unknown>>(
29|          `SELECT * FROM memorization WHERE user_id = ? AND next_review <= datetime('now')`,
30|          [userId]
31|        ),
32|        calculateStreak(db, userId),
33|      ]);
34|
35|    if (!user) {
36|      return c.json({ error: 'User not found' }, 404);
37|    }
38|
39|    // Calculate summary metrics
40|    const totalLessons = await db.get<Record<string, unknown>>(
41|      `SELECT COUNT(*) as count FROM lessons`
42|    );
43|    const completedLessons = await db.query<Record<string, unknown>>(
44|      `SELECT COUNT(*) as count FROM lesson_progress WHERE completed = 1 AND user_id = ?`,
45|      [userId]
46|    );
47|    const memorizedSurahs = await db.query<Record<string, unknown>>(
48|      `SELECT DISTINCT surah_id FROM memorization WHERE user_id = ? AND status = 'mastered'`,
49|      [userId]
50|    );
51|    const vocabularyReviewed = await db.get<Record<string, unknown>>(
52|      `SELECT COUNT(*) as count FROM vocabulary_mastery WHERE user_id = ? AND last_seen >= datetime('now', '-7 days')`,
53|      [userId]
54|    );
55|
56|    const weeklyProgress = await getWeeklyProgress(db, userId);
57|
58|    return c.json({
59|      data: {
60|        user: {
61|          id: user.id,
62|          goal: user.goal,
63|          onboarding_completed: (user.onboarding_completed as number) === 1,
64|          current_path: user.current_path,
65|          created_at: user.created_at,
66|        },
67|        latestAssessment: latestAssessment
68|          ? {
69|              ...latestAssessment,
70|              details: JSON.parse((latestAssessment.details as string) || '{}'),
71|            }
72|          : null,
73|        todayReview: dueMemorization || [],
74|        streak,
75|        stats: {
76|          totalLessons: (totalLessons?.count as number) || 0,
77|          completedLessons: (completedLessons?.[0]?.count as number) || 0,
78|          memorizedSurahs: (memorizedSurahs?.length as number) || 0,
79|          vocabularyReviewed: (vocabularyReviewed?.count as number) || 0,
80|        },
81|        weeklyProgress,
82|        lastLesson: lessonProgress?.[0] || null,
83|      },
84|    });
85|  } catch (error) {
86|    console.error('Dashboard error:', error);
87|    return c.json({ error: 'Internal server error' }, 500);
88|  }
89|});
90|
91|// GET /api/progress/scores — Score history for charts
92|progressRoutes.get('/scores', async (c) => {
93|  const { id: userId } = getCurrentUser();
94|  const db = getDB(c);
95|
96|  try {
97|    const history = await db.query<Record<string, unknown>>(
98|      `SELECT literacy_score, comprehension_score, grammar_score, memorization_score, completed_at
99|       FROM assessment_results
100|       WHERE user_id = ?
101|       ORDER BY completed_at ASC`,
102|      [userId]
103|    );
104|
105|    return c.json({
106|      data: history.map((row) => ({
107|        literacy_score: row.literacy_score,
108|        comprehension_score: row.comprehension_score,
109|        grammar_score: row.grammar_score,
110|        memorization_score: row.memorization_score,
111|        completed_at: row.completed_at,
112|      })),
113|    });
114|  } catch (error) {
115|    console.error('Scores history error:', error);
116|    return c.json({ error: 'Internal server error' }, 500);
117|  }
118|});
119|
120|// Calculate streak
121|async function calculateStreak(db: Database, userId: string): Promise<number> {
122|  let streak = 0;
123|  let checkDate = new Date();
124|
125|  // Check if user was active today
126|  const today = await db.get<Record<string, unknown>>(
127|    `SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ? AND DATE(last_practiced) = DATE('now')`,
128|    [userId]
129|  );
130|
131|  if (!today || today.count === 0) {
132|    // Check yesterday
133|    checkDate.setDate(checkDate.getDate() - 1);
134|  }
135|
136|  // Count consecutive days
137|  while (true) {
138|    const dayData = await db.get<Record<string, unknown>>(
139|      `SELECT COUNT(*) as count FROM lesson_progress
140|       WHERE user_id = ? AND DATE(last_practiced) = DATE(?, '-' || ? || ' days')`,
141|      [userId, new Date().toISOString(), streak]
142|    );
143|
144|    if (!dayData || dayData.count === 0) break;
145|    streak++;
146|  }
147|
148|  return streak;
149|}
150|
151|// Get weekly progress
152|async function getWeeklyProgress(
153|  db: Database,
154|  userId: string
155|): Promise<{ lessonsCompleted: number; reviewsCompleted: number; targetLessons: number; targetReviews: number }> {
156|  const startOfWeek = new Date();
157|  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
158|  startOfWeek.setHours(0, 0, 0, 0);
159|
160|  const lessons = await db.query<Record<string, unknown>>(
161|    `SELECT lesson_id FROM lesson_progress
162|     WHERE user_id = ? AND last_practiced >= ?`,
163|    [userId, startOfWeek.toISOString()]
164|  );
165|
166|  const reviews = await db.query<Record<string, unknown>>(
167|    `SELECT id FROM memorization
168|     WHERE user_id = ? AND last_reviewed >= ?`,
169|    [userId, startOfWeek.toISOString()]
170|  );
171|
172|  return {
173|    lessonsCompleted: lessons.length,
174|    reviewsCompleted: reviews.length,
175|    targetLessons: 5,
176|    targetReviews: 10,
177|  };
178|}
179|