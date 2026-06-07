import { runConflictCheck } from "@open-practice/domain";

export interface ConflictCheckRunInput {
  firmId: string;
  actorId: string;
  prospectiveName: string;
  aliases?: string[];
  identifiers?: Array<{ type: string; value: string }>;
  prospectiveRole?: "client" | "opposing_party" | "third_party";
  includeClosedMatters: boolean;
}

export type ConflictCheckRunResult = ReturnType<typeof runConflictCheck>;

export interface ConflictCheckRepository {
  runConflictCheck(input: ConflictCheckRunInput): Promise<{
    results: ConflictCheckRunResult;
    auditChainValid: boolean;
  }>;
}
