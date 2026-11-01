"use client";

import { useState } from "react";
import {
  regenerateInviteToken,
  toggleAdmin,
  removeMember,
  approveDeviceRequest,
  rejectDeviceRequest,
} from "./actions";
import { MemberAvatar } from "@/components/MemberAvatar";

type MemberRow = {
  id: string;
  name: string;
  photoKey: string | null;
  isAdmin: boolean;
  isDependent: boolean;
  householdName: string | null;
};

type HouseholdRow = { id: string; name: string };

type PendingRequest = {
  id: string;
  member: { id: string; name: string; photoKey: string | null };
  createdAt: string;
};

type Props = {
  currentMemberId: string;
  family: { id: string; name: string };
  baseUrl: string;
  members: MemberRow[];
  households: HouseholdRow[];
  pendingRequests: PendingRequest[];
};

export default function AdminClient({
  currentMemberId,
  family,
  baseUrl,
  members,
  pendingRequests,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleRegenerate() {
    setRegenerating(true);
    setInviteError(null);
    try {
      const token = await regenerateInviteToken();
      setInviteUrl(`${baseUrl}/join/${token}`);
      setCopied(false);
    } catch (error) {
      console.error("Failed to generate family invite link", error);
      setInviteError("Could not generate an invite link. Please try again.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy(url: string) {
    setInviteError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy family invite link", error);
      setInviteError("Could not copy automatically. Select and copy the link above.");
    }
  }

  return (
    <div className="admin-page">
      <style>{`
        .admin-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1rem 4rem;
        }
        .admin-page h1 {
          font-family: var(--font-instrument);
          font-size: 2.5rem;
          color: var(--ink);
          margin-bottom: 0.25rem;
        }
        .admin-page .subtitle {
          color: var(--ink-soft);
          font-size: 0.9rem;
          margin-bottom: 2.5rem;
        }
        .section {
          margin-bottom: 3rem;
        }
        .section-heading {
          font-family: var(--font-dm-mono);
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--rule);
        }
        .invite-box {
          background: var(--paper-2);
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .invite-url {
          font-family: var(--font-dm-mono);
          font-size: 0.8rem;
          color: var(--ink-soft);
          word-break: break-all;
          line-height: 1.5;
        }
        .btn-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-family: var(--font-hanken-grotesk);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--rule);
          background: var(--paper);
          color: var(--ink);
          min-height: 44px;
          transition: background 0.15s;
        }
        .btn:hover { background: var(--paper-2); }
        .btn-primary {
          background: var(--sea);
          color: #fff;
          border-color: var(--sea);
        }
        .btn-primary:hover { background: var(--sea-deep); border-color: var(--sea-deep); }
        .btn-danger {
          color: var(--clay);
          border-color: transparent;
          background: transparent;
        }
        .btn-danger:hover { background: color-mix(in srgb, var(--clay) 8%, transparent); }
        .member-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .member-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 0;
          border-bottom: 1px solid var(--rule);
        }
        .member-row:first-child { border-top: 1px solid var(--rule); }
        .member-info { flex: 1; min-width: 0; }
        .member-name {
          font-weight: 500;
          color: var(--ink);
          font-size: 0.9375rem;
        }
        .member-meta {
          font-size: 0.8125rem;
          color: var(--ink-soft);
          margin-top: 0.125rem;
        }
        .member-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .badge {
          font-family: var(--font-dm-mono);
          font-size: 0.6875rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
          background: var(--paper-2);
          color: var(--ink-soft);
        }
        .badge-admin {
          background: color-mix(in srgb, var(--sea) 12%, transparent);
          color: var(--sea-deep);
        }
        .request-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 0;
          border-bottom: 1px solid var(--rule);
        }
        .request-row:first-child { border-top: 1px solid var(--rule); }
        .request-info { flex: 1; }
        .request-name { font-weight: 500; color: var(--ink); }
        .request-time { font-size: 0.8125rem; color: var(--ink-soft); }
        .empty-state {
          color: var(--ink-soft);
          font-size: 0.9rem;
          padding: 1.5rem 0;
        }
      `}</style>

      <h1>Family Admin</h1>
      <p className="subtitle">{family.name}</p>

      {/* Invite link */}
      <div className="section">
        <div className="section-heading">Invite Link</div>
        <div className="invite-box">
          {inviteUrl ? (
            <div className="invite-url">{inviteUrl}</div>
          ) : (
            <div className="invite-url" style={{ color: "var(--ink-soft)" }}>
              Regenerate to get a fresh invite link to share with new family members.
            </div>
          )}
          {inviteError && (
            <p role="alert" style={{ color: "var(--danger)" }}>{inviteError}</p>
          )}
          <p style={{ color: "var(--text-soft)", fontSize: "0.8125rem", margin: 0 }}>
            A new link replaces the previous invite. Copy it before leaving this page.
          </p>
          <div className="btn-row">
            {inviteUrl && (
              <button className="btn btn-primary" onClick={() => handleCopy(inviteUrl)}>
                {copied ? "Copied!" : "Copy link"}
              </button>
            )}
            <form action={handleRegenerate}>
              <button
                type="submit"
                className="btn"
                disabled={regenerating}
              >
                {regenerating ? "Regenerating…" : "Regenerate link"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Pending device requests */}
      {pendingRequests.length > 0 && (
        <div className="section">
          <div className="section-heading">Waiting for approval ({pendingRequests.length})</div>
          <div className="member-list">
            {pendingRequests.map((req) => (
              <div key={req.id} className="request-row">
                <MemberAvatar name={req.member.name} photoKey={req.member.photoKey} size={40} />
                <div className="request-info">
                  <div className="request-name">{req.member.name}</div>
                  <div className="request-time">
                    Requested {new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </div>
                </div>
                <div className="member-actions">
                  <form action={approveDeviceRequest.bind(null, req.id)}>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: "0.8125rem" }}>
                      Approve
                    </button>
                  </form>
                  <form action={rejectDeviceRequest.bind(null, req.id)}>
                    <button type="submit" className="btn btn-danger" style={{ fontSize: "0.8125rem" }}>
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="section">
        <div className="section-heading">Members ({members.length})</div>
        <div className="member-list">
          {members.map((m) => (
            <div key={m.id} className="member-row">
              <MemberAvatar name={m.name} photoKey={m.photoKey} size={40} />
              <div className="member-info">
                <div className="member-name">
                  {m.name}
                  {m.isDependent && <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}> (child)</span>}
                </div>
                {m.householdName && (
                  <div className="member-meta">{m.householdName}</div>
                )}
              </div>
              <div className="member-actions">
                {m.isAdmin && <span className="badge badge-admin">Admin</span>}
                {m.id !== currentMemberId && !m.isDependent && (
                  <form action={toggleAdmin.bind(null, m.id)}>
                    <button type="submit" className="btn" style={{ fontSize: "0.8125rem" }}>
                      {m.isAdmin ? "Remove admin" : "Make admin"}
                    </button>
                  </form>
                )}
                {m.id !== currentMemberId && (
                  <form
                    action={removeMember.bind(null, m.id)}
                    onSubmit={(e) => {
                      if (!confirm(`Remove ${m.name} from the family?`)) e.preventDefault();
                    }}
                  >
                    <button type="submit" className="btn btn-danger" style={{ fontSize: "0.8125rem" }}>
                      Remove
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="empty-state">No members yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
