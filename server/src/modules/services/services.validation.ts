import { ApiError } from '../../shared/ApiError.ts';

export interface ServiceInput {
  name: string;
  description: string;
  expectedDurationMinutes: number;
  priority: number;
}

export function validateServiceInput(input: unknown): ServiceInput {
  if (typeof input !== 'object' || input === null) {
    throw new ApiError(
      400,
      'INVALID_SERVICE',
      'Request body must be an object.',
    );
  }

  const body = input as Record<string, unknown>;

  if (
    typeof body.name !== 'string' ||
    body.name.trim().length === 0
  ) {
    throw new ApiError(
      400,
      'INVALID_SERVICE_NAME',
      'Service name is required.',
    );
  }

  if (body.name.trim().length > 100) {
    throw new ApiError(
      400,
      'INVALID_SERVICE_NAME',
      'Service name must be 100 characters or fewer.',
    );
  }

  if (
    typeof body.description !== 'string' ||
    body.description.trim().length === 0
  ) {
    throw new ApiError(
      400,
      'INVALID_SERVICE_DESCRIPTION',
      'Description is required.',
    );
  }

  if (body.description.trim().length > 500) {
    throw new ApiError(
      400,
      'INVALID_SERVICE_DESCRIPTION',
      'Description must be 500 characters or fewer.',
    );
  }

  if (
    typeof body.expectedDurationMinutes !== 'number' ||
    !Number.isFinite(body.expectedDurationMinutes) ||
    body.expectedDurationMinutes <= 0
  ) {
    throw new ApiError(
      400,
      'INVALID_SERVICE_DURATION',
      'Expected duration must be a positive number.',
    );
  }

  if (
    typeof body.priority !== 'number' ||
    !Number.isInteger(body.priority) ||
    body.priority < 0
  ) {
    throw new ApiError(
      400,
      'INVALID_SERVICE_PRIORITY',
      'Priority must be a non-negative integer.',
    );
  }

  return {
    name: body.name.trim(),
    description: body.description.trim(),
    expectedDurationMinutes: body.expectedDurationMinutes,
    priority: body.priority,
  };
}