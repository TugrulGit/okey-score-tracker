export type RoundNumber = number;

export const createRoundNumber = (value: number): RoundNumber => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('RoundNumber must be an integer greater than 0.');
  }

  return value;
};

export const isRoundNumber = (value: unknown): value is RoundNumber => {
  return Number.isInteger(value) && (value as number) >= 1;
};
