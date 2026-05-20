import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Bell, Shield, HelpCircle, Bot, Save, Calendar, Clock, Globe, Activity } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export function Settings() {
  const { user, userProfile, logOut } = useAuth();
  const [assistantRole, setAssistantRole] = useState('Personal Assistant');
  const [assistantInstructions, setAssistantInstructions] = useState('Your name is Chinna. You are an intelligent, smart and advanced personal assistant application made by Project-M. You must never mention Gemini, Google, Lyria, or any other AI models. You can chat, generate images, videos, and music. If the user asks for media generation, use the provided tools. You can also analyze files, transcribe audio, and summarize documents.');

  // Profile State
  const [name, setName] = useState(userProfile?.displayName || '');
  const [dob, setDob] = useState(userProfile?.dob || '');
  const [dobTime, setDobTime] = useState(userProfile?.dobTime || '');
  const [sex, setSex] = useState(userProfile?.sex || '');
  const [language, setLanguage] = useState(userProfile?.language || 'Tinglish');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('chinna_role');
    const savedInstructions = localStorage.getItem('chinna_instructions');
    if (savedRole) setAssistantRole(savedRole);
    if (savedInstructions) setAssistantInstructions(savedInstructions);
  }, []);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.displayName || '');
      setDob(userProfile.dob || '');
      setDobTime(userProfile.dobTime || '');
      setSex(userProfile.sex || '');
      setLanguage(userProfile.language || 'Tinglish');
    }
  }, [userProfile]);

  const handleSaveAssistant = () => {
    localStorage.setItem('chinna_role', assistantRole);
    localStorage.setItem('chinna_instructions', assistantInstructions);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: name,
        dob,
        dobTime,
        sex,
        language
      });
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const SETTING_GROUPS = [
    {
      title: 'Preferences',
      items: [
        { icon: Bell, label: 'Notifications', value: 'Enabled' },
        { icon: Shield, label: 'Privacy & Security', value: '' },
        { icon: HelpCircle, label: 'Help & Support', value: '' },
      ]
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-app-bg">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-sm text-app-text-muted">Manage your account and preferences.</p>
      </header>

      {/* Profile Card */}
      <div className="bg-app-surface border border-white/5 rounded-2xl p-4 flex items-center gap-4 mb-6">
        <img src={user?.photoURL || ''} alt="Profile" className="w-16 h-16 rounded-full border-2 border-app-lime" />
        <div>
          <h2 className="text-lg font-semibold">{userProfile?.displayName || user?.displayName}</h2>
          <p className="text-xs text-app-text-muted">{user?.email}</p>
          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-app-lime/10 text-app-lime text-[10px] font-medium">
            Premium Member
          </div>
        </div>
      </div>

      {/* Profile Customization */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-app-text-muted mb-3 uppercase tracking-wider pl-2 flex items-center gap-2"><User className="w-3 h-3" /> Profile Information</h3>
        <div className="bg-app-surface border border-white/5 rounded-2xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Date of Birth</label>
              <input 
                type="date" 
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Time (Optional)</label>
              <input 
                type="time" 
                value={dobTime}
                onChange={(e) => setDobTime(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Sex</label>
              <select 
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
              >
                <option value="" disabled>Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Language</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
              >
                <option value="Tinglish">Tinglish</option>
                <option value="Telugu">Telugu</option>
                <option value="Hindi">Hindi</option>
                <option value="English">English</option>
                <option value="Tamil">Tamil</option>
                <option value="Kannada">Kannada</option>
              </select>
            </div>
          </div>
          <button 
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            aria-label="Save profile information"
            className="flex items-center gap-2 bg-app-lime text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-app-lime/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-3 h-3" /> {isSavingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Assistant Customization */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-app-text-muted mb-3 uppercase tracking-wider pl-2 flex items-center gap-2"><Bot className="w-3 h-3" /> Assistant Customization</h3>
        <div className="bg-app-surface border border-white/5 rounded-2xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Assistant Role</label>
            <select 
              value={assistantRole}
              onChange={(e) => setAssistantRole(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all"
            >
              <option value="Personal Assistant">Personal Assistant</option>
              <option value="Creative Writer">Creative Writer</option>
              <option value="Expert Coder">Expert Coder</option>
              <option value="Therapist">Therapist</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Custom Instructions</label>
            <textarea 
              value={assistantInstructions}
              onChange={(e) => setAssistantInstructions(e.target.value)}
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all resize-none"
            />
          </div>
          <button 
            onClick={handleSaveAssistant}
            aria-label="Save assistant settings"
            className="flex items-center gap-2 bg-app-lime text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-app-lime/90 transition-colors"
          >
            <Save className="w-3 h-3" /> Save Settings
          </button>
        </div>
      </div>

      {/* Setting Groups */}
      <div className="space-y-6">
        {SETTING_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-medium text-app-text-muted mb-3 uppercase tracking-wider pl-2">{group.title}</h3>
            <div className="bg-app-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
              {group.items.map((item) => (
                <button key={item.label} aria-label={item.label} className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/70">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-white/90">{item.label}</span>
                  </div>
                  {item.value && <span className="text-xs text-app-text-muted">{item.value}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button 
        onClick={logOut}
        aria-label="Sign out"
        className="mt-8 w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors text-sm font-medium"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
}
