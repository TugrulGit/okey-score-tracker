import type { ReactElement, ReactNode } from 'react';
import './landing.css';

// === Feature Card ===
/**
 * FeatureCard highlights a single product capability with an icon, title, and
 * supporting copy. Cards stay visually consistent thanks to shared styles here.
 */
export interface FeatureCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
}

export function FeatureCard({
  title,
  description,
  icon,
  className
}: FeatureCardProps): ReactElement {
  const baseClass = 'landing-feature-card';
  const composedClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <article className={composedClass}>
      {icon ? (
        <div className="landing-feature-card__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="landing-feature-card__title">{title}</h3>
      <p className="landing-feature-card__description">{description}</p>
    </article>
  );
}
