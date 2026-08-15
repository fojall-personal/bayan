'use client';

const LETTERS = [
  'ا',
  'ب',
  'ت',
  'ث',
  'ج',
  'ح',
  'خ',
  'د',
  'ذ',
  'ر',
  'ز',
  'س',
  'ش',
  'ص',
  'ض',
  'ط',
  'ظ',
  'ع',
  'غ',
  'ف',
  'ق',
  'ك',
  'ل',
  'م',
  'ن',
  'ه',
  'و',
  'ي',
];

const EXTRA = ['ء', 'ى', 'ة'];

interface LetterPadProps {
  value: string;
  onChange: (next: string) => void;
}

export function LetterPad({ value, onChange }: LetterPadProps) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        inputMode="none"
        aria-label="Typed root"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\s+/g, ''))}
        className="text-naskh w-full rounded-md bg-ground-950 p-3 text-center text-3xl"
        dir="rtl"
        lang="ar"
      />
      <div className="grid grid-cols-7 gap-1" dir="rtl">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            className="text-naskh flex h-11 w-11 items-center justify-center rounded-md bg-ground-800 text-xl"
            lang="ar"
            onClick={() => onChange(value + letter)}
          >
            {letter}
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1" dir="rtl">
        {EXTRA.map((letter) => (
          <button
            key={letter}
            type="button"
            className="text-naskh flex h-11 w-11 items-center justify-center rounded-md bg-ground-800 text-xl"
            lang="ar"
            onClick={() => onChange(value + letter)}
          >
            {letter}
          </button>
        ))}
        <button
          type="button"
          className="flex h-11 min-w-11 items-center justify-center rounded-md bg-ground-800 px-3 text-sm"
          onClick={() => onChange(value.slice(0, -1))}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
