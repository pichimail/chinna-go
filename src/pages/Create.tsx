import { useState, useRef } from 'react';
import { Image as ImageIcon, Video, Music, Loader2, Download, Upload, Wand2 } from 'lucide-react';
import { generateImage, editImage, generateVideo, generateMusic } from '../lib/gemini';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AudioPlayer } from '../components/AudioPlayer';

export function Create() {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'music'>('image');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ type: string; url: string; albumArt?: string; name?: string } | null>(null);

  // Options
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [quality, setQuality] = useState('standard');
  const [videoResolution, setVideoResolution] = useState('720p');
  const [videoQuality, setVideoQuality] = useState('standard');
  const [videoCodec, setVideoCodec] = useState('default');
  
  const [musicLength, setMusicLength] = useState('clip');
  const [musicGenre, setMusicGenre] = useState('');
  const [musicMood, setMusicMood] = useState('');
  const [musicLanguage, setMusicLanguage] = useState('');
  const [musicTempo, setMusicTempo] = useState('');
  
  // Image Editing
  const [imageMode, setImageMode] = useState<'generate' | 'edit'>('generate');
  const [sourceImage, setSourceImage] = useState<{ base64: string, mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const IMAGE_FILTERS = ['brightness', 'contrast', 'grayscale', 'sepia', 'studio light'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSourceImage({
        base64: reader.result as string,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const applyFilter = (filter: string) => {
    setPrompt((prev) => prev ? `${prev}, apply ${filter} filter` : `Apply ${filter} filter`);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !(activeTab === 'image' && imageMode === 'edit' && sourceImage)) return;
    setIsGenerating(true);
    setResult(null);

    const artistName = `Chinn-${userProfile?.displayName || user?.displayName || 'User'}`;
    const generatedName = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} - ${new Date().toLocaleString()}`;

    try {
      let url = '';
      let albumArt = undefined;
      if (activeTab === 'image') {
        if (imageMode === 'edit' && sourceImage) {
          url = await editImage(prompt || 'Enhance image', sourceImage.base64, sourceImage.mimeType);
        } else {
          url = await generateImage(prompt, aspectRatio, quality);
        }
      } else if (activeTab === 'video') {
        url = await generateVideo(prompt, aspectRatio, videoResolution, videoQuality, videoCodec);
      } else if (activeTab === 'music') {
        const [res, artRes] = await Promise.all([
          generateMusic(prompt, musicLength, musicGenre, musicMood, musicLanguage, musicTempo),
          generateImage(`Album art cover for a song described as: ${prompt}`, '1:1', 'standard').catch(() => undefined)
        ]);
        url = `data:${res.mimeType};base64,${res.audioBase64}`;
        albumArt = artRes;
      }

      setResult({ type: activeTab, url, albumArt, name: generatedName });

      if (user) {
        await addDoc(collection(db, 'users', user.uid, 'history'), {
          type: activeTab,
          prompt,
          url,
          albumArt: albumArt || null,
          name: generatedName,
          artist: artistName,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-app-bg">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Create</h1>
        <p className="text-sm text-app-text-muted">Generate high-quality media using Chinna.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-app-surface p-1 rounded-xl w-fit">
        {[
          { id: 'image', icon: ImageIcon, label: 'Image' },
          { id: 'video', icon: Video, label: 'Video' },
          { id: 'music', icon: Music, label: 'Music' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            aria-label={`Switch to ${tab.label} creation`}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-app-lime text-black shadow-lg' 
                : 'text-app-text-muted hover:text-white'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          {activeTab === 'image' && (
            <div className="flex gap-1 bg-black/30 p-0.5 rounded-lg w-fit mb-3">
              <button
                onClick={() => setImageMode('generate')}
                aria-label="Generate new image"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${imageMode === 'generate' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
              >
                Generate
              </button>
              <button
                onClick={() => setImageMode('edit')}
                aria-label="Edit existing image"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${imageMode === 'edit' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
              >
                Edit
              </button>
            </div>
          )}

          {activeTab === 'image' && imageMode === 'edit' && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">Source Image</label>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              {sourceImage ? (
                <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/10 group">
                  <img src={sourceImage.base64} alt="Source" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => fileInputRef.current?.click()} aria-label="Change source image" className="bg-white/20 px-3 py-1 rounded-lg text-xs backdrop-blur-md">Change</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} aria-label="Upload source image" className="w-full h-24 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-app-text-muted hover:border-white/30 transition-colors">
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-xs">Upload image</span>
                </button>
              )}
              
              {sourceImage && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-white/80 mb-1">Preset Filters</label>
                  <div className="flex flex-wrap gap-1.5">
                    {IMAGE_FILTERS.map(filter => (
                      <button 
                        key={filter}
                        onClick={() => applyFilter(filter)}
                        aria-label={`Apply ${filter} filter`}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] capitalize flex items-center gap-1 transition-colors"
                      >
                        <Wand2 className="w-2.5 h-2.5" /> {filter}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/80 mb-1">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={activeTab === 'image' && imageMode === 'edit' ? "Describe how to edit..." : `Describe the ${activeTab} to create...`}
              className="w-full bg-app-surface border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:border-app-lime focus:ring-1 focus:ring-app-lime transition-all resize-none h-24"
            />
          </div>

          {/* Dynamic Options based on tab */}
          {activeTab === 'image' && imageMode === 'generate' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Aspect Ratio</label>
                <select 
                  value={aspectRatio} 
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                >
                  <option value="1:1">1:1 Square</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
                  <option value="4:3">4:3 Standard</option>
                  <option value="3:4">3:4 Vertical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Quality</label>
                <select 
                  value={quality} 
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                >
                  <option value="standard">Standard (1K)</option>
                  <option value="high">High (2K/4K)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Aspect Ratio</label>
                <select 
                  value={aspectRatio} 
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                >
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Resolution</label>
                <select 
                  value={videoResolution} 
                  onChange={(e) => setVideoResolution(e.target.value)}
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Quality</label>
                <select 
                  value={videoQuality} 
                  onChange={(e) => setVideoQuality(e.target.value)}
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="HD">HD</option>
                  <option value="4K">4K</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Codec</label>
                <select 
                  value={videoCodec} 
                  onChange={(e) => setVideoCodec(e.target.value)}
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                >
                  <option value="default">Default</option>
                  <option value="h264">H.264</option>
                  <option value="h265">H.265 (HEVC)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'music' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-white/80 mb-1">Length</label>
                <select 
                  value={musicLength} 
                  onChange={(e) => setMusicLength(e.target.value)}
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                >
                  <option value="clip">Short Clip (up to 30s)</option>
                  <option value="full">Full Track</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Genre</label>
                <input 
                  type="text"
                  value={musicGenre}
                  onChange={(e) => setMusicGenre(e.target.value)}
                  placeholder="e.g., Pop, Rock"
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Mood</label>
                <input 
                  type="text"
                  value={musicMood}
                  onChange={(e) => setMusicMood(e.target.value)}
                  placeholder="e.g., Upbeat, Chill"
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Language</label>
                <input 
                  type="text"
                  value={musicLanguage}
                  onChange={(e) => setMusicLanguage(e.target.value)}
                  placeholder="e.g., English"
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Tempo</label>
                <select 
                  value={musicTempo} 
                  onChange={(e) => setMusicTempo(e.target.value)}
                  className="w-full bg-app-surface border border-white/10 rounded-lg p-2 text-sm text-white focus:border-app-lime outline-none"
                >
                  <option value="">Any</option>
                  <option value="slow">Slow</option>
                  <option value="medium">Medium</option>
                  <option value="fast">Fast</option>
                </select>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || (!prompt.trim() && !(activeTab === 'image' && imageMode === 'edit' && sourceImage))}
            aria-label="Generate media"
            className="w-full bg-app-lime text-black font-semibold py-3 rounded-xl hover:bg-app-lime/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>
        </div>

        {/* Preview Area */}
        <div className="bg-app-surface/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[300px]">
          {isGenerating ? (
            <div className="text-center text-app-text-muted">
              <div className="w-12 h-12 border-4 border-app-lime border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Creating your masterpiece...</p>
              <p className="text-[10px] mt-1 opacity-50">This may take a few minutes.</p>
            </div>
          ) : result ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative group">
              {result.type === 'image' && (
                <img src={result.url} alt="Generated" className="rounded-xl max-h-[300px] object-contain shadow-2xl" />
              )}
              {result.type === 'video' && (
                <video src={result.url} controls className="rounded-xl max-h-[300px] shadow-2xl w-full bg-black/50" />
              )}
              {result.type === 'music' && (
                <div className="w-full max-w-xs">
                  <AudioPlayer 
                    src={result.url} 
                    albumArt={result.albumArt} 
                    title={prompt || result.name}
                    artist={`Chinn-${userProfile?.displayName || user?.displayName || 'User'}`}
                  />
                </div>
              )}
              
              <a 
                href={result.url} 
                download 
                aria-label="Download generated media"
                className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <div className="text-center text-app-text-muted opacity-50">
              {activeTab === 'image' && <ImageIcon className="w-12 h-12 mx-auto mb-3" />}
              {activeTab === 'video' && <Video className="w-12 h-12 mx-auto mb-3" />}
              {activeTab === 'music' && <Music className="w-12 h-12 mx-auto mb-3" />}
              <p className="text-sm">Your generated {activeTab} will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
