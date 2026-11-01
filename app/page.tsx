import Link from "next/link";
import { requireMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { member, family } = await requireMember();

  return (
    <div className="home-shell">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="home-badge">Your private family getaway space</span>
          <p className="home-greeting">Welcome back, {member.name}</p>
          <h1 id="home-title" className="font-display">
            Less organising.<br />
            <em>More together.</em>
          </h1>
          <p className="home-intro">
            {family.name}&apos;s next adventure starts here. Pick a place, bring
            everyone along, and leave the spreadsheet behind.
          </p>
          <div className="home-actions">
            <Link href="/trips/new" className="action-primary">Plan a trip <span aria-hidden="true">↗</span></Link>
            <Link href="/trips" className="action-secondary">Explore your trips</Link>
          </div>
          <p className="home-footnote">Big adventures. Little weekends. All your people.</p>
        </div>
        <div className="home-postcard">
          <svg viewBox="0 0 480 420" role="img" aria-label="An illustrated sunny coastline with hills and a little holiday house">
            <rect width="480" height="420" fill="#d9ece8" />
            <circle cx="350" cy="95" r="44" fill="#f5c768" />
            <path d="M0 160 Q100 60 230 180 T480 130 V420 H0Z" fill="#8eaf91" />
            <path d="M0 245 Q150 110 290 240 T480 205 V420 H0Z" fill="#466e60" />
            <path d="M0 320 Q190 220 480 290 V420 H0Z" fill="#237c89" />
            <path d="M0 375 Q220 270 480 340" fill="none" stroke="#9ad3cf" strokeWidth="3" />
            <path d="M0 400 Q250 300 480 370" fill="none" stroke="#9ad3cf" strokeWidth="3" />
            <path d="M55 310 Q180 295 235 200" fill="none" stroke="#ecd9b4" strokeWidth="18" />
            <rect x="203" y="179" width="63" height="51" rx="3" fill="#faf0dc" />
            <path d="M195 184 L234 150 L273 184Z" fill="#bc624d" />
            <rect x="227" y="204" width="15" height="26" rx="2" fill="#466e60" />
            <rect x="249" y="191" width="9" height="12" fill="#e8b65a" />
            <path d="M70 82 Q80 72 90 82 M95 82 Q105 72 115 82" fill="none" stroke="#466e60" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div className="postcard-caption">
            <span className="label-caps">The best part of any trip</span>
            <span className="font-display">Who you share it with.</span>
          </div>
        </div>
      </section>

      <section className="home-next" aria-labelledby="next-title">
        <div>
          <span className="label-caps">Make yourself at home</span>
          <h2 id="next-title" className="font-display">A little planning goes a long way.</h2>
        </div>
        <Link
          href={member.isAdmin ? "/admin" : "/me"}
          className="home-family-link"
        >
          {member.isAdmin ? "Manage family & invite people" : "Your profile & preferences"} <span aria-hidden="true">→</span>
        </Link>
      </section>

      <div className="home-card-grid">
        <Link href="/map" className="home-feature card-hover">
          <span className="home-feature-icon" aria-hidden="true">◎</span>
          <span className="label-caps">Find your somewhere</span>
          <h3 className="font-display">A world of possibilities</h3>
          <p>See your family&apos;s trips on the map and find your next escape.</p>
          <span className="home-card-cta">Open the map <span aria-hidden="true">→</span></span>
        </Link>
        <Link href="/calendar" className="home-feature card-hover">
          <span className="home-feature-icon" aria-hidden="true">▦</span>
          <span className="label-caps">Save the date</span>
          <h3 className="font-display">Get everyone together</h3>
          <p>Keep family plans in view and make room for time together.</p>
          <span className="home-card-cta">View calendar <span aria-hidden="true">→</span></span>
        </Link>
        <Link href="/me" className="home-feature card-hover">
          <span className="home-feature-icon" aria-hidden="true">◇</span>
          <span className="label-caps">Keep it simple</span>
          <h3 className="font-display">Your share, made clear</h3>
          <p>Find your commitments, contributions, and personal preferences.</p>
          <span className="home-card-cta">Go to your profile <span aria-hidden="true">→</span></span>
        </Link>
      </div>
    </div>
  );
}
