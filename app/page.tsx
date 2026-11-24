import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  const publicView = process.env.VERCEL_ENV === "production";
  const remote =
    (process.env.VERCEL_ENV === "preview" || publicView) &&
    Boolean(
      process.env.FACTORIO_BRIDGE_URL && process.env.FACTORIO_BRIDGE_SECRET,
    );
  return (
    <Dashboard
      live={publicView || remote || process.env.FACTORIO_LOCAL_STATUS === "1"}
      publicView={publicView}
      publicAddress={
        publicView
          ? process.env.FACTORIO_PUBLIC_CONNECT_ADDRESS?.trim()
          : undefined
      }
    />
  );
}
