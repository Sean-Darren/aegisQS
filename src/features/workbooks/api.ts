import { resources } from "@/lib/api";
export const workbooksApi = {
  workbooks: resources.workbooks,
  uploadWorkbook: resources.uploadWorkbook,
  workbook: resources.workbook,
  uploadWorkbookVersion: resources.uploadWorkbookVersion,
  updateMapping: resources.updateMapping,
  workbookVersion: resources.workbookVersion,
  checks: resources.checks,
  resolveCheck: resources.resolveCheck,
  items: resources.items,
  sheet: resources.sheet,
  diff: resources.diff,
  downloadWorkbook: resources.downloadWorkbook,
  boqItems: resources.boqItems,
};
