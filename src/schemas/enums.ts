import { z } from "zod";
export const roleSchema = z.enum([
  "senior_qs",
  "junior_qs",
  "owner_viewer",
  "admin",
]);
export const projectStageSchema = z.enum([
  "pre_tender",
  "tender",
  "post_award",
]);
export const severitySchema = z.enum(["critical", "high", "medium", "low"]);
export const riskBandSchema = z.enum(["low", "moderate", "high", "critical"]);
export const auditorKindSchema = z.enum([
  "scope_completeness",
  "rate_variation",
  "provisional_sum",
  "reference_resolver",
]);
export const signalKeySchema = z.enum([
  "rate_anomalies",
  "provisional_sum_concentration",
  "qs_benchmark_variance",
  "scope_ambiguity",
  "unresolved_clarifications",
  "tender_qualifications",
  "news_sentiment_12m",
]);
export const documentTypeSchema = z.enum([
  "draft_boq",
  "priced_boq",
  "inspection_report",
  "tender_qualification",
  "clarification_log",
  "site_photo",
  "vo_claim",
  "payment_claim",
]);
export const flagStatusSchema = z.enum([
  "open",
  "proposed",
  "accepted",
  "dismissed",
  "escalated",
]);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export type Role = z.infer<typeof roleSchema>;
export type ProjectStage = z.infer<typeof projectStageSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type RiskBand = z.infer<typeof riskBandSchema>;
export type AuditorKind = z.infer<typeof auditorKindSchema>;
export type SignalKey = z.infer<typeof signalKeySchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
