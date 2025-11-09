export type Points = number;

const MIN_POINTS = -500;
const MAX_POINTS = 500;

export const createPoints = (value: number): Points => {
  if (!Number.isFinite(value)) {
    throw new Error('Points must be a finite number.');
  }

  const rounded = Math.trunc(value);

  if (rounded < MIN_POINTS || rounded > MAX_POINTS) {
    throw new Error(`Points must be between ${MIN_POINTS} and ${MAX_POINTS}.`);
  }

  return rounded;
};

export const isPoints = (value: unknown): value is Points => {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.trunc(value) === value &&
    value >= MIN_POINTS &&
    value <= MAX_POINTS
  );
};
