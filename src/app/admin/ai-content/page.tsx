import { getSetting } from "@/lib/db";
import AiContentClient from "./AiContentClient";

export default async function AiContentPage() {
  const affiliateId = await getSetting("affiliate_id", "");
  return <AiContentClient affiliateId={affiliateId} />;
}
