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
              { misplay: 0, okeyToOpponent: 0, finisher: 0 },
              { misplay: 1, okeyToOpponent: 0, finisher: 0 },
              { misplay: 0, okeyToOpponent: 1, finisher: 0 }
            ]}
          />
        </div>
      </main>
    </>
  );
}
