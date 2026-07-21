const errorMiddleware = (err, req, res, next) => {
  try {
    let error = { ...err };
    error.message = err.message;

    console.error(err); // Log the full error for the developer

    // 1. Mongoose Bad ObjectId (Cast Error)
    if (err.name === 'CastError') {
      const message = 'Resource not found';
      error = new Error(message);
      error.statusCode = 404;
    }

    // 2. Mongoose Duplicate Key Error (e.g., same email)
    if (err.code === 11000) {
      const message = 'Duplicate field value entered';
      error = new Error(message);
      error.statusCode = 400;
    }

    // 3. Mongoose Validation Error
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message);
      error = new Error(message);
      error.statusCode = 400;
    }

    // Send the response
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Server Error'
    });

  } catch (error) {
    next(error); 
  }
};

export default errorMiddleware;