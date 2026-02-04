import Head from 'next/head';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import {
  GlassButton,
  ScoreBoard,
  HeroPanel,
  HighlightStatGrid,
  FeatureCard,
  CallToActionBar
} from 'ui-kit';
import styles from '../styles/landing.module.css';

// === Copy & Content ===
const HIGHLIGHTS = [
  { label: 'Rounds tracked', value: '1.8M +' },
  { label: 'Average setup', value: '< 60s' },
  { label: 'Penalty presets', value: '12 types' }
] as const;

const FEATURES = [
  {
    title: 'Real-time collaboration',
    description: 'Every edit propagates instantly so the table stays aligned.',
    icon: '🤝'
  },
  {
    title: 'Glassy UI kit',
    description:
      'Score inputs, penalty chips, and overlays all follow the glass aesthetic.',
    icon: '🪟'
  },
  {
    title: 'Smart penalties',
    description:
      'Prebuilt penalty logic keeps totals honest and spotlights risky play.',
    icon: '⚡️'
  },
  {
    title: 'Shareable history',
    description:
      'Export the full session or resume unfinished rounds from any device.',
    icon: '📤'
  }
] as const;

const SCOREBOARD_PRESET = {
  players: ['Ada', 'Emre', 'Sibel', 'Mert'],
  rounds: [
    { scores: [420, 180, -60, -540] },
    { scores: [-120, 300, 80, -260] },
    { scores: [220, -180, 60, -100] }
  ],
  penalties: [
    { misplay: 1, okeyToOpponent: 0, usefulTile: 0, finisher: 0 },
    { misplay: 0, okeyToOpponent: 1, usefulTile: 0, finisher: 0 },
    { misplay: 0, okeyToOpponent: 0, usefulTile: 2, finisher: 0 },
    { misplay: 0, okeyToOpponent: 0, usefulTile: 0, finisher: 1 }
  ]
} as const;

/**
 * LandingPage renders the landing surface for the Okey Score Tracker.
 * It highlights product stats, outlines features, and embeds a live ScoreBoard preview.
 */
export default function LandingPage(): ReactElement {
  const router = useRouter();

  const handlePrimaryCta = () => {
    void router.push('/score_board');
  };

  const handleSecondaryCta = () => {
    const featuresSection = document.getElementById('features');
    if (!featuresSection) {
      return;
    }
    const offset = 64; // match the main page padding so the hero stays fully visible when scrolling back
    const targetTop =
      featuresSection.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: 'smooth'
    });
  };

  return (
    <>
      <Head>
        <title>Okey Score • Track Every Tile With Style</title>
        <meta
          name="description"
          content="A glassy, modern scoreboard for Okey nights. Keep scores, penalties, and table chatter in sync."
        />
      </Head>
      <main className={styles.page}>
        <div className={styles.auras} aria-hidden>
          <span className={`${styles.aura} ${styles.auraOne}`} />
          <span className={`${styles.aura} ${styles.auraTwo}`} />
          <span className={`${styles.aura} ${styles.auraThree}`} />
        </div>

        <section className={`${styles.section} ${styles.glassCard} ${styles.heroSection}`}>
          <HeroPanel
            eyebrow="Nightly scoreboard, perfected"
            title="Track every round of Okey with a floating, glassy control center."
            lede="Set up players in seconds, capture penalties with tactile wheels, and share the final table instantly. Okey Score brings arcade-grade polish to living-room showdowns."
            actions={
              <>
                <GlassButton
                  onClick={handlePrimaryCta}
                  className={styles.ctaButton}
                >
                  Launch the Score Board
                </GlassButton>
                <GlassButton
                  tone="secondary"
                  onClick={handleSecondaryCta}
                  className={styles.ctaButton}
                >
                  See the features
                </GlassButton>
              </>
            }
          >
            <HighlightStatGrid stats={HIGHLIGHTS} />
          </HeroPanel>
        </section>

        <section
          id="features"
          className={`${styles.section} ${styles.glassCard} ${styles.featuresSection}`}
        >
          <div>
            <p className={styles.eyebrow}>Why players switch</p>
            <h2 className={styles.sectionTitle}>Scores stay honest.</h2>
            <p className={styles.sectionCopy}>
              Structured rounds, penalty tags, and smart totals bring clarity to any
              Okey marathon. No more fuzzy math at 2am.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {FEATURES.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.glassCard} ${styles.showcaseSection}`}>
          <div className={styles.showcaseCopy}>
            <p className={styles.eyebrow}>Live preview</p>
            <h2 className={styles.sectionTitle}>ScoreBoard in action.</h2>
            <p className={styles.sectionCopy}>
              The landing preview embeds the same UI kit component you use inside the
              app. Tap around, adjust penalties, and feel the silky wheel input.
            </p>
            <div className={styles.showcaseList}>
              <span>• Start/pause rounds seamlessly</span>
              <span>• Swipeable penalty entries</span>
              <span>• Color-coded player accents</span>
            </div>
          </div>
          <div className={styles.scoreboardPreview}>
            <ScoreBoard
              title="Thursday Night League"
              initialPlayers={SCOREBOARD_PRESET.players}
              initialRounds={SCOREBOARD_PRESET.rounds}
              initialPenalties={SCOREBOARD_PRESET.penalties}
            />
            <p className={styles.previewHint}>
              Every change here mirrors the in-app experience.
            </p>
          </div>
        </section>

        <CallToActionBar
          eyebrow="Ready when you are"
          title="Host cleaner score nights in minutes."
          copy="No installs, no spreadsheets—just launch the board, invite friends, and keep the momentum."
          actions={
            <>
              <GlassButton onClick={handlePrimaryCta}>Open Score Board</GlassButton>
              <button
                type="button"
                className={styles.textLinkButton}
                onClick={handleSecondaryCta}
              >
                Peek at the feature set →
              </button>
            </>
          }
        />
      </main>
    </>
  );
}
