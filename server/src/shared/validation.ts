import { ApiError } from './ApiError.ts';

export function validateId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value)) {
    throw new ApiError(400, 'INVALID_INPUT', `${field} must be 1-100 letters, numbers, hyphens, or underscores.`);
  }
  return value;
}
