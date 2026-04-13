import { AdminGuard } from "@/components/admin-guard";

export default function AdminPage() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      <AdminGuard />
    </main>
  );
}
