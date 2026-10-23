import { ApiError } from '../../shared/ApiError.ts';
import { validateId } from '../../shared/validation.ts';

export function validateServeNextBody(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_INPUT', 'A JSON object with expectedEntryId is required.');
  }
  const fields = Object.keys(body);
  if (fields.length !== 1 || fields[0] !== 'expectedEntryId') {
    throw new ApiError(400, 'INVALID_INPUT', 'Only expectedEntryId is accepted.');
  }
  return validateId((body as Record<string, unknown>).expectedEntryId, 'expectedEntryId');
}

export function validateQueueQuery(query: Record<string, unknown>): string | undefined {
  if (Object.keys(query).some((key) => key !== 'serviceId')) {
    throw new ApiError(400, 'INVALID_INPUT', 'Only the serviceId filter is accepted.');
  }
  return query.serviceId === undefined ? undefined : validateId(query.serviceId, 'serviceId');
}

export function validateCompletionBody(body: unknown) {
  if (body === undefined) return;
  if (typeof body !== 'object' || body === null || Array.isArray(body) || Object.keys(body).length) {
    throw new ApiError(400, 'INVALID_INPUT', 'Completion accepts an empty body only; timestamps are recorded by the server.');
  }
}
