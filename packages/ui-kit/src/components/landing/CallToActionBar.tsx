import type { ReactElement, ReactNode } from 'react';
import './landing.css';

// === Call To Action Bar ===
/**
 * CallToActionBar renders the gradient glass banner used at the bottom of
 * landing pages. It keeps eyebrow/title/copy spacing aligned and exposes
 * an actions slot for buttons or links.
 */
export interface CallToActionBarProps {
  eyebrow?: string;
  title: string;
  copy: string;
  actions?: ReactNode;
  className?: string;
}

export function CallToActionBar({
  eyebrow,
  title,
  copy,
  actions,
  className
}: CallToActionBarProps): ReactElement {
  const baseClass = 'landing-cta';
  const composedClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <section className={composedClass}>
      <div>
        {eyebrow ? <p className="landing-cta__eyebrow">{eyebrow}</p> : null}
        <h2 className="landing-cta__title">{title}</h2>
        <p className="landing-cta__copy">{copy}</p>
      </div>
      {actions ? <div className="landing-cta__actions">{actions}</div> : null}
    </section>
  );
}
