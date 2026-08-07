import { createActivityTools } from "./activityTools";
import { createCommitTools } from "./commitTools";
import { createNavigationTools } from "./navigationTools";
import { createStagingTools } from "./stagingTools";
import type { CompanionToolContext } from "./toolContext";

export type { CompanionToolContext } from "./toolContext";

export function createCompanionTools(context: CompanionToolContext) {
  return [
    ...createNavigationTools(context),
    ...createActivityTools(context),
    ...createStagingTools(context),
    ...createCommitTools(context),
  ];
}
