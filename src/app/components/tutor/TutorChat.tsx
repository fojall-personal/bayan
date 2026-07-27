'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost } from '@/lib/api';
import { Input } from '@/components/ui/Input';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  topics?: string[];
  /** True for turns restored from GET /api/tutor/history on mount. */
  restored?: boolean;
  createdAt?: string;
}

/** One weak lesson from GET /api/tutor/suggested-exercises. */
interface Suggestion {
  lessonId: string;
  module: string;
  title: string;
  attempts: number;
  answered: number;
  correct: number;
  accuracy: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/** Relative day count, for labelling restored turns. */
function whenLabel(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function TutorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [restoredCount, setRestoredCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Restore the conversation, and read what the learner actually got wrong.
  //
  // Both endpoints have existed since the tutor shipped and nothing called either,
  // so the chat opened empty every visit while tutor_conversations filled up, and
  // the suggestion chips were the same five strings for every learner.
  //
  // Failures here are deliberately silent: a tutor you can still type into beats an
  // error page, and neither call is required for the chat to work.
  const loadContext = useCallback(async () => {
    try {
      const res = await apiFetch<{
        data: { userMessage: string; assistantMessage: string; createdAt: string }[];
      }>('/api/tutor/history');
      // The endpoint returns newest first for its LIMIT 50; a transcript reads oldest
      // first. Only the last few turns are restored — the point is context, not an
      // archive to scroll past to reach the composer.
      const turns = (res.data ?? []).slice(0, 3).reverse();
      const restored: Message[] = [];
      turns.forEach((t, i) => {
        restored.push({
          id: `h-${i}-u`, role: 'user', content: t.userMessage,
          restored: true, createdAt: t.createdAt,
        });
        restored.push({
          id: `h-${i}-a`, role: 'assistant', content: t.assistantMessage,
          restored: true, createdAt: t.createdAt,
        });
      });
      if (restored.length > 0) {
        setMessages(restored);
        setRestoredCount(turns.length);
      }
    } catch {
      // No history is the normal case for a new learner.
    }
    try {
      const res = await apiFetch<{ data: { recommendations: Suggestion[] } }>(
        '/api/tutor/suggested-exercises'
      );
      setSuggestions(res.data?.recommendations ?? []);
    } catch {
      // Falls back to the generic prompts below.
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

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

  // The empty state for someone with no exercise history. Kept generic on purpose:
  // a learner who has finished nothing has no measured weakness, and inventing one
  // would be the same fabrication as inferring known roots from a placement score.
  const genericPrompts = [
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
          <div className="py-8 text-center text-ground-300">
            <p className="mb-2 text-lg">Ask about anything you are working on</p>
            <p className="text-sm text-ground-400">
              Grammar, tajweed or memorisation. Answers come from the corpus, and it
              says so when a word is not annotated rather than inventing one.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {genericPrompts.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="min-h-11 rounded-full border border-ground-800 bg-ground-900 px-4 text-sm transition-colors hover:border-gold-500/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Derived from quiz_attempts, not from a hardcoded list. Shown above the
            conversation because it is the reason to open the tutor at all. */}
        {suggestions.length > 0 && (
          <div className="rounded-lg border border-ground-800 bg-ground-900/60 p-4">
            <p className="text-xs uppercase tracking-label text-ground-400">
              Worth practising
            </p>
            <ul className="mt-3 space-y-2">
              {suggestions.slice(0, 3).map((sug) => (
                <li key={sug.lessonId}>
                  <div
                    className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                      sug.priority === 'high'
                        ? 'border-error/40'
                        : 'border-ground-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{sug.title}</p>
                      {/* The numbers, so the claim is checkable. The old endpoint
                          said "3 errors in this area" and meant three attempts. */}
                      <p className="mt-0.5 text-xs text-ground-400">{sug.reason}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/learning?lesson=${encodeURIComponent(sug.lessonId)}`}
                        className="min-h-11 whitespace-nowrap px-2 py-2 text-xs text-gold-400 hover:underline"
                      >
                        Practise
                      </Link>
                      <button
                        onClick={() =>
                          handleSend(`Explain what I keep getting wrong in "${sug.title}"`)
                        }
                        className="min-h-11 whitespace-nowrap rounded-md border border-ground-800 px-3 text-xs transition-colors hover:border-gold-500/50"
                      >
                        Ask
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Where the restored turns end and this session begins. Without this the
            learner cannot tell which replies are new. */}
        {restoredCount > 0 && (
          <p className="text-xs uppercase tracking-label text-ground-400">
            Earlier{messages[0]?.createdAt ? ` · ${whenLabel(messages[0].createdAt)}` : ''}
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-leaf-500 text-ground-50'
                  : 'bg-ground-800 text-ground-100'
              } ${msg.restored ? 'opacity-70' : ''}`}
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
                      className="rounded bg-ground-700/50 px-2 py-0.5 text-xs"
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
            <div className="rounded-lg bg-ground-800 p-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 animate-bounce rounded-full bg-ground-400"
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
