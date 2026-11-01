import type { Metadata } from "next";
import { Instrument_Serif, Hanken_Grotesk, DM_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Family Trips",
    template: "%s — Family Trips",
  },
  description: "Plan trips together.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${hankenGrotesk.variable} ${dmMono.variable}`}
    >
      <body>
        <SiteNav />
        <main>{children}</main>
        <div
          id="live-region"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
      </body>
    </html>
  );
}

function SiteNav() {
  return (
    <nav aria-label="Site navigation" className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="site-brand">
          <span className="site-brand-mark" aria-hidden="true">
            f
          </span>
          Family Trips
        </Link>

        <div className="site-nav-links">
          <NavLink href="/trips">Trips</NavLink>
          <NavLink href="/map">Map</NavLink>
          <NavLink href="/calendar">Calendar</NavLink>
          <NavLink href="/inbox">Inbox</NavLink>
          <NavLink href="/me">Me</NavLink>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="site-nav-link">
      {children}
    </Link>
  );
}
