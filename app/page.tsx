import { HomePageClient } from "@/components/home-page-client";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        aria-hidden
        style={{
          backgroundImage: `radial-gradient(circle at 18% 28%, rgba(255, 192, 203, 0.26) 0%, transparent 46%),
            radial-gradient(circle at 82% 18%, rgba(167, 243, 208, 0.22) 0%, transparent 42%),
            radial-gradient(circle at 52% 88%, rgba(251, 207, 232, 0.18) 0%, transparent 52%)`,
        }}
      />
      <HomePageClient />
    </main>
  );
}
