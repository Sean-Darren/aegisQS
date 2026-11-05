import type * as s from "@/schemas";
import type { ParsedWorkbook } from "./workbook-engine";
export interface DomainState {
  projects: s.Project[];
  documents: s.HubDocument[];
  versions: s.DocumentVersion[];
  conflicts: s.VersionConflict[];
  comparisons: s.DrawingComparison[];
  changes: s.DrawingChange[];
  variations: s.VariationEvent[];
  workbooks: s.Workbook[];
  workbookVersions: s.WorkbookVersion[];
  checks: s.WorkbookCheck[];
  items: s.BoqItem[];
  materials: s.Material[];
  forecasts: s.PriceForecast[];
  procurement: s.ProcurementAdvice[];
  materialNeeds: s.ProjectMaterialNeed[];
  links: s.EntityLink[];
  auditEvents: s.AuditEvent[];
  parsed: Record<string, ParsedWorkbook>;
  filePaths: Record<string, string>;
}
export interface DomainContext {
  state: DomainState;
  currentUser: () => s.User;
  nextId: (prefix: string) => string;
  now: () => string;
  audit: (
    action: string,
    entityType: s.AuditEvent["entityType"],
    entityId: string,
    summary: string,
    details?: Record<string, unknown>,
    user?: s.User,
  ) => void;
  uploadedFiles: Map<string, ArrayBuffer>;
  emit: (projectId: string, event: s.WsEvent) => void;
  schedule: (callback: () => void, ms: number) => void;
  startComparison: (
    projectId: string,
    documentId: string,
    base: string,
    target: string,
  ) => s.DrawingComparison;
}
