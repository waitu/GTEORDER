export const Footer = () => {
  return (
    <footer className="mt-16 border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600">
        <span>© {new Date().getFullYear()} sclabel.io. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <a href="#privacy" className="hover:text-ink">Privacy</a>
          <a href="#terms" className="hover:text-ink">Terms</a>
          <a href="#contact" className="hover:text-ink">Support</a>
        </div>
      </div>
    </footer>
  );
};
