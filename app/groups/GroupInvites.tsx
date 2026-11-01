"use client";

import { useActionState, useState } from "react";
import {
  createGroupInviteLink,
  inviteByEmail,
  type InviteEmailState,
} from "./actions";

const initialState: InviteEmailState = {};

export function GroupInvites({ baseUrl }: { baseUrl: string }) {
  const [state, action, pending] = useActionState(inviteByEmail, initialState);
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function makeLink() {
    setLinkError(null);
    try {
      setLink(await createGroupInviteLink());
    } catch (error) {
      console.error("Could not create group invitation link", error);
      setLinkError("Could not create an invitation link. Please try again.");
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch (error) {
      console.error("Could not copy group invitation link", error);
      setLinkError("Could not copy automatically. Select and copy the link.");
    }
  }

  return (
    <section className="group-invites">
      <h2>Invite people</h2>
      <p>They can join this group and create their own profile.</p>
      <form action={action} className="group-invite-email">
        <label htmlFor="invite-email">Invite by email</label>
        <div>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="friend@example.com"
            autoComplete="email"
          />
          <button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send invite"}
          </button>
        </div>
        {state.error && <p role="alert" className="group-error">{state.error}</p>}
        {state.success && <p role="status" className="group-success">{state.success}</p>}
      </form>

      <div className="group-invite-link">
        <div>
          <strong>Or share a link</strong>
          <p>Anyone with the link can join. Creating a new link invalidates the previous one.</p>
        </div>
        <button type="button" onClick={makeLink}>Create invite link</button>
        {link && (
          <div className="group-link-actions">
            <input aria-label="Group invite link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
            <button type="button" onClick={copyLink}>Copy</button>
          </div>
        )}
      </div>
      {linkError && <p role="alert" className="group-error">{linkError}</p>}
      <small>Invite links point to {baseUrl}.</small>
    </section>
  );
}
