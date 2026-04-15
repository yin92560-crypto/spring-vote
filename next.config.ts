import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : "localhost";

function hostnameFromEnvUrl(key: string): string | null {
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname;
  } catch {
    return null;
  }
}

const r2Hosts = new Set<string>();
for (const key of [
  "R2_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_R2_PUBLIC_URL",
  "NEXT_PUBLIC_R2_PUBLIC_BASE_URL",
] as const) {
  const h = hostnameFromEnvUrl(key);
  if (h) r2Hosts.add(h);
}
r2Hosts.add("assets.huaqintp.top");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
      ...[...r2Hosts].map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/**",
      })),
    ],
  },
};

export default nextConfig;
