import type { ReactElement } from 'react';
import './landing.css';

// === Highlight Stat Grid ===
/**
 * HighlightStatGrid displays small glass cards for KPIs (e.g., rounds tracked).
 * It standardizes how values/labels appear so multiple pages can reuse the chips.
 */
export interface HighlightStat {
  label: string;
  value: string;
}

export interface HighlightStatGridProps {
  stats: ReadonlyArray<HighlightStat>;
  className?: string;
}

export function HighlightStatGrid({
  stats,
  className
}: HighlightStatGridProps): ReactElement {
  const classes = className
    ? `landing-highlight-grid ${className}`
    : 'landing-highlight-grid';

  return (
    <div className={classes}>
      {stats.map((item) => (
        <div key={item.label} className="landing-highlight-card">
          <span className="landing-highlight-card__value">{item.value}</span>
          <span className="landing-highlight-card__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
