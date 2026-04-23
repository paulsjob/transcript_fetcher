import { statusConfig } from '../data/readiness';

const widthClassByBucket = {
  0: 'w-0',
  1: 'w-1/12',
  2: 'w-2/12',
  3: 'w-3/12',
  4: 'w-4/12',
  5: 'w-5/12',
  6: 'w-6/12',
  7: 'w-7/12',
  8: 'w-8/12',
  9: 'w-9/12',
  10: 'w-10/12',
  11: 'w-11/12',
  12: 'w-full'
};

function SignalCard({ signal }) {
  const status = statusConfig[signal.status];
  const bucket = Math.max(0, Math.min(12, Math.round(signal.score / 8.33)));

  return (
    <article className="rounded-md border border-border bg-surface p-3 shadow-subtle">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-h3 font-heading text-text">{signal.label}</h3>
        <span className={`text-small font-semibold ${status.tone}`}>{status.label}</span>
      </header>

      <div className="h-2 rounded-sm bg-surfaceSubtle">
        <div
          className={`h-full rounded-sm bg-brand-accent ${widthClassByBucket[bucket]}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={signal.score}
          aria-label={`${signal.label} score`}
        />
      </div>

      <p className="mt-2 text-small text-textMuted">Readiness Score: {signal.score}/100</p>
    </article>
  );
}

export default SignalCard;
