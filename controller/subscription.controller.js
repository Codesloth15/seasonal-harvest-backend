import { workflowClient } from "../config/upstah.js";
import Subscription from "../model/subscription.model.js";
import { SERVER_URL } from '../config/env.js';

export const createSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.create({
      ...req.body,
      user: req.user._id, 
    });

  
    await workflowClient.trigger({
      url: `${SERVER_URL}/api/v1/workflows/subscription/reminder`,
      body: {
        subscriptionId: subscription._id, // Pass the ID so the workflow can fetch it
      },
      headers: {
        'content-type': 'application/json',
      },
      retries: 3, // Optional: retry if the initial trigger fails
    });

    res.status(201).json({ success: true, data: subscription });
  } catch (error) {
    
    next(error.message);
  }
};

export const getUserSubscription = async (req, res, next) => {
  try {
    // 1. Find the specific subscription using the URL param (e.g., /:id)
    const subscription = await Subscription.findById(req.params.id);
    console.log(req.ip);
    // 2. If it doesn't exist, throw a 404
    if (!subscription) {
      const error = new Error('Subscription not found');
      error.statusCode = 404;
      throw error;
    }

    // 3. Check if the subscription belongs to the logged-in user
    // Note: We use .toString() because MongoDB IDs are Objects, not Strings
    if (subscription.user.toString() !== req.user._id.toString()) {
      const error = new Error('You are not the owner of this subscription');
      error.statusCode = 401;
      throw error;
    }

    res.status(200).json({ success: true, data: subscription });
  } catch (e) {
    next(e);
  }
};