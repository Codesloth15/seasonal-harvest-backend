import mongoose from "mongoose";
import User from "../model/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";



export const signUp = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error("User already exists");
      error.statusCode = 409;
      throw error;
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUsers = await User.create(
      [{ name, email, password: hashedPassword }],
      { session },
    );

const token = jwt.sign({userId: newUsers[0]._id}, JWT_SECRET, {expiresIn: JWT_EXPIRES_IN});

    await session.commitTransaction();
    session.endSession();
    res.status(201).json({success:true,message:"new user created",data:{token,user: newUsers[0]}});
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};




export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user and explicitly include password
    const currentUser = await User.findOne({ email }).select('+password');

    if (currentUser) {
      // FIX: Use 'currentUser.password', NOT 'User.password'
      const isMatch = await bcrypt.compare(password, currentUser.password);
      
      if (!isMatch) {
        const error = new Error("Invalid credentials");
        error.statusCode = 401; // 401 is for Authentication errors
        throw error;
      }

      // FIX: Use 'currentUser._id', NOT 'User._id'
      const token = jwt.sign(
        { userId: currentUser._id }, 
        JWT_SECRET, 
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Remove password from the object before sending response for safety
      currentUser.password = undefined;

      res.status(200).json({ 
        success: true, 
        message: "User signed in successfully",
        data: {
          token, 
          user: currentUser 
        }
      });
    } else {
      const error = new Error("No user with these credentials");
      error.statusCode = 404; // 404 is better for "Not Found"
      throw error;
    }
  } catch (error) {
    next(error);
  }
};




export const signout = async (req, res, next) => {
  try {
    // If you are using Cookies to store the JWT:
    // res.clearCookie('token');

    res.status(200).json({
      success: true,
      message: "User signed out successfully",
    });
  } catch (error) {
    next(error);
  }
};