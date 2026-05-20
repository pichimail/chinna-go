import { useState, useRef, useEffect } from 'react';
import { Mic, X, Keyboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ai } from '../lib/gemini';
import { Modality } from '@google/genai';

export function Voice() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("Tap the microphone to start talking...");
  const [isConnecting, setIsConnecting] = useState(false);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const startLiveSession = async () => {
    try {
      setIsConnecting(true);
      setTranscript("Connecting...");

      // 1. Setup AudioContext for playback
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // 2. Setup Microphone capture
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      } });
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      sourceRef.current = audioContext.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContext.createScriptProcessor(4096, 1, 1);
      
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContext.destination);

      // 3. Connect to Live API
      const customInstructions = localStorage.getItem('chinna_instructions') || "Your name is Chinna. You are an intelligent, smart and advanced personal assistant application made by Project-M. You must never mention Gemini, Google, Lyria, or any other AI models. Keep your responses concise and natural.";
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: customInstructions,
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsRecording(true);
            setTranscript("Listening...");
            
            // Start sending audio
            processorRef.current!.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
          },
          onmessage: async (message: any) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              if (navigator.vibrate) navigator.vibrate([10, 30, 10]); // Haptic feedback for voice reply
              
              // Ensure AudioContext is running
              if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
              }

              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Convert Int16 PCM to Float32
              const float32Data = new Float32Array(bytes.length / 2);
              for (let i = 0; i < float32Data.length; i++) {
                const int16 = (bytes[i * 2 + 1] << 8) | bytes[i * 2];
                float32Data[i] = int16 / 32768;
              }
              
              const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 16000);
              buffer.copyToChannel(float32Data, 0);
              
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContextRef.current.destination);
              source.start();
              setTranscript("Speaking...");
            }
          },
          onclose: () => {
            stopLiveSession();
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            setTranscript("Connection error.");
            stopLiveSession();
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error("Failed to start Live session:", error);
      setTranscript("Failed to connect.");
      setIsConnecting(false);
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsRecording(false);
    setIsConnecting(false);
    setTranscript("Tap the microphone to start talking...");
  };

  useEffect(() => {
    return () => stopLiveSession();
  }, []);

  const toggleRecording = () => {
    if (navigator.vibrate) navigator.vibrate(20);
    if (isRecording || isConnecting) {
      stopLiveSession();
    } else {
      startLiveSession();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6 md:p-10 bg-app-bg relative overflow-hidden">
      {/* Topographic background lines specific to this view */}
      <div className="absolute inset-0 opacity-30 pointer-events-none bg-topo" />

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center mt-8">
        <div className="bg-app-lime text-black px-6 py-2 rounded-full font-semibold text-sm mb-3">
          AI Buddy
        </div>
        <div className="flex items-center gap-2 text-xs text-app-text-muted">
          <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-app-lime animate-pulse' : 'bg-red-500'}`} />
          {isRecording ? 'Online' : isConnecting ? 'Connecting...' : 'Offline'}
        </div>
      </div>

      {/* Center Orb (Visualizer) */}
      <div className="relative z-10 flex-1 flex items-center justify-center w-full max-w-sm">
        <motion.div
          animate={{
            scale: isRecording ? [1, 1.05, 1] : 1,
            rotate: isRecording ? 360 : 0,
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear"
          }}
          className="w-48 h-48 rounded-full relative flex items-center justify-center"
        >
          {/* Simulated 3D Orb using gradients and blur */}
          <div className={`absolute inset-0 rounded-full bg-gradient-to-tr from-app-purple via-blue-500 to-app-pink opacity-80 blur-lg mix-blend-screen transition-opacity duration-500 ${isRecording ? 'opacity-100' : 'opacity-30'}`} />
          <div className={`absolute inset-4 rounded-full bg-gradient-to-bl from-app-lime via-black to-app-purple opacity-90 blur-md transition-opacity duration-500 ${isRecording ? 'opacity-100' : 'opacity-30'}`} />
          <div className="absolute inset-6 rounded-full bg-gradient-to-t from-black via-transparent to-white/20 backdrop-blur-sm" />
        </motion.div>
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center mb-6">
        <p className="text-center text-sm font-medium mb-8 px-4 leading-relaxed h-12 flex items-center justify-center">
          {transcript}
        </p>

        <div className="flex items-center justify-center gap-6 w-full">
          <button 
            onClick={() => navigate('/chat')}
            aria-label="Switch to chat"
            className="w-12 h-12 rounded-xl bg-app-surface border border-white/10 flex items-center justify-center text-app-purple hover:bg-white/5 transition-colors"
          >
            <Keyboard className="w-5 h-5" />
          </button>

          <div className="relative">
            {/* Concentric rings for the mic button */}
            <div className={`absolute inset-[-10px] rounded-full border border-white/5 transition-opacity ${isRecording ? 'opacity-100 animate-ping' : 'opacity-0'}`} />
            <div className={`absolute inset-[-20px] rounded-full border border-white/5 transition-opacity ${isRecording ? 'opacity-100 animate-ping delay-150' : 'opacity-0'}`} />
            
            <button
              onClick={toggleRecording}
              disabled={isConnecting}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 z-20 relative ${
                isRecording 
                  ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                  : isConnecting 
                    ? 'bg-app-lime/50 cursor-not-allowed'
                    : 'bg-app-lime shadow-[0_0_20px_rgba(217,249,80,0.3)]'
              }`}
            >
              <Mic className={`w-8 h-8 ${isRecording ? 'text-white' : 'text-black'}`} />
            </button>
          </div>

          <button 
            onClick={() => navigate('/')}
            aria-label="Close voice assistant"
            className="w-12 h-12 rounded-xl bg-app-surface border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
