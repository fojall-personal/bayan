import { MixedSessionRunner } from '@/components/session/MixedSessionRunner';

export const metadata = {
  title: 'Today’s session — Bayan',
  description:
    'A time-boxed sitting: typed hifz recall, vocabulary, function words, intensive reading, production, and freeflow.',
};

export default function SessionPage() {
  return <MixedSessionRunner />;
}
