import { notFound } from "next/navigation";
import DashboardPage from "../page";

export const dynamic = "force-dynamic";

const sections = new Set(["chat", "players", "saves", "logs", "settings"]);

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  return <DashboardPage />;
}
