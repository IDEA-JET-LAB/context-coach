import { ThemeSwitcher } from "@/components/theme-switcher";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1">
        {children}
      </div>
      <footer className="flex items-center justify-center border-t text-xs gap-8 py-8">
        <p>
          Powered by{" "}
          <a
            href="https://contextor.dev"
            className="font-bold hover:underline"
          >
            Contextor
          </a>
        </p>
        <ThemeSwitcher />
      </footer>
    </main>
  );
}
