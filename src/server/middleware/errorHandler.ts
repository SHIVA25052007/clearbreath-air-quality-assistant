import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

function getErrorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function isJsonSyntaxError(err: unknown): boolean {
  return err instanceof SyntaxError && getErrorStatus(err) === 400;
}

function isPayloadTooLargeError(err: unknown): boolean {
  if (getErrorStatus(err) === 413) {
    return true;
  }
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: unknown }).type === 'entity.too.large'
  );
}

export const apiErrorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (isPayloadTooLargeError(err)) {
    res.status(413).json({ error: 'Request payload is too large.' });
    return;
  }
  if (isJsonSyntaxError(err)) {
    res.status(400).json({ error: 'Invalid JSON request body.' });
    return;
  }
  res.status(500).json({ error: 'Unexpected server error. Please try again.' });
};
