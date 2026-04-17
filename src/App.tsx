import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Play, 
  Pause, 
  Volume2, 
  Code, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Info,
  ChevronRight,
  Maximize2,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Components
const FormattedMath = ({ text }: { text: string }) => {
  if (!text) return null;
  // This splits the text into parts that are between $ and parts that are not
  const parts = text.split(/(\$.*?\$)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TTS_MODEL = "gemini-3.1-flash-tts-preview";

// Types
interface Choice {
  id: string;
  text: string;
  isTrue: boolean;
  solution: string;
}

const choicesData: Choice[] = [
  { 
    id: 'a', 
    text: 'Đường thẳng $AB$ có một vectơ chỉ phương là $\\vec{u} = (2; -3; 3)$', 
    isTrue: true,
    solution: 'Vectơ $\\vec{AB} = (0-2; 3-0; -3-(-0)) = (-2; 3; -3)$. Suy ra vectơ chỉ phương $\\vec{u} = -\\vec{AB} = (2; -3; 3)$. (Đúng)'
  },
  { 
    id: 'b', 
    text: 'Mặt trung trực của đoạn thẳng $AB$ có phương trình là $2x - 3y + 3z + 11 = 0$', 
    isTrue: true,
    solution: 'Trung điểm đoạn thẳng $AB$ là $I(1; 1.5; -1.5)$. Vectơ pháp tuyến là $\\vec{AB} = (-2; 3; -3)$. Phương trình mặt trung trực: $-2(x-1) + 3(y-1.5) - 3(z+1.5) = 0 \\Leftrightarrow 2x - 3y + 3z + 11 = 0$. (Đúng)'
  },
  { 
    id: 'c', 
    text: 'Tiếp diện của mặt cầu $(S)$ tại điểm $M(-2; -3; 1)$ có phương trình là $3x - z + 7 = 0$', 
    isTrue: true,
    solution: 'Tâm mặt cầu $I(1; -3; 0)$. Vectơ pháp tuyến tại $M$ là $\\vec{IM} = (-2-1; -3-(-3); 1-0) = (-3; 0; 1)$. Phương trình tiếp diện: $-3(x+2) + 0(y+3) + 1(z-1) = 0 \\Leftrightarrow 3x - z + 7 = 0$. (Đúng)'
  },
  { 
    id: 'd', 
    text: 'Mặt cầu đi qua $A, B, O$ có tâm thuộc mặt phẳng $(P)$ có phương trình là $(x-1)^2 + y^2 + (z+3)^2 = 10$', 
    isTrue: true,
    solution: 'Tâm $J(1; 0; -3)$ thuộc $(P): x + y + z + 2 = 0$. Kiểm tra $JO=JA=JB=\\sqrt{10}$. Phương trình mặt cầu $(x-1)^2 + y^2 + (z+3)^2 = 10$. (Đúng)'
  },
];

const exerciseText = `Trong không gian $Oxyz$, cho hai điểm $A(2;0;0)$, $B(0;3;-3)$ và mặt cầu $(S): (x-1)^2 + (y+3)^2 + z^2 = 10$.`;

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, 'true' | 'false' | null>>({
    a: null, b: null, c: null, d: null
  });
  const [showResults, setShowResults] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Utility to create a valid WAV file from raw PCM data
  const createWavBlob = (pcmData: Uint8Array, sampleRate: number) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byteRate
    view.setUint16(32, 2, true); // blockAlign
    view.setUint16(34, 16, true); // bitsPerSample
    writeString(36, 'data');
    view.setUint32(40, pcmData.length, true);
    return new Blob([header, pcmData], { type: 'audio/wav' });
  };

  const tikzCode = `\\begin{tikzpicture}[scale=0.8, font=\\footnotesize, line join=round, line cap=round, >=Stealth]
    % 1. Thư viện (nên để ở preamble nếu dùng file .tex rời)
    % \\usetikzlibrary{arrows.meta, calc, intersections, angles, quotes}
    
    % 2. Khai báo tọa độ tĩnh
    \\path (0,0,0) coordinate (O)
          (2,0,0) coordinate (A)
          (0,3,-3) coordinate (B)
          (1,-3,0) coordinate (I)
          (-2,-3,1) coordinate (M)
          (1,0,-3) coordinate (J);
    
    % 3. Vẽ trục tọa độ
    \\draw[->] (-3,0,0) -- (4,0,0) node[right] {$x$};
    \\draw[->] (0,-4,0) -- (0,4,0) node[above] {$y$};
    \\draw[->] (0,0,-4) -- (0,0,4) node[left] {$z$};
    
    % 4. Vẽ mặt cầu (S) dùng node hoặc circle
    \\node[draw, circle, minimum size=5.05cm, dashed, opacity=0.3] at (I) {};
    % Elips biểu diễn chiều sâu
    \\draw[dashed, opacity=0.4] (I) ellipse (2.52cm and 0.8cm);
    \\draw[thick] (I) ++(2.52,0) arc (0:180:2.52 and 0.8cm);
    
    % 5. Mặt cầu qua O, A, B (Sphere J)
    \\node[draw, blue!40, circle, minimum size=5.1cm, dashed, opacity=0.2] at (J) {};
    
    % 6. Vẽ các điểm bằng vòng lặp
    \\foreach \\p in {O,A,B,I,M,J} \\fill (\\p) circle (1.5pt);
    
    % 7. Gán nhãn bằng vòng lặp
    \\foreach \\p/\\pos in {O/below left, A/above right, B/right, I/below left, M/left, J/below right} 
        \\node[\\pos] at (\\p) {$\\p$};
    
    % 8. Vẽ các cạnh/đường nối
    \\foreach \p in {A,B,I,M,J} \\draw[thin, opacity=0.2] (O)--(\\p);
    \\draw[thick, blue] (A) -- (B);
    \\draw[dashed, red, thick] (I) -- (M);
    
    % 9. Ký hiệu góc vuông (tại M nếu tiếp tuyến) - chỉ minh họa
    % \\pic [draw, angle radius=0.2cm] {right angle = I--M--?};
\\end{tikzpicture}`;

  const handleTTS = async () => {
    if (isPlaying) {
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop();
        setIsPlaying(false);
      }
      return;
    }

    if (isSynthesizing) return;

    try {
      setIsSynthesizing(true);
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const prompt = `Đọc diễn cảm bài tập toán sau đây: ${exerciseText}. Các lựa chọn là: ${choicesData.map(c => c.text).join('. ')}`;

      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const wavBlob = createWavBlob(bytes, 24000);
        setLastAudioBlob(wavBlob);

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const audioContext = audioContextRef.current;
        const floatData = new Float32Array(bytes.length / 2);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < floatData.length; i++) {
          const sample = view.getInt16(i * 2, true);
          floatData[i] = sample / 32768;
        }

        const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000);
        audioBuffer.getChannelData(0).set(floatData);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsPlaying(false);
        source.start();
        
        audioBufferSourceRef.current = source;
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleAnswer = (id: string, answer: 'true' | 'false') => {
    setUserAnswers(prev => ({ ...prev, [id]: answer }));
  };

  const downloadAudio = () => {
    if (!lastAudioBlob) return;
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bai-tap-oxyz.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tikzCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg text-ink font-sans selection:bg-blue-100 flex flex-col">
      {/* Editorial Header */}
      <header className="px-10 py-10 flex flex-col md:flex-row justify-between items-baseline border-b border-border gap-6">
        <div>
          <div className="text-[12px] font-mono tracking-[0.2em] uppercase text-muted mb-2">
            Dự án 2025 &mdash; [12H3-1]
          </div>
          <div className="font-serif italic text-lg text-ink">
            Hình học không gian Oxyz
          </div>
        </div>
        
        <div className="flex gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleTTS}
            disabled={isSynthesizing}
            className={`flex items-center gap-2 px-4 py-2 border border-border rounded-sm text-[10px] font-mono uppercase tracking-widest hover:bg-ink hover:text-white transition-colors h-fit ${isSynthesizing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSynthesizing ? 'Synthesizing...' : isPlaying ? <><Pause size={14}/> Stop</> : <><Volume2 size={14}/> Listen</>}
          </motion.button>

          <AnimatePresence>
            {lastAudioBlob && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={downloadAudio}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-sm text-[10px] font-mono uppercase tracking-widest hover:bg-accent/90 transition-colors h-fit"
              >
                Download Voice
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px]">
        {/* Left Section: Problem & Choices & TikZ */}
        <div className="p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-border space-y-12 shrink-0">
          {/* Problem Statement */}
          <section>
            <h1 className="font-serif text-3xl leading-[1.5] text-ink max-w-3xl">
              <span className="editorial-math-bg">
                <FormattedMath text={exerciseText} />
              </span>
            </h1>
          </section>

          {/* New Interactive Choices Grid */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted flex items-center gap-2">
                <span className="h-[1px] w-6 bg-border"></span>
                Trắc nghiệm Đúng/Sai
              </div>
              <button 
                onClick={() => setShowResults(!showResults)}
                className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent hover:underline"
              >
                {showResults ? 'Ẩn đáp án' : 'Hiện đáp án'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {choicesData.map((choice, idx) => (
                <div key={choice.id} className="flex flex-col md:flex-row md:items-center gap-4 p-6 bg-white border border-border rounded-xs group">
                  <div className="flex-1 text-[15px] leading-relaxed text-ink/90 italic font-serif">
                    <span className="font-bold mr-2 uppercase">{choice.id})</span>
                    <FormattedMath text={choice.text} />
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAnswer(choice.id, 'true')}
                      className={`px-3 py-1 text-[9px] uppercase font-bold tracking-widest border rounded-sm transition-all ${userAnswers[choice.id] === 'true' ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'}`}
                    >
                      Đúng
                    </button>
                    <button 
                      onClick={() => handleAnswer(choice.id, 'false')}
                      className={`px-3 py-1 text-[9px] uppercase font-bold tracking-widest border rounded-sm transition-all ${userAnswers[choice.id] === 'false' ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'}`}
                    >
                      Sai
                    </button>
                    
                    <AnimatePresence>
                      {showResults && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`ml-2 px-3 py-1 text-[9px] uppercase font-bold rounded-sm ${choice.isTrue ? 'bg-green-100 text-true' : 'bg-red-100 text-false'}`}
                        >
                          {choice.isTrue ? 'Kết quả: Đ' : 'Kết quả: S'}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* TikZ Visual */}
          <section className="pt-12 border-t border-border">
             <div className="flex items-end justify-between mb-8">
               <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted flex items-center gap-2">
                 <span className="h-[1px] w-6 bg-border"></span>
                 Visualizer Preview (Points: A, B, O, I, M, J)
               </div>
               <button 
                onClick={copyToClipboard}
                className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-ink flex items-center gap-2 underline underline-offset-4"
              >
                {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                {copied ? 'Copied Code' : 'Copy TikZ Code'}
              </button>
             </div>
             
             <div className="flex flex-col md:flex-row gap-8 items-stretch">
                <div className="flex-1 aspect-video bg-paper-alt border border-border rounded-xs flex items-center justify-center relative group">
                  <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/notebook.png')]"></div>
                  {/* SVG Mockup */}
                  <svg viewBox="0 0 200 200" className="w-full h-full p-4 text-accent/60 drop-shadow-sm">
                    {/* Sphere S (tâm I) */}
                    <circle cx="100" cy="110" r="60" fill="none" stroke="currentColor" strokeDasharray="4 2" />
                    <ellipse cx="100" cy="110" rx="60" ry="20" fill="none" stroke="currentColor" strokeDasharray="4 2" />
                    
                    {/* Sphere tâm J */}
                    <circle cx="100" cy="80" r="60" fill="none" stroke="#2D5D7B" strokeOpacity="0.3" strokeDasharray="2 1" />
                    
                    {/* Lines */}
                    <line x1="120" y1="40" x2="80" y2="150" stroke="currentColor" strokeWidth="2" />
                    <line x1="100" y1="110" x2="60" y2="120" stroke="#C62828" strokeDasharray="3 3" />
                    
                    {/* Points */}
                    <circle cx="100" cy="110" r="3" fill="currentColor" /> <text x="105" y="115" fontSize="8" fill="currentColor">I</text>
                    <circle cx="60" cy="120" r="3" fill="#C62828" /> <text x="50" y="115" fontSize="8" fill="#C62828">M</text>
                    <circle cx="100" cy="80" r="3" fill="#2D5D7B" /> <text x="105" y="75" fontSize="8" fill="#2D5D7B">J</text>
                    <circle cx="120" cy="40" r="3" fill="black" /> <text x="125" y="38" fontSize="8" fill="black">A</text>
                    <circle cx="80" cy="150" r="3" fill="black" /> <text x="70" y="155" fontSize="8" fill="black">B</text>
                    <circle cx="100" cy="100" r="3" fill="black" /> <text x="105" y="95" fontSize="8" fill="black">O</text>
                  </svg>
                </div>
                <div className="w-full md:w-56 bg-ink p-4 rounded-xs text-[9px] font-mono text-white/50 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-2 text-white/20"><Code size={12} /></div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    <pre className="whitespace-pre-wrap">{tikzCode}</pre>
                  </div>
                </div>
             </div>
          </section>
        </div>

        {/* Right Section: Detailed Solution */}
        <aside className="bg-paper-alt p-10 lg:p-14 lg:sticky lg:top-0 h-fit border-l border-border">
          <div className="flex items-center gap-4 mb-10 group">
             <h2 className="font-serif italic text-2xl text-accent">Lời giải đầy đủ</h2>
             <div className="h-px flex-1 bg-border group-hover:bg-accent/40 transition-colors"></div>
          </div>
          
          <div className="space-y-10">
            {choicesData.map((choice) => (
              <div key={choice.id} className="group border-b border-border/50 pb-6 last:border-0">
                <span className="block font-bold text-[10px] text-ink uppercase tracking-[0.2em] mb-4 opacity-60 flex items-center justify-between">
                  Ý {choice.id.toUpperCase()}) 
                  <span className={`${choice.isTrue ? 'text-true bg-green-50' : 'text-false bg-red-50'} px-2 rounded-sm tracking-normal font-sans text-[8px]`}>
                    {choice.isTrue ? 'Đúng' : 'Sai'}
                  </span>
                </span>
                <div className="text-[13px] leading-relaxed text-muted group-hover:text-ink transition-colors">
                  <FormattedMath text={choice.solution} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>

      {/* Editorial Footer */}
      <footer className="px-10 py-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-muted">
        <div>Trang 1 / 1 &bull; Phối hợp: AI Studio Visualizer</div>
        <div className="flex gap-4">
          <span className="px-3 py-1 border border-border rounded-full cursor-help">Phân loại: Hình học 12</span>
          <span className="px-3 py-1 border border-border rounded-full">ID: Oxyz-Quiz-01</span>
        </div>
      </footer>
    </div>
  );
}
