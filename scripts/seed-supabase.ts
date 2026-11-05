import { createSupabaseAdminClient } from "../src/lib/supabase/admin.ts";
import * as f from "../src/mocks/fixtures/data.ts";
import { users } from "../src/mocks/fixtures/users.ts";
import {
  encodeState,
  emptyState,
  type RecordRow,
} from "../src/lib/backend/records.ts";
import { FILE_BUCKET, loadSnapshot } from "../src/lib/backend/repository.ts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const db = createSupabaseAdminClient();
async function main() {
  const snapshot = await loadSnapshot(db);
  if (snapshot.records.some((r) => r.table === "projects"))
    throw new Error(
      "Database already contains project data. Seed refuses to overwrite it.",
    );
  const email = process.env.SMART_QS_BOOTSTRAP_EMAIL,
    password = process.env.SMART_QS_BOOTSTRAP_PASSWORD;
  if (!email || !password)
    throw new Error(
      "Set SMART_QS_BOOTSTRAP_EMAIL and SMART_QS_BOOTSTRAP_PASSWORD in .env.local.",
    );
  let authId: string | undefined;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw new Error("Could not inspect the bootstrap account.");
    authId = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )?.id;
    if (authId || data.users.length < 100) break;
  }
  if (!authId) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error(
        "Could not create the bootstrap account. Check Supabase Auth settings and password policy.",
      );
    authId = data.user.id;
  }
  // Never change an existing user's password. Role is server-managed profile data.
  for (const [index, user] of users.entries()) {
    const { error } = await db.from("user_profiles").upsert(
      {
        id: user.id,
        auth_user_id: index === 0 ? authId : null,
        data: index === 0 ? { ...user, email } : user,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error("Could not create Smart QS profiles.");
  }
  const state = emptyState();
  Object.assign(state, {
    projects: [f.project],
    documents: f.documents,
    versions: f.versions,
    conflicts: f.conflicts,
    comparisons: f.comparisons,
    changes: f.changes,
    variations: f.variations,
    workbooks: f.workbooks,
    workbookVersions: f.workbookVersions,
    checks: f.checks,
    items: f.boqItems,
    materials: f.materials,
    forecasts: f.forecasts,
    procurement: f.procurement,
    materialNeeds: f.materialNeeds,
    links: f.links,
    auditEvents: f.auditEvents,
    parsed: {
      "WV-1": f.parsedWorkbooks["boq-v1"],
      "WV-2": f.parsedWorkbooks["boq-v2"],
    },
  });
  const objects: RecordRow[] = [];
  const paths = {
    ...f.filePaths,
    "WV-1": "/mock-files/workbooks/boq-v1.xlsx",
    "WV-2": "/mock-files/workbooks/boq-v2.xlsx",
  };
  for (const [id, path] of Object.entries(paths)) {
    const local = resolve(
      "public/mock-files",
      path.replace(/^\/(?:mock-files\/)?/, ""),
    );
    const bytes = await readFile(local);
    const objectPath = `P-001/seed/${id}`;
    const { error } = await db.storage
      .from(FILE_BUCKET)
      .upload(objectPath, bytes, {
        upsert: true,
        contentType: path.endsWith(".pdf")
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    if (error)
      throw new Error("Could not migrate sample files to private storage.");
    objects.push({
      table: "file_objects",
      id,
      projectId: "P-001",
      data: { path: objectPath },
    });
  }
  const { error } = await db.rpc("smart_qs_commit", {
    expected_revision: snapshot.revision,
    changes: [...encodeState(state), ...objects],
  });
  if (error)
    throw new Error(
      "Could not commit seed records. No project records were partially committed; retry after checking the migration.",
    );
  console.log(
    `Seeded P-001, ${state.documents.length} documents, ${state.items.length} BOQ items, all feature fixtures and ${objects.length} private file references.`,
  );
  console.log(
    "Sign in using SMART_QS_BOOTSTRAP_EMAIL and the password you configured. Existing account passwords are unchanged.",
  );
  console.log(
    "Forecasts and drawing detections in these seeded records are synthetic demo data.",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});
