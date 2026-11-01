export function groupInviteEmailUrl(groupName: string, inviteUrl: string, email = "") {
  const subject = encodeURIComponent(`Join ${groupName}`);
  const body = encodeURIComponent(
    `Come join ${groupName}!\n\nCreate your profile and help plan our trips:\n${inviteUrl}\n\nThis link is valid for 30 days.`,
  );
  return `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`;
}
