import { motion } from 'motion/react';
import { Mic, MessageSquare, Image as ImageIcon, Music, Video, Shield, Sparkles, ArrowRight, Zap, Globe, FileText, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Landing() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A] overflow-x-hidden font-sans selection:bg-[#FFD1DC] selection:text-black">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFD1DC] rounded-full flex items-center justify-center shadow-sm">
              <Mic className="w-5 h-5 text-[#1A1A1A]" />
            </div>
            <span className="font-bold text-xl tracking-tight text-[#1A1A1A]">Chinna</span>
          </div>
          <button
            onClick={signIn}
            className="bg-[#1A1A1A] text-white px-6 py-2.5 rounded-full font-medium hover:bg-black/80 transition-colors shadow-md hover:shadow-lg"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Section 1: Hero */}
      <section className="pt-40 pb-20 px-6 relative min-h-[90vh] flex items-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#FFD1DC]/40 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-[#AEC6CF]/40 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-black/5 mb-8 shadow-sm backdrop-blur-sm"
          >
            <Sparkles className="w-4 h-4 text-[#FFB7B2]" />
            <span className="text-sm font-medium text-[#1A1A1A]/80">Meet your new AI companion</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.1]"
          >
            The most advanced <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFB7B2] via-[#AEC6CF] to-[#C3B1E1]">personal assistant</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-2xl text-[#1A1A1A]/60 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Experience the future of AI with Chinna. From intelligent conversations to generating stunning images, videos, and music.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={signIn}
              className="w-full sm:w-auto px-8 py-4 bg-[#1A1A1A] text-white rounded-full font-semibold text-lg hover:bg-black/80 transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Section 2: Chat & Intelligence */}
      <section className="py-24 px-6 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 md:order-1 relative"
            >
              <div className="absolute inset-0 bg-[#FDFD96]/30 blur-3xl rounded-full" />
              <div className="relative bg-[#FDFBF7] border border-black/5 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#FFD1DC] rounded-full flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#1A1A1A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Smart Conversations</h3>
                    <p className="text-sm text-[#1A1A1A]/60">Context-aware responses</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-black/5 max-w-[80%]">
                    <p className="text-sm">Can you help me plan a trip to Japan?</p>
                  </div>
                  <div className="bg-[#AEC6CF]/20 p-4 rounded-2xl rounded-tr-none shadow-sm ml-auto max-w-[80%]">
                    <p className="text-sm">I'd love to! Let's start with your travel dates and preferred cities. Are you interested in Tokyo, Kyoto, or somewhere else?</p>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 md:order-2"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FDFD96] mb-6 shadow-sm">
                <Zap className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Intelligent & Natural</h2>
              <p className="text-lg text-[#1A1A1A]/60 mb-8 leading-relaxed">
                Chinna understands context, nuance, and emotion. Whether you're brainstorming ideas, writing code, or just having a casual chat, the interaction feels completely natural.
              </p>
              <ul className="space-y-4">
                {['Real-time voice conversations', 'Multilingual support including Tinglish', 'Deep contextual understanding'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#1A1A1A]/80 font-medium">
                    <div className="w-6 h-6 rounded-full bg-[#C3B1E1] flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 3: Media Generation */}
      <section className="py-24 px-6 bg-[#FDFBF7]">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Create Without Limits</h2>
          <p className="text-lg text-[#1A1A1A]/60 max-w-2xl mx-auto">
            Transform your ideas into stunning visual and audio masterpieces in seconds.
          </p>
        </div>
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { icon: ImageIcon, title: 'Image Generation', desc: 'Create photorealistic images, art, and designs from simple text descriptions.', color: 'bg-[#FFB7B2]' },
            { icon: Video, title: 'Video Creation', desc: 'Bring your stories to life with high-quality AI video generation.', color: 'bg-[#AEC6CF]' },
            { icon: Music, title: 'Music Production', desc: 'Compose original tracks, specify genres, and add your own artist name.', color: 'bg-[#C3B1E1]' }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-3xl shadow-xl border border-black/5 hover:-translate-y-2 transition-transform duration-300"
            >
              <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-6 shadow-sm`}>
                <feature.icon className="w-7 h-7 text-[#1A1A1A]" />
              </div>
              <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
              <p className="text-[#1A1A1A]/60 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section 4: Multimodal Capabilities */}
      <section className="py-24 px-6 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#77DD77] mb-6 shadow-sm">
                <Globe className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Analyze Everything</h2>
              <p className="text-lg text-[#1A1A1A]/60 mb-8 leading-relaxed">
                Upload documents, images, and audio files. Chinna can read PDFs, summarize long articles, transcribe voice notes, and understand visual context instantly.
              </p>
              <div className="flex flex-wrap gap-4">
                {['PDF Analysis', 'Image Vision', 'Audio Transcription', 'Code Review'].map((tag, i) => (
                  <span key={i} className="px-4 py-2 bg-[#FDFBF7] border border-black/5 rounded-full text-sm font-medium text-[#1A1A1A]/80 shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute inset-0 bg-[#77DD77]/20 blur-3xl rounded-full" />
              <div className="relative grid grid-cols-2 gap-4">
                <div className="space-y-4 mt-8">
                  <div className="bg-[#FDFBF7] p-6 rounded-3xl shadow-lg border border-black/5 flex flex-col items-center text-center gap-3">
                    <FileText className="w-8 h-8 text-[#FFB7B2]" />
                    <span className="font-medium">Document Analysis</span>
                  </div>
                  <div className="bg-[#FDFBF7] p-6 rounded-3xl shadow-lg border border-black/5 flex flex-col items-center text-center gap-3">
                    <Mic className="w-8 h-8 text-[#AEC6CF]" />
                    <span className="font-medium">Voice Memos</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-[#FDFBF7] p-6 rounded-3xl shadow-lg border border-black/5 flex flex-col items-center text-center gap-3">
                    <ImageIcon className="w-8 h-8 text-[#C3B1E1]" />
                    <span className="font-medium">Image Vision</span>
                  </div>
                  <div className="bg-[#FDFBF7] p-6 rounded-3xl shadow-lg border border-black/5 flex flex-col items-center text-center gap-3">
                    <Sparkles className="w-8 h-8 text-[#FDFD96]" />
                    <span className="font-medium">Smart Insights</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 5: Security & CTA */}
      <section className="py-32 px-6 bg-[#1A1A1A] text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-[#C3B1E1]/20 to-transparent blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-8 backdrop-blur-md">
            <Lock className="w-8 h-8 text-[#FFD1DC]" />
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Private & Secure</h2>
          <p className="text-xl text-white/60 mb-12 leading-relaxed">
            Your data is encrypted and securely stored. We prioritize your privacy so you can focus on creating and exploring without worry.
          </p>
          <button 
            onClick={signIn}
            className="px-10 py-5 bg-white text-[#1A1A1A] rounded-full font-bold text-lg hover:bg-gray-100 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:-translate-y-1"
          >
            Start Using Chinna Free
          </button>
        </div>
      </section>
    </div>
  );
}
