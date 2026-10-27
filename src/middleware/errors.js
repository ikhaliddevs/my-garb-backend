class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function notFound(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

// Express recognizes error middleware by its four arguments.
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
  const known = {
    'entity.parse.failed': [400, 'INVALID_JSON', 'Malformed JSON body'],
    'entity.too.large': [413, 'BODY_TOO_LARGE', 'Request body exceeds limit'],
    'encoding.unsupported': [415, 'UNSUPPORTED_ENCODING', 'Unsupported body encoding'],
    'charset.unsupported': [415, 'UNSUPPORTED_CHARSET', 'Unsupported body charset'],
    'request.aborted': [400, 'REQUEST_ABORTED', 'Request was aborted'],
    'request.size.invalid': [400, 'INVALID_BODY_SIZE', 'Invalid body size'],
  };
  const [status, code, message] = known[error.type] || [500, 'INTERNAL_ERROR', 'An unexpected error occurred'];
  res.status(status).json({ success: false, error: { code, message } });
}

module.exports = { notFound, errorHandler, HttpError };
