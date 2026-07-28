import { badRequest } from "./http-error.js";

export const parseOptionalBoolean = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw badRequest(`${fieldName} must be true or false.`);
};
