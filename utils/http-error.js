export class HttpError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message, options);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export const badRequest = (message) => new HttpError(400, message);
export const unauthorized = (message) => new HttpError(401, message);
export const forbidden = (message) => new HttpError(403, message);
export const notFound = (resource) => new HttpError(404, `${resource} not found.`);
export const conflict = (message) => new HttpError(409, message);
