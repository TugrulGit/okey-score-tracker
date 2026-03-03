import Head from 'next/head';
import { ThemeToggle } from '../components/ThemeToggle';
import styles from '../styles/score-board-page.module.css';
import { ScoreBoard } from 'ui-kit';

export default function ScoreBoardPage() {
  return (
    <>
      <Head>
        <title>Okey Score • Score Board</title>
      </Head>
      <main className={styles.page}>
        <div className={styles.header}>
          <ThemeToggle />
        </div>
        <div className={styles.boardShell}>
          <ScoreBoard
            title="Okey Score Table"
            initialPlayers={['Aylin', 'Mert', 'Deniz', 'Can']}
            initialRounds={[
              { scores: [52, 93, 115, 78] },
              { scores: [101, 110, 42, 56] },
              { scores: [78, 56, 34, 90] },
              { scores: [42, 80, 68, 100] }
            ]}
            initialPenalties={[
              { MISPLAY: 0, OKEY_TO_OPPONENT: 0, FINISHER: 0 },
              { MISPLAY: 1, OKEY_TO_OPPONENT: 0, FINISHER: 0 },
              { MISPLAY: 0, OKEY_TO_OPPONENT: 1, FINISHER: 0 }
            ]}
          />
        </div>
      </main>
    </>
  );
}
