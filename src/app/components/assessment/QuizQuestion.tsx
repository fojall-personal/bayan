'use client';

interface QuizQuestionProps {
  question: {
    id: string;
    type: 'multiple-choice' | 'fill-blank' | 'audio-recall';
    text: string;
    options?: string[];
    correctAnswer?: string;
    audioUrl?: string;
  };
  answer: string;
  onAnswer: (answer: string) => void;
}

export function QuizQuestion({ question, answer, onAnswer }: QuizQuestionProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-4">{question.text}</h3>

        {question.type === 'multiple-choice' && question.options && (
          <div className="space-y-3">
            {question.options.map((option, i) => (
              <button
                key={i}
                onClick={() => onAnswer(option)}
                className={`w-full p-4 text-left rounded-lg border transition-all ${
                  answer === option
                    ? 'border-arabic-green bg-arabic-green/10 text-arabic-green'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {question.type === 'fill-blank' && (
          <input
            type="text"
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-arabic-green/50"
          />
        )}
      </div>
    </div>
  );
}
