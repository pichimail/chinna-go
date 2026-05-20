import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, Calendar, Clock, Globe, Activity } from 'lucide-react';

export function Onboarding() {
  const { user, userProfile } = useAuth();
  const [name, setName] = useState(userProfile?.displayName || '');
  const [dob, setDob] = useState('');
  const [dobTime, setDobTime] = useState('');
  const [sex, setSex] = useState('');
  const [language, setLanguage] = useState('Tinglish');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: name,
        dob,
        dobTime,
        sex,
        language,
        onboardingCompleted: true
      });
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none bg-topo" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-app-surface/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to Chinna</h1>
          <p className="text-app-text-muted">Let's personalize your experience.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <User className="w-4 h-4" /> Name
            </label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
              placeholder="Your name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <Calendar className="w-4 h-4" /> Date of Birth
              </label>
              <input 
                type="date" 
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <Clock className="w-4 h-4" /> Time (Optional)
              </label>
              <input 
                type="time" 
                value={dobTime}
                onChange={(e) => setDobTime(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
              />
            </div>
          </div>
          <p className="text-[10px] text-app-text-muted -mt-3">Time is useful for astrology and horoscope updates.</p>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <Activity className="w-4 h-4" /> Sex
            </label>
            <select 
              required
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
            >
              <option value="" disabled>Select your sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <Globe className="w-4 h-4" /> Language
            </label>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
            >
              <option value="Tinglish">Tinglish (Telugu 70% + English 30%)</option>
              <option value="Telugu">Telugu</option>
              <option value="Hindi">Hindi</option>
              <option value="English">English</option>
              <option value="Tamil">Tamil</option>
              <option value="Kannada">Kannada</option>
            </select>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-app-lime text-black font-semibold py-3.5 rounded-xl hover:bg-app-lime/90 transition-colors mt-4 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Get Started'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
