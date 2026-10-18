import { Sidebar } from "@/components/ui/Sidebar";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <PrivacyProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-0 lg:ml-64 min-h-screen pt-14 lg:pt-0">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </PrivacyProvider>
  );
}
