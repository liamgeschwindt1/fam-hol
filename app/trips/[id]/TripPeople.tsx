"use client";

import { inviteTripMembers, respondToTripInvitation } from "./actions";

type TripPeopleProps = {
  tripId: string;
  currentMemberId: string;
  participants: {
    memberId: string;
    name: string;
    status: "IN" | "MAYBE" | "OUT";
  }[];
  inviteableMembers: { id: string; name: string }[];
};

const statusLabels = { IN: "Going", MAYBE: "Maybe", OUT: "Can't go" };

export function TripPeople({
  tripId,
  currentMemberId,
  participants,
  inviteableMembers,
}: TripPeopleProps) {
  const currentParticipant = participants.find(
    (participant) => participant.memberId === currentMemberId,
  );

  return (
    <section className="trip-people" aria-labelledby="trip-people-title">
      <div className="trip-people-heading">
        <div>
          <p className="label-caps">The crew</p>
          <h2 id="trip-people-title">Who&apos;s coming?</h2>
        </div>
        {currentParticipant && (
          <form action={respondToTripInvitation} className="trip-rsvp">
            <input type="hidden" name="tripId" value={tripId} />
            <label htmlFor="trip-rsvp">Your RSVP</label>
            <select
              id="trip-rsvp"
              name="status"
              defaultValue={currentParticipant.status}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              <option value="IN">Going</option>
              <option value="MAYBE">Maybe</option>
              <option value="OUT">Can&apos;t go</option>
            </select>
          </form>
        )}
      </div>

      <ul className="trip-people-list">
        {participants.map((participant) => (
          <li key={participant.memberId}>
            <span>{participant.name}</span>
            <span className={`trip-rsvp-status is-${participant.status.toLowerCase()}`}>
              {statusLabels[participant.status]}
            </span>
          </li>
        ))}
        {participants.length === 0 && <li>No one has been invited yet.</li>}
      </ul>

      {inviteableMembers.length > 0 && (
        <details className="trip-invite-details">
          <summary>Invite people from your group</summary>
          <form action={inviteTripMembers}>
            <input type="hidden" name="tripId" value={tripId} />
            <fieldset>
              <legend>Select group members</legend>
              {inviteableMembers.map((invitee) => (
                <label key={invitee.id}>
                  <input type="checkbox" name="memberId" value={invitee.id} />
                  {invitee.name}
                </label>
              ))}
            </fieldset>
            <button type="submit">Invite selected people</button>
          </form>
        </details>
      )}
    </section>
  );
}
