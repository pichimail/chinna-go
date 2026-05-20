import { HelpCircle, Mail, BookOpen, MessageCircle } from 'lucide-react';

export function Help() {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-app-bg">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-app-lime/20 rounded-2xl flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-app-lime" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Help & Support</h1>
            <p className="text-app-text-muted">Get assistance with Chinna.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-app-surface border border-white/5 p-6 rounded-3xl flex flex-col items-start hover:border-white/20 transition-colors cursor-pointer">
            <BookOpen className="w-8 h-8 text-app-lime mb-4" />
            <h3 className="text-xl font-semibold mb-2">Documentation</h3>
            <p className="text-white/60 mb-4 flex-1">Learn how to use Chinna's advanced features, including image, video, and music generation.</p>
            <span className="text-app-lime font-medium text-sm">Read Docs &rarr;</span>
          </div>
          <div className="bg-app-surface border border-white/5 p-6 rounded-3xl flex flex-col items-start hover:border-white/20 transition-colors cursor-pointer">
            <MessageCircle className="w-8 h-8 text-app-pink mb-4" />
            <h3 className="text-xl font-semibold mb-2">Community Forum</h3>
            <p className="text-white/60 mb-4 flex-1">Join the discussion, share your creations, and get help from other users.</p>
            <span className="text-app-pink font-medium text-sm">Join Forum &rarr;</span>
          </div>
        </div>

        <section className="bg-app-surface border border-white/5 p-8 rounded-3xl">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
            <Mail className="w-6 h-6 text-app-purple" /> Contact Support
          </h2>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Subject</label>
              <input type="text" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all" placeholder="How can we help?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Message</label>
              <textarea rows={5} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-app-lime focus:ring-1 focus:ring-app-lime outline-none transition-all resize-none" placeholder="Describe your issue or feedback..." />
            </div>
            <button className="bg-app-lime text-black font-semibold px-8 py-3 rounded-xl hover:bg-app-lime/90 transition-colors">
              Send Message
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
