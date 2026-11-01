import type { Metadata } from "next";
import { Instrument_Serif, Hanken_Grotesk, DM_Mono } from "next/font/google";
import Link from "next/link";
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
      </body>
    </html>
  );
}

function SiteNav() {
  return (
    <nav
      aria-label="Site navigation"
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 var(--space-6)",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-8)",
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: "var(--text-xl)",
            fontStyle: "italic",
            color: "var(--ink)",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          Family Trips
        </Link>

        {/* Nav placeholder — populated in M1 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-6)",
          }}
        >
          <NavLink href="/trips">Trips</NavLink>
          <NavLink href="/map">Map</NavLink>
          <NavLink href="/calendar">Calendar</NavLink>
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
    <Link
      href={href}
      style={{
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        color: "var(--text-soft)",
        textDecoration: "none",
        transition: "color var(--duration-fast) var(--ease-out)",
      }}
    >
      {children}
    </Link>
  );
}
