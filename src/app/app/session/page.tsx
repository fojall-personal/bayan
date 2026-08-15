import { MixedSessionRunner } from '@/components/session/MixedSessionRunner';

export const metadata = {
  title: 'Today’s session — Bayan',
  description:
    'A mixed, time-boxed practice session: due hifz, vocabulary, and the next lesson — chosen for you.',
};

export default function SessionPage() {
  return <MixedSessionRunner />;
}
