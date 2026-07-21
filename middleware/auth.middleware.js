import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';

const authorize = async (req, res, next) => {
  try {
    let token;

    // 1. Check if the token exists in the headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extract the token from: "Bearer <token_string>"
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      const error = new Error("Not authorized to access this route");
      error.statusCode = 401;
      throw error;
    }

    // 2. Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. Attach user info to request
    req.user = {
      id: decoded.userId || decoded.sub || decoded.id,
      email: decoded.email,
      _id: decoded.userId || decoded.sub || decoded.id
    };

    next();
  } catch (error) {
    if (error.message === 'jwt expired') {
      error.statusCode = 401;
      error.message = 'Token expired';
    } else if (error.message === 'invalid token' || error.message === 'jwt malformed') {
      error.statusCode = 401;
      error.message = 'Invalid token';
    }
    next(error);
  }
};

export default authorize;