// API utility for Okey backend
export interface Game {
  // Adjust fields as needed to match your game structure
  players: { name: string; scores: number[] }[];
  createdAt?: string;
}

const API_BASE = "/api";

export async function getGames(): Promise<Game[]> {
  const res = await fetch(`${API_BASE}/games`);
  return res.json();
}

export async function addGame(game: Game): Promise<Game> {
  const res = await fetch(`${API_BASE}/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(game),
  });
  return res.json();
}

export async function resetGames(): Promise<void> {
  await fetch(`${API_BASE}/games`, { method: "DELETE" });
}
