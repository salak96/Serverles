import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestId(): (req: Request, res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    req.id = (req.headers['x-request-id'] as string) || randomUUID();
    next();
  };
}
