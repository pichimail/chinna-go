import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Clock, Image as ImageIcon, Video, Music, MoreVertical, Play, Download, Search, X, FileText, Trash2, Share2, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioPlayer } from '../components/AudioPlayer';

interface HistoryItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  prompt: string;
  url: string;
  albumArt?: string;
  artist?: string;
  createdAt: any;
}

export function History() {
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'document'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'history'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetchedItems = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as HistoryItem[];
        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !window.confirm('Are you sure you want to delete this item?')) return;
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'history', id));
      setItems(prev => prev.filter(item => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item.");
    }
  };

  const handleShare = async (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Chinna AI - ${item.type}`,
          text: `Check out this ${item.type} I generated with Chinna AI: "${item.prompt}"`,
          url: item.url,
        });
      } else {
        await navigator.clipboard.writeText(item.url);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const startEditing = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditValue(item.prompt);
  };

  const saveEdit = async (id: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (!user || !editValue.trim()) {
      setEditingId(null);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid, 'history', id), {
        prompt: editValue.trim()
      });
      setItems(prev => prev.map(item => item.id === id ? { ...item, prompt: editValue.trim() } : item));
      if (selectedItem?.id === id) {
        setSelectedItem(prev => prev ? { ...prev, prompt: editValue.trim() } : null);
      }
    } catch (error) {
      console.error("Error updating item name:", error);
      alert("Failed to update name.");
    } finally {
      setEditingId(null);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === 'all' || item.type === filter;
    const matchesSearch = item.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-app-bg relative">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">History</h1>
        <p className="text-app-text-muted">Your generated creations and conversations.</p>
      </header>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-app-text-muted" />
          <input
            type="text"
            placeholder="Search by prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-app-surface border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-white/30 focus:border-app-lime focus:ring-1 focus:ring-app-lime transition-all outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar shrink-0">
          {['all', 'image', 'video', 'audio', 'document'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type as any)}
              className={`px-4 py-3 rounded-2xl text-sm font-medium transition-colors whitespace-nowrap ${
                filter === type 
                  ? 'bg-white text-black' 
                  : 'bg-app-surface border border-white/10 text-app-text-muted hover:text-white'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-app-lime border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 text-app-text-muted">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No history found for this category or search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={item.id}
              className="bg-app-surface rounded-3xl overflow-hidden border border-white/5 hover:border-white/20 transition-colors group cursor-pointer"
              onClick={() => setSelectedItem(item)}
            >
              <div className="aspect-video bg-black/50 relative">
                {item.type === 'image' && (
                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                )}
                {item.type === 'video' && item.url && (
                  <video src={item.url} className="w-full h-full object-cover" />
                )}
                {item.type === 'audio' && item.url && (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-app-purple/20 to-app-pink/20 relative">
                    {item.albumArt ? (
                      <img src={item.albumArt} alt="Album Art" className="w-full h-full object-cover opacity-50" />
                    ) : (
                      <Music className="w-12 h-12 text-app-purple opacity-50" />
                    )}
                  </div>
                )}
                {item.type === 'document' && (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-app-lime/20 to-app-purple/20">
                    <FileText className="w-12 h-12 text-app-lime opacity-50" />
                  </div>
                )}
                
                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  {item.type === 'video' || item.type === 'audio' ? (
                    <button className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors">
                      <Play className="w-5 h-5 text-white" />
                    </button>
                  ) : null}
                  <a href={item.url} download onClick={(e) => e.stopPropagation()} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors">
                    <Download className="w-5 h-5 text-white" />
                  </a>
                  {item.type === 'image' && (
                    <button 
                      onClick={(e) => handleShare(item, e)} 
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <Share2 className="w-5 h-5 text-white" />
                    </button>
                  )}
                </div>

                {/* Badge */}
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-medium uppercase tracking-wider flex items-center gap-1">
                  {item.type === 'image' && <ImageIcon className="w-3 h-3 text-app-pink" />}
                  {item.type === 'video' && <Video className="w-3 h-3 text-app-lime" />}
                  {item.type === 'audio' && <Music className="w-3 h-3 text-app-purple" />}
                  {item.type === 'document' && <FileText className="w-3 h-3 text-app-lime" />}
                  {item.type}
                </div>
              </div>
              <div className="p-4">
                {editingId === item.id ? (
                  <form 
                    onSubmit={(e) => saveEdit(item.id, e)} 
                    className="flex items-center gap-2 mb-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/20 rounded-lg px-2 py-1 text-sm text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none"
                    />
                    <button type="submit" className="p-1 text-app-lime hover:bg-white/10 rounded-md transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="p-1 text-red-500 hover:bg-white/10 rounded-md transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm text-white/90 line-clamp-2 flex-1">{item.prompt}</p>
                    <button 
                      onClick={(e) => startEditing(item, e)}
                      className="text-app-text-muted hover:text-white transition-colors shrink-0 p-1"
                      title="Rename"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-app-text-muted">
                    {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="text-app-text-muted hover:text-white transition-colors" onClick={(e) => handleShare(item, e)} title="Share">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button className="text-app-text-muted hover:text-red-500 transition-colors" onClick={(e) => handleDelete(item.id, e)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-app-surface border border-white/10 rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-white/5">
                <h3 className="font-medium truncate pr-4">{selectedItem.prompt}</h3>
                <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/30">
                {selectedItem.type === 'image' && (
                  <img src={selectedItem.url} alt={selectedItem.prompt} className="max-w-full max-h-[60vh] object-contain rounded-xl" />
                )}
                {selectedItem.type === 'video' && (
                  <video src={selectedItem.url} controls autoPlay className="max-w-full max-h-[60vh] rounded-xl bg-black/50 shadow-2xl" />
                )}
                {selectedItem.type === 'audio' && (
                  <div className="w-full max-w-md">
                    <AudioPlayer 
                      src={selectedItem.url} 
                      title={selectedItem.prompt} 
                      albumArt={selectedItem.albumArt} 
                      artist={selectedItem.artist}
                      autoPlay 
                    />
                  </div>
                )}
                {selectedItem.type === 'document' && (
                  <div className="w-full max-w-md bg-black/40 p-8 rounded-3xl border border-white/10 text-center">
                    <div className="w-32 h-32 bg-gradient-to-br from-app-lime to-app-purple rounded-full mx-auto mb-8 flex items-center justify-center">
                      <FileText className="w-12 h-12 text-white" />
                    </div>
                    <p className="text-white/70 mb-4">Document Preview</p>
                    <a href={selectedItem.url} target="_blank" rel="noreferrer" className="text-app-lime hover:underline">Open Document</a>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-white/5 flex justify-between items-center">
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => handleShare(selectedItem, e)}
                    className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <button 
                    onClick={(e) => handleDelete(selectedItem.id, e)}
                    className="flex items-center gap-2 px-4 py-3 bg-red-500/20 text-red-500 rounded-xl font-medium hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
                <a 
                  href={selectedItem.url} 
                  download 
                  className="flex items-center gap-2 px-6 py-3 bg-app-lime text-black rounded-xl font-medium hover:bg-app-lime/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
