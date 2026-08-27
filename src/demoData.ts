import fraudulent from "../fixtures/v1/synthetic-fraudulent-notice.json";
import unsafe from "../fixtures/v1/real-recall-unsafe-channel.json";
import official from "../fixtures/v1/verified-official-channel.json";

export const demoCases = [unsafe, official, fraudulent] as const;
export type DemoCase = (typeof demoCases)[number];

export function getDemoCase(slug: string): DemoCase | undefined {
  return demoCases.find((item) => item.caseSlug === slug);
}
