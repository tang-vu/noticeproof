import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire approvals and retained notice content",
  { hours: 1 },
  internal.maintenance.expireApprovalsAndRawContent,
  {},
);

crons.interval(
  "sync active AgentMail deliveries",
  { minutes: 1 },
  internal.approvals.syncPendingOutbounds,
  {},
);

crons.interval(
  "recheck stale active recall evidence",
  { hours: 6 },
  internal.maintenance.scheduleEvidenceRechecks,
  {},
);

crons.interval(
  "remind cases awaiting verified-channel replies",
  { hours: 24 },
  internal.maintenance.scheduleFollowupReminders,
  {},
);

export default crons;
