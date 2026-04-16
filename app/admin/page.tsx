import { AdminGuard } from "@/components/admin-guard";

export default function AdminPage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full flex-1 flex-col">
      <AdminGuard />
    </main>
  );
}
