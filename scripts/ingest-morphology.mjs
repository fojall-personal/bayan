#!/usr/bin/env node
/**
 * Ingest the Quranic Arabic Corpus morphology data into D1.
 *
 * Source: https://corpus.quran.com/download/ (Version 0.4)
 * License: GNU GPL - attribution required with link to corpus.quran.com
 *
 * Usage:
 *   node scripts/ingest-morphology.mjs --text data/quranic-corpus-morphology-0.4.txt > /tmp/morphology.sql
 *   cd workers && npx wrangler d1 execute languagebuilder --remote --file=/tmp/morphology.sql
 */

import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const textPath = args[args.indexOf('--text') + 1];

if (!textPath) {
  console.error('Usage: node scripts/ingest-morphology.mjs --text path/to/file.txt');
  process.exit(1);
}

console.log('-- Quranic Arabic Corpus Morphology Ingest');
console.log('-- Source: https://corpus.quran.com/download/');
console.log('-- License: GNU GPL (attribution required)');

// Create table if not exists
console.log(`
CREATE TABLE IF NOT EXISTS quran_word_morphology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surah_id INTEGER NOT NULL,
  ayah_id INTEGER NOT NULL,
  word_index INTEGER NOT NULL,
  form TEXT,
  tag TEXT,
  lemma TEXT,
  root TEXT,
  pos TEXT,
  gender TEXT,
  case_case TEXT,
  UNIQUE(surah_id, ayah_id, word_index)
);
`);

const content = await readFile(textPath, 'utf-8');
const lines = content.split('\n');
let count = 0;
let insertBuffer = '';
const BATCH_SIZE = 500;

for (const line of lines) {
  if (line.startsWith('#') || line.trim() === '') continue;
  
  const parts = line.split('\t');
  if (parts.length < 4) continue;
  
  const location = parts[0];
  const form = parts[1];
  const tag = parts[2];
  const features = parts[3];
  
  // Parse location: (surah:ayah:wordIndex:?)
  const locMatch = location.match(/\((\d+):(\d+):(\d+):\d+\)/);
  if (!locMatch) continue;
  
  const surahId = parseInt(locMatch[1]);
  const ayahId = parseInt(locMatch[2]);
  const wordIndex = parseInt(locMatch[3]);
  
  // Parse features
  let lemma = null;
  let root = null;
  let pos = null;
  let gender = null;
  let caseCase = null;
  
  // Extract LEM
  const lemMatch = features.match(/LEM:\{([^}]+)\}/);
  if (lemMatch) lemma = lemMatch[1];
  
  // Extract ROOT
  const rootMatch = features.match(/ROOT:([^|]+)/);
  if (rootMatch) root = rootMatch[1];
  
  // Extract POS
  const posMatch = features.match(/POS:([A-Z]+)/);
  if (posMatch) pos = posMatch[1];
  
  // Extract gender (M, F, MP, FP)
  const genderMatch = features.match(/\|M\|/);
  if (genderMatch) gender = 'M';
  const femMatch = features.match(/\|F\|/);
  if (femMatch) gender = 'F';
  const mpMatch = features.match(/\|MP\|/);
  if (mpMatch) gender = 'MP';
  const fpMatch = features.match(/\|FP\|/);
  if (fpMatch) gender = 'FP';
  
  // Extract case (NOM, GEN, ACC)
  const nomMatch = features.match(/\|NOM$/);
  if (nomMatch) caseCase = 'NOM';
  const genMatch = features.match(/\|GEN$/);
  if (genMatch) caseCase = 'GEN';
  const accMatch = features.match(/\|ACC$/);
  if (accMatch) caseCase = 'ACC';
  
  // Build INSERT statement
  const values = [
    surahId,
    ayahId,
    wordIndex,
    form ? `'${form.replace(/'/g, "''")}'` : 'NULL',
    tag ? `'${tag.replace(/'/g, "''")}'` : 'NULL',
    lemma ? `'${lemma.replace(/'/g, "''")}'` : 'NULL',
    root ? `'${root.replace(/'/g, "''")}'` : 'NULL',
    pos ? `'${pos.replace(/'/g, "''")}'` : 'NULL',
    gender ? `'${gender.replace(/'/g, "''")}'` : 'NULL',
    caseCase ? `'${caseCase.replace(/'/g, "''")}'` : 'NULL'
  ];
  
  insertBuffer += `INSERT OR IGNORE INTO quran_word_morphology (surah_id, ayah_id, word_index, form, tag, lemma, root, pos, gender, case_case) VALUES (${values.join(', ')});\n`;
  count++;
  
  if (count % BATCH_SIZE === 0) {
    console.log(insertBuffer);
    insertBuffer = '';
  }
}

// Flush remaining
if (insertBuffer) {
  console.log(insertBuffer);
}

console.log(`-- Ingested ${count} rows`);
