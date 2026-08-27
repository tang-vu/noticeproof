const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<!\d)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)/g;
const ORDER =
  /\b(?:order|confirmation|account)\s*(?:number|no\.?|#|id)?\s*[:#-]?\s*[A-Z0-9-]{6,}\b/gi;
const SECRET = /\b(?:password|passcode|one[- ]?time code|otp|cvv|routing number)\s*[:#-]?\s*\S+/gi;

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL, "[email redacted]")
    .replace(PHONE, "[phone redacted]")
    .replace(ORDER, "[order reference redacted]")
    .replace(SECRET, "[sensitive value redacted]");
}

export function sanitizePlainText(value: string, maxLength = 50_000): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function hasSensitiveRequest(value: string): boolean {
  return /password|one[- ]?time code|\botp\b|gift card|credit card|debit card|bank (?:account|details)|routing number|sign in|log ?in|download (?:this|the) (?:file|app)/i.test(
    value,
  );
}
