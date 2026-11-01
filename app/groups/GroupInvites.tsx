"use client";

import { useState } from "react";
import { createGroupInviteLink } from "./actions";
import { groupInviteEmailUrl } from "@/lib/invitations";

export function GroupInvites({ groupName }: { groupName: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  async function makeLink() {
    setLinkError(null);
    setCreating(true);
    setCopied(false);
    try {
      setLink(await createGroupInviteLink());
    } catch (error) {
      console.error("Could not create group invitation link", error);
      setLinkError("Could not create an invitation link. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch (error) {
      console.error("Could not copy group invitation link", error);
      setLinkError("Could not copy automatically. Select and copy the link.");
    }
  }

  return (
    <section className="group-invites">
      <h2>Invite people</h2>
      <p>Share a link. They create a profile, join the group and can start contributing. No admin approval needed.</p>

      <div className="group-invite-link">
        <div>
          <strong>One link for your people</strong>
          <p>Anyone with the link can join for 30 days. Existing links still work when you create another.</p>
        </div>
        <button type="button" onClick={makeLink} disabled={creating}>
          {creating ? "Creating…" : "Create invite link"}
        </button>
        {link && (
          <div className="group-link-actions">
            <input aria-label="Group invite link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
            <button type="button" onClick={copyLink}>{copied ? "Copied!" : "Copy"}</button>
          </div>
        )}
      </div>
      {link && (
        <div className="group-invite-email">
          <label htmlFor="invite-email">Or email the link from your inbox</label>
          <div>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Recipient (optional)"
              autoComplete="off"
            />
            <a className="action-primary" href={groupInviteEmailUrl(groupName, link, email)}>
              Open email app
            </a>
          </div>
          <p>Opens a draft in your email app. Choose your account and send it yourself.</p>
        </div>
      )}
      {linkError && <p role="alert" className="group-error">{linkError}</p>}
    </section>
  );
}
