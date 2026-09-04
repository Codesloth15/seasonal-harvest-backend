import { askAssistant } from "../services/assistant.service.js";

const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CHARACTERS = 20_000;

const invalidHistory = () => {
  const error = new Error(
    "history must contain at most 20 valid user or assistant messages.",
  );
  error.statusCode = 400;
  return error;
};

const normalizeHistory = (value) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_HISTORY_MESSAGES) {
    throw invalidHistory();
  }

  const history = value.map((entry) => {
    const role = entry?.role;
    const content = typeof entry?.content === "string" ? entry.content.trim() : "";
    if (!["user", "assistant"].includes(role) || !content || content.length > 2000) {
      throw invalidHistory();
    }
    return { role, content };
  });

  const characterCount = history.reduce(
    (total, entry) => total + entry.content.length,
    0,
  );
  if (characterCount > MAX_HISTORY_CHARACTERS) throw invalidHistory();
  return history;
};

export const chat = async (req, res, next) => {
  try {
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > 2000) {
      const error = new Error("message is required and must not exceed 2,000 characters.");
      error.statusCode = 400;
      throw error;
    }
    const history = normalizeHistory(req.body.history);

    const result = await askAssistant(message, {
      userId: req.user.id,
      role: req.profile.role,
      accessToken: req.accessToken,
    }, history);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
