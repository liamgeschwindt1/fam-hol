CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupInvitation" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "email" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TripParticipant" (
    "tripId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "AttendStatus" NOT NULL DEFAULT 'MAYBE',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TripParticipant_pkey" PRIMARY KEY ("tripId", "memberId")
);

ALTER TABLE "Member" ADD COLUMN "userAccountId" TEXT;
ALTER TABLE "Trip" ALTER COLUMN "startDate" DROP NOT NULL;
ALTER TABLE "Trip" ALTER COLUMN "endDate" DROP NOT NULL;

CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");
CREATE UNIQUE INDEX "GroupInvitation_tokenHash_key" ON "GroupInvitation"("tokenHash");
CREATE INDEX "GroupInvitation_familyId_email_idx" ON "GroupInvitation"("familyId", "email");
CREATE INDEX "Member_userAccountId_idx" ON "Member"("userAccountId");
CREATE INDEX "TripParticipant_memberId_idx" ON "TripParticipant"("memberId");
CREATE INDEX "TripParticipant_invitedById_idx" ON "TripParticipant"("invitedById");

ALTER TABLE "Member" ADD CONSTRAINT "Member_userAccountId_fkey"
    FOREIGN KEY ("userAccountId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripParticipant" ADD CONSTRAINT "TripParticipant_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripParticipant" ADD CONSTRAINT "TripParticipant_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripParticipant" ADD CONSTRAINT "TripParticipant_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
