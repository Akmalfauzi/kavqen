ALTER TABLE "AccessCode" ADD COLUMN "inviteEmail" TEXT, ADD COLUMN "inviteStatus" TEXT;
CREATE INDEX "AccessCode_inviteEmail_idx" ON "AccessCode"("inviteEmail");
