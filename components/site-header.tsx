import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link
          href="/it"
          className="font-bold tabular-nums tracking-tight"
        >
          Energy Index
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
