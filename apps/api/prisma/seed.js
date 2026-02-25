import { PrismaClient, GameStatus, PenaltyType } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@okeyscore.local';
const PENALTY_UI_KEY = {
  [PenaltyType.MISPLAY]: 'misplay',
  [PenaltyType.OKEY_TO_OPPONENT]: 'okeyToOpponent',
  [PenaltyType.USEFUL_TILE]: 'usefulTile',
  [PenaltyType.FINISHER]: 'finisher'
};

const playerSeeds = [
  { name: 'Hasan', color: '#007cbe' },
  { name: 'Kerem', color: '#ffd639' },
  { name: 'Maya', color: '#fbaf00' },
  { name: 'Tuna', color: '#00af54' }
];

const roundSeeds = [
  { scores: [20, -10, -5, -5], minutesAgo: 55 },
  { scores: [-15, 30, -10, -5], minutesAgo: 40 },
  { scores: [-5, -5, 15, -5], minutesAgo: 25 }
];

const penaltySeeds = [
  { playerIndex: 1, type: PenaltyType.MISPLAY, value: 5, roundIndex: 0 },
  { playerIndex: 2, type: PenaltyType.USEFUL_TILE, value: 10, roundIndex: 1 },
  { playerIndex: 0, type: PenaltyType.FINISHER, value: 5, roundIndex: 2 }
];

async function seed() {
  console.log('🌱 Seeding demo data...');

  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      displayName: 'Demo Okey Captain',
      lastLoginAt: new Date()
    },
    create: {
      email: DEMO_EMAIL,
      passwordHash: 'demo-password-placeholder',
      displayName: 'Demo Okey Captain',
      timezone: 'Europe/Istanbul'
    }
  });

  await prisma.session.deleteMany({ where: { userId: demoUser.id } });
  await prisma.game.deleteMany({ where: { ownerId: demoUser.id } });

  const game = await prisma.game.create({
    data: {
      ownerId: demoUser.id,
      title: 'Seeded Championship Showdown',
      status: GameStatus.COMPLETED,
      startedAt: new Date(Date.now() - 1000 * 60 * 60),
      completedAt: new Date(Date.now() - 1000 * 60 * 5),
      notes: 'Sample data so dashboard & history aren\'t empty.',
      players: {
        create: playerSeeds.map((player, index) => ({
          displayName: player.name,
          seatIndex: index,
          avatarColor: player.color
        }))
      }
    },
    include: { players: true }
  });

  const rounds = [];
  for (const [index, round] of roundSeeds.entries()) {
    const createdRound = await prisma.round.create({
      data: {
        gameId: game.id,
        index,
        startedAt: new Date(Date.now() - round.minutesAgo * 60 * 1000)
      }
    });

    await prisma.roundScore.createMany({
      data: game.players.map((player, seatIndex) => ({
        roundId: createdRound.id,
        playerId: player.id,
        points: round.scores[seatIndex]
      }))
    });

    rounds.push({ id: createdRound.id, scores: round.scores });
  }

  const penaltyState = game.players.reduce((acc, player) => {
    acc[player.id] = {
      misplay: 0,
      okeyToOpponent: 0,
      usefulTile: 0,
      finisher: 0
    };
    return acc;
  }, {});

  for (const penalty of penaltySeeds) {
    const targetPlayer = game.players[penalty.playerIndex];
    const targetRound = penalty.roundIndex != null ? rounds[penalty.roundIndex] : undefined;
    await prisma.penalty.create({
      data: {
        gameId: game.id,
        roundId: targetRound ? targetRound.id : null,
        playerId: targetPlayer.id,
        type: penalty.type,
        value: penalty.value
      }
    });

    const uiKey = PENALTY_UI_KEY[penalty.type];
    penaltyState[targetPlayer.id][uiKey] += penalty.value;
  }

  const totals = game.players.map((player, seatIndex) => {
    const roundTotal = roundSeeds.reduce((sum, round) => sum + round.scores[seatIndex], 0);
    const penaltyTotal = Object.values(penaltyState[player.id]).reduce((sum, value) => sum + value, 0);
    return roundTotal - penaltyTotal;
  });

  const leaderIndex = totals.reduce(
    (bestIndex, total, index) => (total > totals[bestIndex] ? index : bestIndex),
    0
  );

  const payload = {
    players: game.players.map((player) => ({ id: player.id, name: player.displayName })),
    rounds,
    penalties: penaltyState,
    totals,
    started: false
  };

  const summary = {
    leader: {
      playerId: game.players[leaderIndex].id,
      name: game.players[leaderIndex].displayName,
      total: totals[leaderIndex]
    },
    rounds: rounds.length,
    completedAt: game.completedAt ? game.completedAt.toISOString() : null,
    penalties: penaltyState,
    notes: game.notes
  };

  await prisma.gameSnapshot.upsert({
    where: { gameId: game.id },
    update: { payload, summary },
    create: { gameId: game.id, payload, summary }
  });

  console.log('✅ Seed complete');
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
