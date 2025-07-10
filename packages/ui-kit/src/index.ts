// Placeholder domain model
export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

export interface ScoreRow {
  round: number;
  playerId: PlayerId;
  points: number;
}

export { Button } from "./components/Button";
