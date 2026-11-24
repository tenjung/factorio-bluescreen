import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  const remote =
    process.env.VERCEL_ENV === "preview" &&
    Boolean(
      process.env.FACTORIO_BRIDGE_URL && process.env.FACTORIO_BRIDGE_SECRET,
    );
  return (
    <Dashboard live={remote || process.env.FACTORIO_LOCAL_STATUS === "1"} />
  );
}
