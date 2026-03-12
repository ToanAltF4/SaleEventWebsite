import { getSetting, getAdminShortLinks } from "@/lib/db";
import { SHORT_DOMAIN } from "@/lib/url-processing";
import ClickReportClient from "./ClickReportClient";

export default async function ClickReportPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const affiliateId = await getSetting("affiliate_id", "");
  const search = params.q || "";
  const dateFrom = params.from || "";
  const dateTo = params.to || "";
  const links = await getAdminShortLinks(search, dateFrom, dateTo);
  const totalClicks = links.reduce((sum, l) => sum + (l.click_count || 0), 0);

  // Serialize for client
  const serializedLinks = links.map(l => ({
    id: l.id as number,
    short_code: l.short_code as string,
    target_url: l.target_url as string,
    click_count: (l.click_count || 0) as number,
    created_at: l.created_at ? String(l.created_at) : "",
    created_by: (l.created_by || "") as string,
  }));

  return (
    <ClickReportClient
      affiliateId={affiliateId}
      links={serializedLinks}
      totalClicks={totalClicks}
      totalLinks={links.length}
      search={search}
      dateFrom={dateFrom}
      dateTo={dateTo}
      shortDomain={SHORT_DOMAIN}
    />
  );
}
