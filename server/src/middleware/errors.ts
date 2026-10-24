import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../shared/ApiError.ts';

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'API endpoint not found.'));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof URIError) {
    response.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'URL parameters must use valid encoding.' },
    });
    return;
  }

  if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      response.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      });
      return;
    }
    if (error.type === 'entity.too.large') {
      response.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 100 KB.' },
      });
      return;
    }
  }

  console.error(error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
  });
};
