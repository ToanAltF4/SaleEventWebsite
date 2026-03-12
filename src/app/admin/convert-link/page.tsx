import { getSetting } from "@/lib/db";
import ConvertLinkClient from "./ConvertLinkClient";

export default async function ConvertLinkPage() {
  const affiliateId = await getSetting("affiliate_id", "");
  return <ConvertLinkClient affiliateId={affiliateId} />;
}
