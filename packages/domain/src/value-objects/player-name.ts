export type PlayerName = string;

const MIN_LENGTH = 2;
const MAX_LENGTH = 50;

export const createPlayerName = (value: string): PlayerName => {
  const normalized = value?.trim();

  if (!normalized || normalized.length < MIN_LENGTH) {
    throw new Error(`PlayerName must be at least ${MIN_LENGTH} characters.`);
  }

  if (normalized.length > MAX_LENGTH) {
    throw new Error(`PlayerName cannot exceed ${MAX_LENGTH} characters.`);
  }

  return normalized;
};

export const isPlayerName = (value: unknown): value is PlayerName => {
  return (
    typeof value === 'string' &&
    value.trim().length >= MIN_LENGTH &&
    value.trim().length <= MAX_LENGTH
  );
};
