/**
 * Privacy Redaction Utilities
 *
 * Detects and redacts potential identifying information from user input
 * before storage, logging, embedding, or sending to AI providers.
 *
 * Per spec sections 5, 27I.
 */

// ─── Pattern Library ──────────────────────────────────────────────────────────

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;

const PHONE_PATTERN =
  /(\+?[\d\s\-().]{7,15}\d)(?=\s|$|[,;.])/g;

const UK_POSTCODE_PATTERN = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi;

const US_ZIPCODE_PATTERN = /\b\d{5}(?:-\d{4})?\b/g;

// Street addresses
const ADDRESS_PATTERN =
  /\b\d+\s+(?:[A-Za-z]+\s+){0,4}(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Close|Cl|Way|Court|Ct)\b/gi;

// Full dates (various formats)
const DATE_PATTERN =
  /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g;

// Month + year DOB patterns ("born in March 2019", "born March 2019")
const DOB_MENTION_PATTERN =
  /\b(born|birthday|dob|date of birth)\b[^.]{0,40}\d{4}\b/gi;

// School/nursery keywords
const SCHOOL_KEYWORDS_PATTERN =
  /\b(school|nursery|kindergarten|preschool|primary school|elementary school|academy)\s+[A-Z][a-z]+/gi;

// Common first name indicators — heuristic only
const NAME_INDICATORS = [
  "my son",
  "my daughter",
  "my child",
  "his name is",
  "her name is",
  "their name is",
  "called",
  "named",
];

// ─── Redaction ────────────────────────────────────────────────────────────────

export interface RedactionResult {
  redacted: string;
  wasModified: boolean;
  detectedTypes: RedactionCategory[];
}

export type RedactionCategory =
  | "email"
  | "phone"
  | "postcode"
  | "address"
  | "date_of_birth"
  | "school_name"
  | "potential_name";

type Replacement = { pattern: RegExp; replacement: string; category: RedactionCategory };

const REPLACEMENTS: Replacement[] = [
  { pattern: EMAIL_PATTERN, replacement: "[email removed]", category: "email" },
  { pattern: PHONE_PATTERN, replacement: "[phone removed]", category: "phone" },
  { pattern: UK_POSTCODE_PATTERN, replacement: "[postcode removed]", category: "postcode" },
  { pattern: US_ZIPCODE_PATTERN, replacement: "[zip removed]", category: "postcode" },
  { pattern: ADDRESS_PATTERN, replacement: "[address removed]", category: "address" },
  { pattern: DOB_MENTION_PATTERN, replacement: "[date of birth removed]", category: "date_of_birth" },
  { pattern: DATE_PATTERN, replacement: "[date removed]", category: "date_of_birth" },
  { pattern: SCHOOL_KEYWORDS_PATTERN, replacement: "[school name removed]", category: "school_name" },
];

/**
 * Redacts potential identifying information from a text string.
 * Returns the cleaned text and metadata about what was detected.
 */
export function redactIdentifyingInformation(input: string): RedactionResult {
  let text = input;
  const detectedTypes = new Set<RedactionCategory>();

  for (const { pattern, replacement, category } of REPLACEMENTS) {
    const patternCopy = new RegExp(pattern.source, pattern.flags);
    const before = text;
    text = text.replace(patternCopy, () => {
      detectedTypes.add(category);
      return replacement;
    });
  }

  // Heuristic name detection: flag if name indicator found
  const lowerText = input.toLowerCase();
  for (const indicator of NAME_INDICATORS) {
    if (lowerText.includes(indicator)) {
      detectedTypes.add("potential_name");
      break;
    }
  }

  return {
    redacted: text,
    wasModified: text !== input,
    detectedTypes: Array.from(detectedTypes),
  };
}

/**
 * Reminder message shown to the user when potential identifying info is detected.
 */
export function getPrivacyReminderMessage(categories: RedactionCategory[]): string {
  const specifics = categories
    .map((c) => {
      const map: Record<RedactionCategory, string> = {
        email: "email address",
        phone: "phone number",
        postcode: "postcode or zip code",
        address: "street address",
        date_of_birth: "exact date of birth",
        school_name: "school or nursery name",
        potential_name: "your child's name",
      };
      return map[c];
    })
    .join(", ");

  return `We noticed you may have included ${specifics}. We don't need this to create your plan — we've removed it to protect your privacy. Please don't share identifying information.`;
}

/**
 * The standard privacy notice shown before the user starts chatting.
 */
export const PRIVACY_NOTICE = `Please do not enter names, addresses, schools, exact birth dates, contact details, photographs, or other information that could identify you or your child. We do not need this information to create your planner.`;

/**
 * Check if a string looks like it contains identifying information,
 * without modifying it — useful for UI warnings before submission.
 */
export function hasIdentifyingInformation(input: string): boolean {
  return redactIdentifyingInformation(input).wasModified;
}
