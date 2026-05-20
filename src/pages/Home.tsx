import { useAuth } from '../contexts/AuthContext';
import { Mic, MessageSquare, Image as ImageIcon, MoreVertical, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const historyItems = [
    { id: 1, title: 'I need some UI inspiration for dark...', icon: Mic, color: 'bg-app-lime', textColor: 'text-black' },
    { id: 2, title: 'Show me some color palettes for AI...', icon: MessageSquare, color: 'bg-app-purple', textColor: 'text-black' },
    { id: 3, title: 'What are the best mobile apps 2023...', icon: ImageIcon, color: 'bg-app-pink', textColor: 'text-black' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 hide-scrollbar">
      {/* Hero */}
      <h1 className="text-3xl md:text-5xl font-semibold leading-tight mb-6 mt-2 md:mt-0">
        How may I help<br />you today?
      </h1>

      {/* Bento Grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => navigate('/voice')}
          aria-label="Talk with Bot"
          className="col-span-1 row-span-2 bg-app-lime rounded-2xl p-4 flex flex-col justify-between text-black hover:scale-[1.02] transition-transform text-left relative overflow-hidden"
        >
          <div className="flex justify-between items-start w-full">
            <div className="w-8 h-8 rounded-full border border-black/20 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 opacity-50" />
          </div>
          <h2 className="text-xl font-semibold mt-8">Talk<br />with Bot</h2>
        </button>

        <button
          onClick={() => navigate('/chat')}
          aria-label="Chat with Bot"
          className="bg-app-purple rounded-2xl p-4 flex flex-col justify-between text-black hover:scale-[1.02] transition-transform text-left relative overflow-hidden"
        >
          <div className="flex justify-between items-start w-full mb-2">
            <div className="w-7 h-7 rounded-full border border-black/20 flex items-center justify-center">
              <MessageSquare className="w-3 h-3" />
            </div>
            <ArrowUpRight className="w-3 h-3 opacity-50" />
          </div>
          <h2 className="text-sm font-semibold">Chat</h2>
        </button>

        <button
          onClick={() => navigate('/chat')}
          aria-label="Search by Image"
          className="bg-app-pink rounded-2xl p-4 flex flex-col justify-between text-black hover:scale-[1.02] transition-transform text-left relative overflow-hidden"
        >
          <div className="flex justify-between items-start w-full mb-2">
            <div className="w-7 h-7 rounded-full border border-black/20 flex items-center justify-center">
              <ImageIcon className="w-3 h-3" />
            </div>
            <ArrowUpRight className="w-3 h-3 opacity-50" />
          </div>
          <h2 className="text-sm font-semibold">Search by Image</h2>
        </button>
      </div>

      {/* History Section */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-medium">History</h3>
        <button onClick={() => navigate('/history')} aria-label="See all history" className="text-xs text-app-text-muted hover:text-white transition-colors">See all</button>
      </div>

      <div className="space-y-2">
        {historyItems.map((item) => (
          <div key={item.id} className="bg-app-surface/50 backdrop-blur-md border border-white/5 rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition-colors cursor-pointer">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.color} ${item.textColor}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <p className="flex-1 text-xs text-white/90 truncate">{item.title}</p>
            <button aria-label="More options" className="text-white/30 hover:text-white">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
