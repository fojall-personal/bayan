'use client';

import { useState, useRef } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<MediaRecorder>;
  stopRecording: () => Blob | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async (): Promise<MediaRecorder> => {
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
      };

      mediaRecorder.start();
      setIsRecording(true);
      return mediaRecorder;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  };

  const stopRecording = (): Blob | null => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return new Blob(chunksRef.current, { type: 'audio/webm' });
    }
    return null;
  };

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
