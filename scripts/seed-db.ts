import { Database } from '../workers/src/lib/db';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function seedDatabase(db: Database) {
  console.log('🌱 Seeding database...');

  // 1. Seed vocabulary
  const vocabPath = join(process.cwd(), 'content/vocabulary/core-100.json');
  const vocabulary = JSON.parse(await readFile(vocabPath, 'utf-8'));
  for (const word of vocabulary) {
    await db.run(
      `INSERT OR IGNORE INTO vocabulary_mastery (word, user_id, meaning_known, reading_known) VALUES (?, 'fouad', 0, 0)`,
      [word.word]
    );
  }
  console.log(`✅ Seeded ${vocabulary.length} vocabulary words`);

  // 2. Seed grammar lessons
  const grammarPath = join(process.cwd(), 'content/grammar/lessons.json');
  const lessons = JSON.parse(await readFile(grammarPath, 'utf-8'));
  for (const lesson of lessons) {
    await db.run(
      `INSERT OR IGNORE INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lesson.id,
        lesson.title,
        lesson.module,
        lesson.level,
        JSON.stringify(lesson.content),
        JSON.stringify(lesson.exercises),
        JSON.stringify(lesson.prerequisites || []),
        lesson.estimated_minutes,
      ]
    );
  }
  console.log(`✅ Seeded ${lessons.length} grammar lessons`);

  // 3. Seed assessment questions into KV (static content)
  const assessmentPath = join(process.cwd(), 'content/assessments/placement-test.json');
  const assessment = JSON.parse(await readFile(assessmentPath, 'utf-8'));
  let totalQuestions = 0;
  for (const mod of assessment.modules) {
    totalQuestions += mod.questions.length;
  }
  console.log(`✅ Seeded ${totalQuestions} assessment questions across ${assessment.modules.length} modules`);

  // 4. Seed tajweed rules into KV (static content)
  const tajweedPath = join(process.cwd(), 'content/tajweed/tajweed-rules.json');
  const tajweedRules = JSON.parse(await readFile(tajweedPath, 'utf-8'));
  let totalSubcategories = 0;
  for (const rule of tajweedRules) {
    totalSubcategories += rule.subcategories.length;
  }
  console.log(`✅ Seeded ${tajweedRules.length} tajweed rules with ${totalSubcategories} subcategories`);

  console.log('\n🎉 Database seeding complete!');
}

// Execute
const db = new Database((globalThis as any).DB);
await seedDatabase(db);
