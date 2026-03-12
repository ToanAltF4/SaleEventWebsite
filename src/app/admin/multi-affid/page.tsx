import { getAllMultiAffids, getMultiAffidLinks, getMultiAffidTotalClicks } from "@/lib/db";
import { SHORT_DOMAIN } from "@/lib/url-processing";
import MultiAffidClient from "./MultiAffidClient";

export default async function MultiAffidPage({ searchParams }: { searchParams: Promise<{ page?: string; active?: string }> }) {
  const params = await searchParams;
  const affids = await getAllMultiAffids();
  const pageNum = parseInt(params.page || "1");
  const activeAffid = params.active || "";

  const affidData = [];
  for (const a of affids) {
    const isActive = activeAffid && String(a.id) === activeAffid;
    const currentPage = isActive ? pageNum : 1;
    const { links, total } = await getMultiAffidLinks(a.id, currentPage, 10);
    const totalClicks = await getMultiAffidTotalClicks(a.id);
    const totalPages = total > 0 ? Math.ceil(total / 10) : 1;

    affidData.push({
      id: a.id as number,
      affid: a.affid as string,
      name: (a.name || "") as string,
      created_at: String(a.created_at),
      links: links.map(l => ({
        id: l.id as number,
        short_code: l.short_code as string,
        target_url: l.target_url as string,
        click_count: (l.click_count || 0) as number,
        created_at: String(l.created_at),
      })),
      total_links: total,
      total_clicks: totalClicks,
      current_page: currentPage,
      total_pages: totalPages,
    });
  }

  return <MultiAffidClient affidData={affidData} shortDomain={SHORT_DOMAIN} />;
}
