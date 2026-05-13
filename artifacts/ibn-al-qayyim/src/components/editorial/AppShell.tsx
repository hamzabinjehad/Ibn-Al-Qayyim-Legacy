import TopNav from "./TopNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <TopNav />
      {children}
    </div>
  );
}
