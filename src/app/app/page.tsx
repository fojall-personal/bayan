'use client';

import { useState } from 'react';

const goals = [
  { id: 'read-quran', emoji: '📖', title: 'Read the Quran fluently', description: 'Learn to read Arabic script and understand the text' },
  { id: 'understand-arabic', emoji: '🧠', title: 'Understand Classical Arabic', description: 'Master grammar, vocabulary, and comprehension' },
  { id: 'memorize-quran', emoji: '🕌', title: 'Memorize the Quran (Hifz)', description: 'Systematic memorization with spaced repetition' },
  { id: 'all', emoji: '✨', title: 'All of the above', description: 'Comprehensive learning path for all goals' }
];

export default function GoalSelection() {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0c0a09 0%, #1a1a2e 50%, #16213e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '20px',
        padding: '3rem',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '800',
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Language Builder
          </h1>
          <p style={{
            fontSize: '1.25rem',
            color: '#9ca3af',
            lineHeight: '1.6'
          }}>
            Learn Classical Arabic with Quran comprehension, grammar mastery, and memorization tools
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{
            fontSize: '1.875rem',
            fontWeight: '700',
            marginBottom: '1.5rem',
            color: '#f9fafb',
            textAlign: 'center'
          }}>
            What's your goal?
          </h2>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {goals.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setSelectedGoal(goal.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  padding: '1.5rem',
                  background: selectedGoal === goal.id ? 'rgba(34, 197, 94, 0.2)' : 'rgba(55, 65, 81, 0.5)',
                  border: `2px solid ${selectedGoal === goal.id ? '#22c55e' : '#4b5563'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  color: '#f9fafb',
                  textAlign: 'left',
                  fontSize: '1rem'
                }}
              >
                <span style={{ fontSize: '2.5rem' }}>{goal.emoji}</span>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                    {goal.title}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                    {goal.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          style={{
            width: '100%',
            padding: '1.25rem',
            background: selectedGoal ? 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)' : '#4b5563',
            color: '#0c0a09',
            fontSize: '1.25rem',
            fontWeight: '700',
            borderRadius: '12px',
            border: 'none',
            cursor: selectedGoal ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease',
            boxShadow: selectedGoal ? '0 10px 25px -5px rgba(34, 197, 94, 0.4)' : 'none'
          }}
          disabled={!selectedGoal}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
