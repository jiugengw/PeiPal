import type { SupportType } from "@/features/family/api/supportQueries";

export const supportTypeLabels: Record<SupportType, string> = {
  join: "Go together",
  remind: "Send a reminder",
  transport: "Help with transport",
  alternative: "Suggest another option",
  booking: "Help with booking",
  encourage: "Send encouragement",
};

export const supportTypes = Object.keys(supportTypeLabels) as SupportType[];
