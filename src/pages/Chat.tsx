import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ai, chatTools, generateImage, generateVideo, generateMusic } from '../lib/gemini';
import { Mic, Image as ImageIcon, Send, Play, Pause, Download, Loader2, Music, Paperclip, FileText, Video, X, MessageSquare } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { toast } from 'sonner';
import { vibrate, HAPTICS } from '../lib/haptics';

import { AudioPlayer } from '../components/AudioPlayer';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  media?: {
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    mimeType?: string;
    name?: string;
    albumArt?: string;
  };
  isGenerating?: boolean;
}

const PREDEFINED_PROMPTS = [
  "Summarize this",
  "Explain key points",
  "Extract data",
  "Translate to Telugu"
];

export function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    file: File;
    base64: string;
    type: 'image' | 'video' | 'audio' | 'document';
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid, 'chats', 'current');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMessages(docSnap.data().messages || []);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      } finally {
        setIsInitialLoad(false);
      }
    };
    loadMessages();
  }, [user]);

  // Auto-save messages
  useEffect(() => {
    const saveMessages = async () => {
      if (!user || messages.length === 0 || isInitialLoad) return;
      try {
        // Sanitize messages to remove undefined values
        const sanitizedMessages = JSON.parse(JSON.stringify(messages));
        const docRef = doc(db, 'users', user.uid, 'chats', 'current');
        await setDoc(docRef, { messages: sanitizedMessages, updatedAt: serverTimestamp() }, { merge: true });
        
        // Only show toast if it's not the initial load and there are messages
        if (!isInitialLoad && messages.length > 0) {
          toast.success('Chat auto-saved', { duration: 1500, style: { background: '#1a1a1a', color: '#fff', border: '1px solid #333' } });
        }
      } catch (error) {
        console.error("Failed to auto-save chat:", error);
      }
    };
    
    const timeoutId = setTimeout(() => {
      saveMessages();
    }, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [messages, user, isInitialLoad]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() && !attachedFile) return;
    
    const currentFile = attachedFile;
    setAttachedFile(null); // Clear immediately

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      media: currentFile ? { 
        type: currentFile.type, 
        url: currentFile.base64, 
        mimeType: currentFile.file.type,
        name: currentFile.file.name
      } : undefined
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare contents
      const contents: any = [];
      
      if (currentFile) {
        // Handle ZIP files by extracting text contents
        if (currentFile.file.name.endsWith('.zip') || currentFile.file.type === 'application/zip') {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(currentFile.file);
          let combinedText = `Contents of ${currentFile.file.name}:\n\n`;
          let fileCount = 0;
          
          for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir && fileCount < 10) { // Limit to 10 files to avoid massive prompts
              if (filename.match(/\.(txt|md|js|ts|jsx|tsx|html|css|json|csv|py)$/i)) {
                const content = await zipEntry.async("string");
                combinedText += `--- ${filename} ---\n${content.substring(0, 5000)}\n\n`; // Limit content per file
                fileCount++;
              }
            }
          }
          contents.push({ text: combinedText });
        } 
        // Handle PDF files
        else if (currentFile.file.type === 'application/pdf' || currentFile.file.name.endsWith('.pdf')) {
          const arrayBuffer = await currentFile.file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = `Contents of ${currentFile.file.name}:\n\n`;
          const numPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages
          
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
          }
          contents.push({ text: fullText });
        }
        // Handle text-based files directly
        else if (currentFile.file.type.startsWith('text/') || currentFile.file.name.match(/\.(js|ts|jsx|tsx|html|css|json|csv|py|md)$/i)) {
           const textContent = await currentFile.file.text();
           contents.push({ text: `File: ${currentFile.file.name}\n\n${textContent}` });
        } 
        // Handle standard media types (images, audio, video, pdf)
        else {
          contents.push({
            inlineData: {
              data: currentFile.base64.split(',')[1],
              mimeType: currentFile.file.type || 'application/octet-stream'
            }
          });
        }
      }

      if (text) contents.push(text);

      // Call Gemini with tools
      const customInstructions = localStorage.getItem('chinna_instructions') || "Your name is Chinna. You are an intelligent, smart and advanced personal assistant application made by Project-M. You must never mention Gemini, Google, Lyria, or any other AI models. You can chat, generate images, videos, and music. If the user asks for media generation, use the provided tools. You can also analyze files, transcribe audio, and summarize documents.";
      
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents,
        config: {
          tools: chatTools,
          systemInstruction: customInstructions,
        }
      });

      let isFirstChunk = true;
      let functionCall: any = null;
      let accumulatedText = '';
      const messageId = Date.now().toString();

      for await (const chunk of responseStream) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          functionCall = chunk.functionCalls[0];
          break;
        }

        if (isFirstChunk && chunk.text) {
          setMessages(prev => [...prev, {
            id: messageId,
            role: 'model',
            text: ''
          }]);
          isFirstChunk = false;
        }

        if (chunk.text) {
          accumulatedText += chunk.text;
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: accumulatedText } : m));
          vibrate(HAPTICS.light); // Haptic feedback
        }
      }

      // Handle Tool Calls
      if (functionCall) {
        const call = functionCall;
        const args = call.args as any;
        
        // Add a placeholder message
        const placeholderId = Date.now().toString();
        setMessages(prev => [...prev, {
          id: placeholderId,
          role: 'model',
          text: `Generating ${call.name.replace('generate_', '')}...`,
          isGenerating: true
        }]);

        let mediaResult;
        let mediaType: 'image' | 'video' | 'audio' = 'image';
        let albumArtResult: string | undefined;

        if (call.name === 'generate_image') {
          mediaResult = await generateImage(args.prompt, args.aspectRatio, args.quality);
          mediaType = 'image';
        } else if (call.name === 'generate_video') {
          mediaResult = await generateVideo(args.prompt, args.aspectRatio, args.resolution);
          mediaType = 'video';
        } else if (call.name === 'generate_music') {
          // Generate music and album art in parallel
          const [res, artRes] = await Promise.all([
            generateMusic(args.prompt, args.length, args.genre, args.mood),
            generateImage(`Album art cover for a song described as: ${args.prompt}`, '1:1', 'standard').catch(() => undefined)
          ]);
          mediaResult = `data:${res.mimeType};base64,${res.audioBase64}`;
          albumArtResult = artRes;
          mediaType = 'audio';
        }

        // Update placeholder with result
        setMessages(prev => prev.map(m => m.id === placeholderId ? {
          ...m,
          text: `Here is your generated ${call.name.replace('generate_', '')}:`,
          isGenerating: false,
          media: { type: mediaType, url: mediaResult, albumArt: albumArtResult }
        } : m));

        // Save to history
        if (user) {
          await addDoc(collection(db, 'users', user.uid, 'history'), {
            type: mediaType,
            prompt: args.prompt,
            url: mediaResult,
            albumArt: albumArtResult || null,
            createdAt: serverTimestamp()
          });
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: 'Sorry, I encountered an error processing your request.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: 'image' | 'video' | 'audio' | 'document' = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedFile({
        file,
        base64: reader.result as string,
        type
      });
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Audio Recording for STT
  const startRecording = async () => {
    try {
      vibrate(HAPTICS.voiceStart);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          // Use Gemini for STT
          setIsLoading(true);
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: [
                { inlineData: { data: base64Audio, mimeType: 'audio/webm' } },
                "Transcribe this audio exactly as spoken."
              ]
            });
            if (response.text) {
              setInput(response.text);
            }
          } catch (error) {
            console.error("STT Error:", error);
          } finally {
            setIsLoading(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      vibrate(HAPTICS.voiceStop);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playTTS = async (text: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audio.play();
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg relative">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-app-text-muted">
            <div className="w-16 h-16 bg-gradient-to-tr from-app-lime to-app-purple rounded-full flex items-center justify-center mb-4 shadow-lg">
              <MessageSquare className="w-8 h-8 text-black" />
            </div>
            <p className="text-lg font-medium text-white/80">Start a conversation</p>
            <p className="text-sm mt-1">or ask me to create something.</p>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-3xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-app-purple text-black rounded-tr-sm' 
                : 'bg-app-surface border border-white/5 rounded-tl-sm'
            }`}>
              {msg.media?.type === 'image' && (
                <img src={msg.media.url} alt="Uploaded or generated" className="rounded-xl mb-3 max-w-full h-auto shadow-md" />
              )}
              {msg.media?.type === 'video' && msg.media.url && (
                <video src={msg.media.url} controls className="rounded-xl mb-3 max-w-full w-full bg-black/50 shadow-lg" />
              )}
              {msg.media?.type === 'audio' && msg.media.url && (
                <div className="mb-3">
                  <AudioPlayer 
                    src={msg.media.url} 
                    title={msg.text.includes('generated') ? 'Generated Track' : 'Audio Message'} 
                    albumArt={msg.media.albumArt} 
                  />
                </div>
              )}
              
              {msg.media?.type === 'document' && (
                <div className="bg-black/20 rounded-xl p-4 mb-3 flex items-center gap-3">
                  <div className="w-12 h-12 bg-app-lime/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-app-lime" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{msg.media.name || 'Document'}</p>
                    <p className="text-xs text-white/50">Attached File</p>
                  </div>
                </div>
              )}
              
              <div className="prose prose-invert max-w-none text-sm md:text-base">
                {msg.isGenerating ? (
                  <div className="flex items-center gap-2 text-app-lime font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {msg.text}
                  </div>
                ) : (
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                )}
              </div>

              {msg.role === 'model' && !msg.isGenerating && !msg.media && (
                <button 
                  onClick={() => playTTS(msg.text)}
                  className="mt-3 text-app-text-muted hover:text-white flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full w-fit transition-colors"
                >
                  <Play className="w-3 h-3" /> Read aloud
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && !messages.find(m => m.isGenerating) && (
          <div className="flex justify-start">
            <div className="bg-app-surface border border-white/5 rounded-3xl rounded-tl-sm p-4 flex items-center gap-2 shadow-sm">
              <div className="w-2 h-2 bg-app-lime rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-app-purple rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-app-pink rounded-full animate-bounce delay-200" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 md:p-4 bg-app-bg/80 backdrop-blur-2xl border-t border-white/5 pb-safe z-20">
        <div className="max-w-4xl mx-auto relative">
          
          {/* Attached File Preview */}
          {attachedFile && (
            <div className="mb-3">
              <div className="flex items-center gap-3 bg-app-surface p-2 rounded-2xl border border-white/10 w-fit mb-3 shadow-lg">
                {attachedFile.type === 'image' && (
                  <img src={attachedFile.base64} alt="preview" className="w-10 h-10 object-cover rounded-xl" />
                )}
                {attachedFile.type === 'video' && (
                  <div className="w-10 h-10 bg-app-purple/20 rounded-xl flex items-center justify-center">
                    <Video className="w-5 h-5 text-app-purple" />
                  </div>
                )}
                {attachedFile.type === 'audio' && (
                  <div className="w-10 h-10 bg-app-pink/20 rounded-xl flex items-center justify-center">
                    <Music className="w-5 h-5 text-app-pink" />
                  </div>
                )}
                {attachedFile.type === 'document' && (
                  <div className="w-10 h-10 bg-app-lime/20 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-app-lime" />
                  </div>
                )}
                <div className="flex flex-col pr-2">
                  <span className="text-sm font-medium truncate max-w-[120px]">{attachedFile.file.name}</span>
                  <span className="text-[10px] text-white/50">{(attachedFile.file.size / 1024).toFixed(1)} KB</span>
                </div>
                <button 
                  onClick={() => setAttachedFile(null)}
                  className="p-1.5 hover:bg-white/10 rounded-full mr-1 text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Predefined Prompts for File */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {PREDEFINED_PROMPTS.map((promptText) => (
                  <button
                    key={promptText}
                    onClick={() => setInput(promptText)}
                    className="whitespace-nowrap px-4 py-2 bg-app-surface hover:bg-white/10 border border-white/5 rounded-full text-xs font-medium transition-colors shadow-sm"
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-1 bg-app-surface rounded-2xl p-1 border border-white/10 focus-within:border-white/20 focus-within:bg-app-surface/90 transition-all shadow-lg">
            
            <input 
              type="file" 
              accept="*/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              className="p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                vibrate(HAPTICS.typing);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Message Chinna..."
              className="flex-1 bg-transparent border-none outline-none resize-none max-h-24 py-2.5 px-1 text-sm placeholder:text-white/30"
              rows={1}
            />

            {input.trim() || attachedFile ? (
              <button 
                onClick={() => handleSend(input)}
                disabled={isLoading}
                aria-label="Send message"
                className="p-2 m-0.5 bg-app-lime text-black rounded-full hover:bg-app-lime/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                aria-label="Record voice"
                className={`p-2 m-0.5 rounded-full transition-colors shadow-sm ${
                  isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
