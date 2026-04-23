import LayoutShell from './components/LayoutShell';
import SignalCard from './components/SignalCard';
import { readinessSignals } from './data/readiness';

function App() {
  return (
    <LayoutShell>
      <section className="col-span-12 rounded-md border border-border bg-surface p-3 shadow-subtle">
        <p className="mb-1 text-small font-semibold uppercase tracking-wide text-brand-secondary">Evaluation System</p>
        <h1 className="text-h1 font-heading text-brand-primary">Readiness Console</h1>
        <p className="mt-1 max-w-2xl text-body text-textMuted">
          This interface prioritizes structural indicators over presentation. Focus is placed on reliability,
          documentation quality, and operational consistency.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-md bg-brand-accent px-2 py-1 text-small font-semibold text-text transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Review Profile
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-transparent px-2 py-1 text-small font-semibold text-text transition-colors hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Export Summary
          </button>
        </div>
      </section>

      <section className="col-span-12 lg:col-span-8">
        <h2 className="mb-2 text-h2 font-heading text-brand-primary">Operational Signals</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {readinessSignals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      </section>

      <aside className="col-span-12 rounded-md border border-border bg-surface p-3 shadow-subtle lg:col-span-4">
        <h2 className="text-h2 font-heading text-brand-primary">Current Gate</h2>
        <p className="mt-1 text-body text-textMuted">Candidate is within range for structured advancement.</p>
        <div className="mt-3 space-y-2">
          <div className="rounded-md border border-border bg-surfaceSubtle p-2">
            <p className="text-small font-semibold text-brand-secondary">Next Review Window</p>
            <p className="text-body text-text">May 02, 2026</p>
          </div>
          <div className="rounded-md border border-border bg-surfaceSubtle p-2">
            <p className="text-small font-semibold text-brand-secondary">Required Evidence</p>
            <p className="text-body text-text">Two successive delivery cycles above 80/100</p>
          </div>
        </div>
      </aside>
    </LayoutShell>
  );
}

export default App;
