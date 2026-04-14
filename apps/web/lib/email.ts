import { Resend } from "resend";

const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const apiKey = process.env.RESEND_API_KEY;

export const resend =
  isBuild || !apiKey
    ? ({} as Resend) // stub when building or key not configured
    : new Resend(apiKey);