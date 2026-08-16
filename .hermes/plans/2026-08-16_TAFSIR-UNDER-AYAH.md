# Tafsir under the ayah — plan

| Field | Value |
|---|---|
| **Date** | 2026-08-16 |
| **Status** | Deferred 2026-08-16. Stay with Saheeh International. No ingest until a rights holder writes a redistribution grant. |
| **Extends** | Meaning-lens translation block in `AyahReader.tsx`; ingest pattern in `scripts/ingest-translation.mjs` |
| **Cost** | Must stay $0. Static ingest only. No Workers AI. No live API at read time. |

Meaning already ends with Saheeh International. Recite and `/tajweed` show the script only. Tafsir is a third claim: commentary, not a translation, not a gloss.

---

## What we found (English, downloadable)

QUL (Tarteel) lists five English tafsirs as JSON/SQLite. QUL's own FAQ says **each resource keeps its author's licence**. A QUL download is not a licence grant.

| Source | Form | Fits the reader? | Can we commit it to the repo? |
|---|---|---|---|
| **English Al-Mukhtasar** (Tafsir Center, QUL 266) | Short paragraph per ayah or small group. Previewed on QUL. | Yes. Collapsed block. | **Unknown.** No written CC/public-domain grant found. First email. |
| **Tafsir al-Jalalayn**, Feras Hamza (Aal al-Bayt / altafsir.com) | Classical, per-ayah, also on QUL. | Yes, a bit denser. | **No.** On-page notice: © Royal Aal al-Bayt Institute, All Rights Reserved (greattafsirs.com 2021). |
| **Ibn Kathir English** (QUL 35; usual Darussalam abridgment) | Long. Often spans many ayahs. | Too long to open under Recite. | **No**, unless Darussalam / the specific edition writes permission. |
| **Maarif-ul-Quran** English | Long, 8 volumes. | Too long. | **No.** Archive.org copy is CC BY-NC-ND 3.0. ND + NC is stricter than Tanzil CC BY. |
| **Tazkirul Quran** (Wahiduddin Khan) | Mid length. | Possible. | **Unknown.** Need the author's / Goodword terms. |
| **Quran Foundation / Quran.com API** | Several tafsirs, including Kathir and Mukhtasar. | Display only. | **No dump in git.** Terms (2026-08-10): do not redistribute raw API data; cache ≤ 1 week unless Content Sync + 7-day refresh. Needs credentials and a live network. Breaks the $0 offline ingest model. |
| **Tanzil** | Translations only. | Already used for Saheeh. | No tafsir files. |
| **spa5k/tafsir_api** | Scraped JSON. MIT is the *code*. | — | **No.** MIT does not transfer Aal al-Bayt or Darussalam copyright. |
| **Alsadiqin Tafsir Al-Qur'an** | Modern English of classical notes. GFDL 1.3. | Unproven coverage. | Possible if we accept GFDL copyleft on the bundled text. Not first cut. |

**First cut, if and only if Tafsir Center says yes in writing: English Al-Mukhtasar.**

It is short, ayah-keyed, already used in many apps, and it matches a closed disclosure. Jalalayn is the better classical text and is the one we must not ship without a letter from Aal al-Bayt.

---

## What the screen looks like

Not a sixth lens. Not a `/tafsir` route.

**Recite and `/tajweed`:** after the ayah, a closed line:

`Tafsir · Al-Mukhtasar`

Tap opens 4–8 lines. Tap again closes it. Source line under the text.

**Meaning:** the same block after the existing Saheeh block. Translation stays a sentence. Tafsir stays commentary.

If the row is missing, the block says the source is silent. It does not invent a reading.

Tafsir often covers a *group* of ayahs. The JSON shape QUL already uses (`ayah_keys` + a pointer) is the right model. The UI shows the group's text once, and names the span (`2:3–2:5`).

---

## How it stays $0 and pinned

Same shape as `ingest-translation.mjs`:

1. Source file lives under `data/` (already gitignored).
2. Script pins SHA-256 and refuses a swapped file.
3. Emits SQL into `quran_tafsir`.
4. CI does **not** fetch. `--check` only runs when the file is present (same skip as treebank).
5. Production gets the SQL once, the way lessons and the exercise bank do.

```
quran_tafsir (
  source_id   TEXT NOT NULL,   -- 'mukhtasar-en'
  surah_id    INTEGER NOT NULL,
  ayah_id     INTEGER NOT NULL,
  group_from  INTEGER NOT NULL,
  group_to    INTEGER NOT NULL,
  text        TEXT NOT NULL,
  PRIMARY KEY (source_id, surah_id, ayah_id)
)
```

`GET /api/quran/ayah/:s/:a` grows an optional `tafsir` object. `/api/tajweed/verses/:surah` can attach a short flag or the same object per verse. No extra origin, no CORS, no model.

`data/` stays gitignored. The **ingest script + SHA + attribution line** live in the repo. That is how morphology and Tanzil already work. We do not commit a 2–20 MB copyrighted dump.

---

## Licence gate (do this before any PR)

Write Tafsir Center for Qur'anic Studies (Mukhtasar English):

- May we store the English Mukhtasar in a private app database?
- May we display it with attribution?
- May we keep a SHA-pinned copy under a gitignored `data/` path?

Until that answer is yes, do not ingest. Displaying a scraped file is the same class of error as the invented-Arabic tutor.

Optional second letter: Royal Aal al-Bayt, for Jalalayn (Feras Hamza). That is a later volume, not the first cut.

---

## PR cut

| # | Work | Blocked on |
|---|---|---|
| T0 | Written licence for Mukhtasar English | — |
| T1 | Migration `0030_quran_tafsir.sql` + types | T0 |
| T2 | `scripts/ingest-tafsir.mjs` — SHA pin, group expansion, 6,236 coverage assert | T0 |
| T3 | `GET /api/quran/ayah` returns `{ source, text, span }` or null | T1, T2 |
| T4 | Closed disclosure on Recite + Meaning | T3 |
| T5 | Same disclosure on `/tajweed` verse cards | T3 |
| T6 | Attribution on the three surfaces + README source table | T4, T5 |

T0 is the whole risk. T1–T6 are a small ingest, the size of the Saheeh translation work.

---

## Non-goals

- A tafsir picker.
- Ibn Kathir in the first cut (length + copyright).
- Live Quran.com fetches.
- AI paraphrase of a copyrighted tafsir.
- Committing raw tafsir JSON to git.

---

## Risk

QUL's download buttons are not a licence. Jalalayn English is explicitly reserved. Ibn Kathir English and Maarif fail the same test this repo already uses for the treebank: if we cannot name the grant, we do not teach from the file.

I have not emailed Tafsir Center. The plan stops at that letter.
