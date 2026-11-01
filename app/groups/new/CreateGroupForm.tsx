"use client";

import { createGroup } from "../actions";

export function CreateGroupForm({ memberName }: { memberName: string }) {
  return (
    <form action={createGroup} className="group-create-form">
      <label>
        Group name
        <input name="groupName" type="text" required maxLength={80} autoFocus />
      </label>
      <label>
        Your name in this group
        <input name="memberName" type="text" required maxLength={80} defaultValue={memberName} />
      </label>
      <label>
        Home currency
        <select name="homeCurrency" defaultValue="GBP">
          {["GBP", "EUR", "USD", "AUD", "CAD", "CHF", "JPY", "NZD"].map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="action-primary">Create group</button>
    </form>
  );
}
