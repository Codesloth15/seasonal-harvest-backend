import { aj, productReadAj } from "../config/arcjet.js";
import { measureRequest } from "../utils/request-timing.js";

export const createArcjetMiddleware = (client, timingName = "arcjet") => async (req, res, next) => {
  try {
    const decision = await measureRequest(timingName, () => client.protect(req));

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }

      if (decision.reason.isBot()) {
        return res.status(403).json({ error: "Bot access is restricted." });
      }

      return res.status(403).json({ error: "Access denied by security policy." });
    }

    next();
  } catch (error) {
    console.error(`Arcjet Error: ${error.message}`);

    next();
  }
};

const arcjetMiddleware = createArcjetMiddleware(aj);

export const productReadArcjetMiddleware = createArcjetMiddleware(productReadAj, "catalog_rate_limit");

export default arcjetMiddleware;
