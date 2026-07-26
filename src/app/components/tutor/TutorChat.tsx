'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { apiPost } from '@/lib/api';
import { Input } from '@/components/ui/Input';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  topics?: string[];
}

export function TutorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Accepts an override so a suggestion chip sends immediately rather than only
  // filling the box, which read as a dead click (audit BUG-010).
  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiPost<{
        data?: { response?: string; topics?: string[] };
      }>('/api/tutor/chat', {
        message: userMessage.content,
        conversationHistory: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data?.response || 'Sorry, I couldn\'t process that.',
        topics: data.data?.topics || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Explain madd types',
    'Help with grammar',
    'Generate practice questions',
    'Tips for memorization',
    'Tajweed rules explanation',
  ];

  return (
    <div className="max-w-3xl mx-auto h-[600px] flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p className="text-lg mb-2">Welcome to your AI Tutor!</p>
            <p className="text-sm">Ask me anything about Arabic grammar, Quran memorization, or tajweed.</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm hover:bg-gray-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-leaf-500 text-ground-50'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              {/* Same fix as AssessmentFlow: dir="auto" instead of forcing RTL
                  whenever a message contains any Arabic. Tutor replies mix
                  English prose with Arabic terms constantly, and forcing RTL
                  reordered the English and threw its punctuation to the wrong
                  end. This is the third instance of that mistake in this
                  codebase \u2014 the tutor INPUT was hardcoded RTL once too. */}
              <p
                dir="auto"
                className={`whitespace-pre-wrap text-sm ${
                  /[\u0600-\u06FF]/.test(msg.content) ? 'text-naskh' : ''
                }`}
              >
                {msg.content}
              </p>
              {msg.topics && msg.topics.length > 0 && (
                <div className="mt-2 flex gap-1">
                  {msg.topics.map((topic) => (
                    <span
                      key={topic}
                      className="text-xs bg-gray-600/50 px-2 py-0.5 rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 p-3 rounded-lg">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        {/* dir was hardcoded "rtl", so English typed backwards. 'auto' picks
          * direction from what has actually been typed. */}
        <Input
          dir="auto"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about grammar, tajweed or memorisation"
          aria-label="Message the tutor"
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-6"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
