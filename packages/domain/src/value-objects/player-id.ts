export type PlayerId = string;

export const createPlayerId = (value: string): PlayerId => {
  if (!value || !value.trim()) {
    throw new Error('PlayerId must be a non-empty string.');
  }

  return value.trim();
};

export const isPlayerId = (value: unknown): value is PlayerId => {
  return typeof value === 'string' && value.trim().length > 0;
};
