import type { Database } from './db';
import { assignBand, isBand, type Band, type BandSource } from './band';

export async function persistBand(
  db: Database,
  userId: string,
  to: Band,
  source: BandSource | 'skip-quiz',
  from: Band | null,
  evidence?: unknown
): Promise<void> {
  const userSource: BandSource = source === 'skip-quiz' ? 'gate' : source;
  await db.run(
    `UPDATE users
        SET current_band = ?,
            band_source = ?,
            band_entered_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ?`,
    [to, userSource, userId]
  );
  await db.run(
    `INSERT INTO band_events (id, user_id, from_band, to_band, source, evidence)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      userId,
      from,
      to,
      source,
      evidence == null ? null : JSON.stringify(evidence),
    ]
  );
}

/** NULL-tolerant: compute backfill band and write it once. */
export async function ensureBand(db: Database, userId: string): Promise<Band | null> {
  const user = await db.get<{
    current_band: string | null;
    current_path: string | null;
  }>(`SELECT current_band, current_path FROM users WHERE id = ?`, [userId]);
  if (!user) return null;
  if (isBand(user.current_band)) return user.current_band;

  const roots = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM user_known_root WHERE user_id = ?`,
    [userId]
  );
  const band = assignBand({
    source: 'backfill',
    currentPath: user.current_path ?? 'path1',
    rootsKnown: roots?.n ?? 0,
  });
  await persistBand(db, userId, band, 'backfill', null, {
    current_path: user.current_path,
    rootsKnown: roots?.n ?? 0,
  });
  return band;
}
