import type { ReactElement, ReactNode } from 'react';
import './landing.css';

// === Landing Hero Panel ===
/**
 * HeroPanel renders the headline block for landing pages with eyebrow copy,
 * a primary title, supporting lede, and optional action slots. It keeps the
 * text layout consistent so every consumer achieves the same visual rhythm.
 */
export interface HeroPanelProps {
  eyebrow?: string;
  title: string;
  lede: string;
  align?: 'center' | 'start';
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function HeroPanel({
  eyebrow,
  title,
  lede,
  align = 'center',
  actions,
  children,
  className
}: HeroPanelProps): ReactElement {
  const alignmentClass =
    align === 'start' ? 'landing-hero landing-hero--start' : 'landing-hero';
  const composedClassName = className
    ? `${alignmentClass} ${className}`
    : alignmentClass;

  return (
    <div className={composedClassName}>
      {eyebrow ? <p className="landing-hero__eyebrow">{eyebrow}</p> : null}
      <h1 className="landing-hero__title">{title}</h1>
      <p className="landing-hero__lede">{lede}</p>
      {actions ? <div className="landing-hero__actions">{actions}</div> : null}
      {children}
    </div>
  );
}
