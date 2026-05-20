import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { MessageSquare, Mic, PenTool, Clock, Settings, Home, Menu, User, X, Moon, Sun, LogOut, Shield, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Landing } from '../pages/Landing';
import { Onboarding } from '../pages/Onboarding';
import { motion, AnimatePresence } from 'motion/react';

const NAV_ITEMS = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Chat', path: '/chat', icon: MessageSquare },
  { name: 'Voice', path: '/voice', icon: Mic },
  { name: 'Create', path: '/create', icon: PenTool },
];

export function Layout() {
  const { user, userProfile, logOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        // If visual viewport height is significantly less than window innerHeight, keyboard is likely open
        setIsKeyboardOpen(window.visualViewport.height < window.innerHeight - 100);
        document.documentElement.style.setProperty('--viewport-height', `${window.visualViewport.height}px`);
      }
    };
    
    window.visualViewport?.addEventListener('resize', handleResize);
    // Initial set
    handleResize();
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  // Swipe gesture handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && !isProfileOpen) {
      setIsMobileMenuOpen(true);
    }
    if (isRightSwipe && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  if (!user) {
    return <Landing />;
  }

  if (userProfile && !userProfile.onboardingCompleted) {
    return <Onboarding />;
  }

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleSignOut = async () => {
    await logOut();
    navigate('/');
  };

  return (
    <div 
      className={`w-full overflow-hidden bg-topo flex flex-col md:flex-row ${isDarkMode ? 'dark' : ''}`}
      style={{ height: 'var(--viewport-height, 100dvh)' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEndHandler}
    >
      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-app-bg/80 backdrop-blur-2xl border-b border-white/[0.02] flex items-center justify-between px-4 z-40">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-white/70 hover:text-white transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 font-semibold text-base tracking-wide">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-app-lime to-app-purple flex items-center justify-center shadow-lg">
            <Mic className="w-3 h-3 text-black" />
          </div>
          Chinna
        </div>
        <button onClick={() => setIsProfileOpen(true)} className="w-7 h-7 rounded-full overflow-hidden border border-white/10 ring-2 ring-transparent hover:ring-white/20 transition-all">
          {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-4 h-4 m-1.5 text-white/70" />}
        </button>
      </header>

      {/* Mobile Sidebar (History/Menu) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 right-0 bottom-0 w-72 bg-app-surface border-l border-white/5 z-50 flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <span className="font-bold text-xl flex items-center gap-2"><Clock className="w-5 h-5 text-app-lime"/> Menu</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-white/50 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                <NavLink to="/history" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => cn("flex items-center gap-3 px-4 py-3 rounded-2xl transition-all", isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5")}>
                  <Clock className="w-5 h-5" /> History
                </NavLink>
                <NavLink to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={({isActive}) => cn("flex items-center gap-3 px-4 py-3 rounded-2xl transition-all", isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5")}>
                  <Settings className="w-5 h-5" /> Settings
                </NavLink>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Profile Bottom Sheet */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-app-surface border-t border-white/10 rounded-t-3xl z-50 p-6 pb-safe"
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
              <div className="flex items-center gap-4 mb-8">
                <img src={user.photoURL || ''} alt="Avatar" className="w-16 h-16 rounded-full border border-white/10" />
                <div>
                  <h3 className="font-bold text-lg">{user.displayName}</h3>
                  <p className="text-white/50 text-sm">{user.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-white/5 transition-colors text-left">
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button onClick={() => { setIsProfileOpen(false); navigate('/privacy'); }} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-white/5 transition-colors text-left">
                  <Shield className="w-5 h-5" /> Privacy & Security
                </button>
                <button onClick={() => { setIsProfileOpen(false); navigate('/help'); }} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-white/5 transition-colors text-left">
                  <HelpCircle className="w-5 h-5" /> Help & Support
                </button>
                <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-red-500/10 text-red-500 transition-colors text-left mt-4">
                  <LogOut className="w-5 h-5" /> Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-app-surface/50 backdrop-blur-xl border-r border-white/5 p-4">
        <div className="flex items-center gap-3 px-4 py-6 mb-4">
          <div className="w-10 h-10 bg-gradient-to-tr from-app-lime to-app-purple rounded-full flex items-center justify-center shadow-lg">
            <Mic className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-xl tracking-wide">Chinna</span>
        </div>
        <nav className="flex-1 space-y-2">
          {[...NAV_ITEMS, { name: 'History', path: '/history', icon: Clock }, { name: 'Settings', path: '/settings', icon: Settings }].map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                  isActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-app-text-muted hover:bg-white/5 hover:text-white"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        
        {/* Desktop Profile Dropdown Area */}
        <div className="mt-auto relative group">
          <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-2xl transition-colors">
            <img src={user.photoURL || ''} alt="Avatar" className="w-10 h-10 rounded-full border border-white/10" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-app-text-muted truncate">{user.email}</p>
            </div>
          </div>
          
          {/* Dropdown Menu */}
          <div className="absolute bottom-full left-0 w-full mb-2 bg-app-surface border border-white/10 rounded-2xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-2xl translate-y-2 group-hover:translate-y-0">
            <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left text-sm">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button onClick={() => navigate('/privacy')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left text-sm">
              <Shield className="w-4 h-4" /> Privacy
            </button>
            <button onClick={() => navigate('/help')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left text-sm">
              <HelpCircle className="w-4 h-4" /> Help
            </button>
            <div className="h-px bg-white/10 my-1" />
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors text-left text-sm">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 relative overflow-hidden flex flex-col pt-14 md:pt-0 ${isKeyboardOpen ? 'pb-0' : 'pb-[90px]'} md:pb-0 transition-all duration-300`}>
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <AnimatePresence>
        {!isKeyboardOpen && (
          <motion.nav 
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="md:hidden fixed bottom-4 left-4 right-4 bg-app-surface/80 backdrop-blur-2xl border border-white/10 rounded-3xl pb-safe z-40 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-around items-center p-2">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "relative flex flex-col items-center p-2 rounded-2xl transition-all duration-300 w-16",
                      isActive ? "text-black" : "text-white/50 hover:text-white/80"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div 
                          layoutId="bottomNavIndicator"
                          className="absolute inset-0 bg-app-lime rounded-2xl -z-10"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <item.icon className={cn("w-5 h-5 mb-1 z-10", item.name === 'Voice' && "w-6 h-6")} />
                      <span className="text-[9px] font-semibold tracking-wide z-10">{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
