import { readFileSync } from 'fs';
import { join } from 'path';

const lessonsPath = join(process.cwd(), 'content/grammar/lessons.json');
const lessons = JSON.parse(readFileSync(lessonsPath, 'utf-8'));

console.log(`\n🌱 Seeding ${lessons.length} grammar lessons into D1 database...`);

const sqlStatements = lessons.map(lesson => {
  const content = JSON.stringify(lesson.content);
  const exercises = JSON.stringify(lesson.exercises);
  const prerequisites = JSON.stringify(lesson.prerequisites || []);
  
  return `INSERT OR IGNORE INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes) VALUES ('${lesson.id}', '${lesson.title.replace(/'/g, "''")}', '${lesson.module}', ${lesson.level}, '${content.replace(/'/g, "''")}', '${exercises.replace(/'/g, "''")}', '${prerequisites.replace(/'/g, "''")}', ${lesson.estimated_minutes});`;
});

console.log('SQL Statements Generated:');
sqlStatements.forEach((sql, i) => {
  console.log(`\n--- Lesson ${i + 1}/${sqlStatements.length} ---`);
  console.log(sql.substring(0, 200) + '...');
});

console.log('\n\n📋 To execute, run:');
console.log(`npx wrangler d1 execute languagebuilder --remote --command "${sqlStatements.join('; ')}" 2>&1`);
