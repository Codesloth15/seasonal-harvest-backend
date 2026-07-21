import { aj } from "../config/arcjet.js";

const arcjetMiddleware = async (req, res, next) => {
  try {
    const decision = await aj.protect(req,{requested:1});

    if (decision.isDenied()) {
      // Handle Rate Limiting
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
if (decision.reason.isRateLimit()) {
  console.log("Tokens remaining:", decision.reason.remaining);
}
      // Handle Bot Detection
      if (decision.reason.isBot()) {
        return res.status(403).json({ error: "Bot access is restricted." });
      }

      // General Denial (Shield protection)
      return res.status(403).json({ error: "Access denied by security policy." });
    }

    // If everything is fine, proceed to the next middleware/controller
    next();
  } catch (error) {
    console.error(`Arcjet Error: ${error.message}`);
    // We usually call next() here so your app doesn't crash 
    // if the Arcjet service has a connection issue.
    next();
  }
};

export default arcjetMiddleware;