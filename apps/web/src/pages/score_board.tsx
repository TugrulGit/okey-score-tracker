import Head from 'next/head';
import { ScoreBoard } from 'ui-kit';
export default function ScoreBoardPage() {
  return (
    <>
      <Head>
        <title>Okey Score • Score Board</title>
      </Head>
      <main
        style={{
          minHeight: '100vh',
          background:
            'linear-gradient(160deg, rgba(0,124,190,0.25) 0%, rgba(255,163,175,0.20) 50%, rgba(255,214,57,0.18) 100%)',
          padding: '40px 16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      >
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
            { misplay: 0, okeyToOpponent: 0, slowPlay: 0 },
            { misplay: 1, okeyToOpponent: 0, slowPlay: 0 },
            { misplay: 0, okeyToOpponent: 1, slowPlay: 0 }
          ]}
        />
      </main>
    </>
  );
}
