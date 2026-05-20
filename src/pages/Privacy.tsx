import { Shield } from 'lucide-react';

export function Privacy() {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-app-bg">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-app-lime/20 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-app-lime" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Privacy & Security</h1>
            <p className="text-app-text-muted">How we protect your data.</p>
          </div>
        </header>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section className="bg-app-surface border border-white/5 p-6 rounded-3xl">
            <h2 className="text-xl font-semibold text-white mb-4">Data Collection</h2>
            <p className="mb-4">
              Chinna collects only the necessary information to provide you with a personalized assistant experience. This includes your chat history, generated media, and account information (email, name, profile picture) provided by Google Authentication.
            </p>
            <p>
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section className="bg-app-surface border border-white/5 p-6 rounded-3xl">
            <h2 className="text-xl font-semibold text-white mb-4">Data Security</h2>
            <p className="mb-4">
              All data is encrypted in transit and at rest using industry-standard protocols. Your chat history and generated files are securely stored in Firebase Firestore and Cloud Storage, accessible only by you.
            </p>
            <p>
              We employ strict security rules to ensure that no other user can access your private data.
            </p>
          </section>

          <section className="bg-app-surface border border-white/5 p-6 rounded-3xl">
            <h2 className="text-xl font-semibold text-white mb-4">AI Processing</h2>
            <p className="mb-4">
              Your prompts and files are processed by Google's Gemini and Lyria models to generate responses and media. These interactions are subject to Google's Generative AI terms of service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
