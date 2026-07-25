-- Seed grammar lessons into D1 database
-- Content from content/grammar/lessons.json

INSERT OR IGNORE INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes) VALUES (
  'grammar-01',
  'Articles and Nouns (al- and Nouns)',
  'grammar',
  1,
  '{"explanation":"Arabic nouns are either definite or indefinite. The definite article is ال (al-). When attached, it changes based on the first letter of the noun—sun letters cause assimilation, moon letters keep the ل sound.","examples":[{"arabic":"الْكِتَابُ","transliteration":"al-kitābu","meaning":"the book","rule":"Sun letter — ال assimilates to ت"},{"arabic":"الْقَمَرُ","transliteration":"al-qamaru","meaning":"the moon","rule":"Moon letter — ال keeps its ل sound"}],"rules":[{"name":"Sun Letters (حروف شمسية)","description":"When ال attaches to a noun starting with one of these letters, the ل is dropped and the following letter takes a shadda","letters":"ت ث د ذ ر ز س ش ص ط ظ ل ن","examples":["الْعَيْنُ","الْوَجْهُ","الْمَاءُ"]},{"name":"Moon Letters (حروف قمرية)","description":"When ال attaches to a noun starting with one of these letters, the ل is pronounced","letters":"ا ب ج ح خ ع غ ف ق ك م ه و ي","examples":["الْبَابُ","الْجَبَلُ","الْقَمَرُ"]}]}' ,
  '[{"type":"multiple_choice","question":"Which of these is a moon letter?","options":["ت","س","ب","ر"],"correct":2,"explanation":"ب is a moon letter. ت، س، and ر are sun letters."},{"type":"fill_blank","question":"Complete: ال + كِتَاب = ___","correct":"الْكِتَابُ","explanation":"ك is a moon letter, so the ل is pronounced."}]',
  '[]',
  20
);

INSERT OR IGNORE INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes) VALUES (
  'grammar-02',
  'Verb Conjugation — Past Tense (الماضي)',
  'grammar',
  1,
  '{"explanation":"Arabic verbs change based on the subject. The past tense (ماضي) is the simplest form — add suffixes to the root to indicate who performed the action.","conjugation_table":{"root":"ك ت ب","meaning":"to write","forms":{"he":"كَتَبَ","she":"كَتَبَتْ","they_two":"كَتَبَا","they_men":"كَتَبُوا","they_women":"كَتَبْنَ","you_m":"كَتَبْتَ","you_f":"كَتَبْتِ","we":"كَتَبْنَا","I":"كَتَبْتُ"}}}',
  '[{"type":"match","question":"Match the conjugation of كَتَبَ (he wrote) with the correct subject","pairs":[{"item":"كَتَبُوا","answer":"they (men) wrote"},{"item":"كَتَبْنَ","answer":"they (women) wrote"},{"item":"كَتَبْنَا","answer":"we wrote"}]}]',
  '["grammar-01"]',
  25
);

INSERT OR IGNORE INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes) VALUES (
  'grammar-03',
  'Sentence Structure — Nominal Sentences (الجملة الاسمية)',
  'grammar',
  1,
  '{"explanation":"Arabic sentences begin with either a noun (nominal sentence / جملة اسمية) or a verb (verbal sentence / جملة فعلية). A nominal sentence has two parts: the subject (مبتدأ) and the predicate (خبر).","examples":[{"arabic":"الْكِتَابُ مَفْتُوحٌ","transliteration":"al-kitābu maftūḥun","meaning":"The book is open","structure":"مبتدأ + خبر"},{"arabic":"اللَّهُ كَبِيرٌ","transliteration":"allāhu kabīrun","meaning":"God is Great","structure":"مبتدأ + خبر"}]}' ,
  '[{"type":"multiple_choice","question":"Identify the مبتدأ (subject) in: الْبَابُ مَسْدُودٌ","options":["مَسْدُودٌ","الْبَابُ","the whole sentence"],"correct":1,"explanation":"الْبَابُ is the مبتدأ (subject/noun that begins the sentence)."}]',
  '["grammar-01"]',
  20
);

INSERT OR IGNORE INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes) VALUES (
  'grammar-04',
  'Verb Conjugation — Present Tense (المضارع)',
  'grammar',
  2,
  '{"explanation":"The present tense (مضارع) is formed by adding prefixes to the verb root. The prefix indicates the subject: أ (I), ت (you/he/she), ي (he/she), ن (we).","conjugation_table":{"root":"ك ت ب","meaning":"to write","forms":{"I":"أَكْتُبُ","you_m":"تَكْتُبُ","he":"يَكْتُبُ","she":"تَكْتُبُ","we":"نَكْتُبُ","they_m":"يَكْتُبُونَ","they_w":"يَكْتُبْنَ"}}}',
  '[{"type":"fill_blank","question":"Complete: يَكْتُبُ → they (men) write = ___","correct":"يَكْتُبُونَ","explanation":"The plural masculine suffix is وُنا for present tense."}]',
  '["grammar-02"]',
  25
);

INSERT OR IGNORE INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes) VALUES (
  'grammar-05',
  'Case Endings — I''rab Basics (الإعراب)',
  'grammar',
  2,
  '{"explanation":"Arabic nouns change their ending based on their grammatical role in the sentence. This is called i''rab (إعراب). The three cases are: nominative (مرفوع) with ـُ, accusative (منصوب) with ـَ, genitive (مجرور) with ـِ.","examples":[{"arabic":"جَاءَ الرَّجُلُ","transliteration":"jā''a ar-rajulu","meaning":"The man came","case":"مرفوع (nominative — subject)"},{"arabic":"رَأَيْتُ الرَّجُلَ","transliteration":"ra''aytu ar-rajula","meaning":"I saw the man","case":"منصوب (accusative — object)"},{"arabic":"ذَهَبْتُ إِلَى الرَّجُلِ","transliteration":"dhahabtu ilā ar-rajuli","meaning":"I went to the man","case":"مجرور (genitive — after preposition)"}]}' ,
  '[{"type":"multiple_choice","question":"What case ending does the subject of a sentence take?","options":["ـُ (damma)","ـَ (fatha)","ـِ (kasra)"],"correct":0,"explanation":"The subject (فاعل) takes the nominative case with damma (ـُ)."}]',
  '["grammar-03"]',
  30
);
