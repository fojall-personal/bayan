'use client';

import { useState, useRef } from 'react';

interface AudioPlayerProps {
  src: string;
  label?: string;
  onRecordingComplete?: (blob: Blob) => void;
  isRecording?: boolean;
}

export function AudioPlayer({ src, label, onRecordingComplete, isRecording }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handlePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleRecord = async () => {
    if (recording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          chunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());
          onRecordingComplete?.(blob);
        };

        mediaRecorder.start();
        setRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      {label && <p className="text-sm text-gray-400 mb-4">{label}</p>}

      <div className="flex items-center gap-4">
        <button
          onClick={handlePlay}
          className="w-12 h-12 rounded-full bg-arabic-green flex items-center justify-center hover:bg-arabic-green/90 transition-all"
        >
          {playing ? '⏸' : '▶️'}
        </button>

        <button
          onClick={handleRecord}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            recording
              ? 'bg-red-600 animate-pulse'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {recording ? '⏹' : '🎤'}
        </button>

        <div className="flex-1">
          <audio ref={audioRef} src={src} controls className="w-full" />
        </div>
      </div>
    </div>
  );
}
