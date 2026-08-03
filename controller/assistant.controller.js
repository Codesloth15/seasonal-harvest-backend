import { askAssistant } from "../services/assistant.service.js";

export const chat = async (req, res, next) => {
  try {
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > 2000) {
      const error = new Error("message is required and must not exceed 2,000 characters.");
      error.statusCode = 400;
      throw error;
    }

    const result = await askAssistant(message, {
      userId: req.user.id,
      role: req.profile.role,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
