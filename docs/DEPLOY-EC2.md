# EC2 hackathon deployment

Deployment prepared 5 November 2026. No database migration or seed is run by deployment.

## Services and URLs

Ubuntu x86_64 EC2 instance `smartqs-demo`, Singapore, t3.small. Temporary public IP: `13.212.119.93`.

- Website: https://smartqs.13-212-119-93.sslip.io/en/login
- Excel task pane: https://excel.13-212-119-93.sslip.io
- Production Office manifest: https://excel.13-212-119-93.sslip.io/manifest.xml (source: `deploy/ec2/manifest.xml`). Upload this instead of the localhost manifest when sideloading Excel on the web.
- Supabase remains the database, Auth and private Storage service. Existing application accounts remain valid.

Caddy terminates HTTPS and streams events without buffering. Node listens on loopback ports 3000 and 3200. Only ports 80/443 are public; SSH 22 is restricted to the operator's IP. Caddy obtains and renews certificates automatically while these hostnames resolve to the instance and ports 80/443 remain reachable.

These are temporary third-party wildcard DNS names. They encode the IP and need no domain registration. An auto-assigned EC2 public IP can change after stop/start. If it changes, update both hostnames in the Caddyfile, manifest and private environment files, then restart/reload services. Use your own domain and a stable IP for a longer-lived deployment.

## Files and runtime

- `/srv/smartqs/releases/20261105-demo2`: source, Linux-installed dependencies and production builds.
- `/srv/smartqs/current`: symlink to the active release.
- `/srv/smartqs/shared/app.env`: owner-only main application configuration.
- `/srv/smartqs/shared/addin.env`: owner-only add-in configuration; no Supabase secret key.
- `smartqs-web`, `smartqs-excel`, `smartqs-worker`: systemd services under the non-root `ubuntu` account, enabled on boot, restarted on failure.
- `caddy`: HTTPS reverse proxy systemd service.

Use npm 10.9.9, matching the development environment. The root `.npmrc` records `legacy-peer-deps=true`, which was used to create the existing lockfile; clean installs must use the same resolution mode. No dependencies were changed for deployment.

Node 22.15+ is required by the existing worker TypeScript loader. Keep dev dependencies installed: the worker imports TypeScript at runtime. Never copy macOS `node_modules` to Linux or blindly prune dev dependencies.

A 4 GiB swap file supports builds on the 2 GiB instance. Swap is slower than RAM. Builds run sequentially with a bounded Node heap; this is for the small hackathon environment. CI producing Linux release artifacts is preferable for repeat deployments. Model inference is not included on this small instance.

## Private configuration

Main environment (copy values privately, never commit them):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_KEY
NEXT_PUBLIC_API_MOCKING=disabled
# Keep demo (synthetic) processing OFF in production: with it enabled and
# the BIM worker unreachable, comparisons are fabricated from known pairs.
SMART_QS_DEMO_PROCESSING=disabled
SMART_QS_PUBLIC_ORIGIN=https://smartqs.13-212-119-93.sslip.io
# Run the FastAPI BIM worker on the EC2 instance (or another host):
AEGISQS_BIM_WORKER_URL=http://127.0.0.1:8000
```

Add-in environment:

```env
ADDIN_API_MOCKING=disabled
SMART_QS_API_ORIGIN=https://smartqs.13-212-119-93.sslip.io
SMART_QS_ADDIN_PUBLIC_ORIGIN=https://excel.13-212-119-93.sslip.io
```

`SMART_QS_ADDIN_PUBLIC_ORIGIN` fixes HTTPS origin validation behind a TLS-terminating proxy. Do not trust arbitrary forwarded origin headers. Both configured origins must match exactly, without trailing slashes.

Builds read the corresponding private files through owner-only `.env.local` symlinks in each release. Do not include bootstrap passwords or SSH keys. Public environment settings are baked into Next's client bundle, so changes to public settings require rebuilding.

## Build and activate

Upload source into a new release folder. Exclude `.git`, `.env*`, `node_modules`, `.next*`, certificates, PEM keys, test artifacts and Python caches. Do not overwrite the active release while building.

On the server, from the new release:

```bash
ln -s /srv/smartqs/shared/app.env .env.local
ln -s /srv/smartqs/shared/addin.env addin/.env.local
npm ci --no-audit --no-fund
NODE_OPTIONS=--max-old-space-size=1400 npm run build
NODE_OPTIONS=--max-old-space-size=1400 npm run build --workspace smart-qs-excel-addin
bash deploy/ec2/activate.sh "$PWD"
```

The activation script validates both builds and Caddy configuration before switching releases. A brief service stop prevents mixing assets across releases. To roll back, run `activate.sh` with the previous release directory; no database state is reset. Retain previous builds until the new one passes verification.

## Operations and verification

Connect from your Mac using the PEM file you downloaded (keep it private):

```bash
ssh -i /path/to/smartqs-ec2.pem ubuntu@13.212.119.93
```

Then inspect the running services:

```bash
sudo systemctl status smartqs-web smartqs-excel smartqs-worker caddy
sudo journalctl -u smartqs-web -n 50 --no-pager
sudo journalctl -u smartqs-worker -n 50 --no-pager
sudo journalctl -u caddy -n 50 --no-pager
free -h
df -h /
```

Verify HTTPS login in both locales, authenticated project/module reads, anonymous denial, a labelled persistent upload/download and its audit entry, worker health, and event-stream headers. Run repository checks before deployment: typecheck, lint, unit tests and both production builds. Manual Excel acceptance: sideload the production manifest, sign in, select the correct project/workbook/version, inspect checks, click a check to select its cited cell. Excel on the web uses the explicit download-a-copy/upload fallback; the add-in does not edit cells.

## Small-instance database access

The server reuses its server-only Supabase admin client, coalesces snapshot RPCs already in progress on that client, and returns `/me` from the authenticated profile without loading project data. Every request still authenticates and checks permissions. Snapshots have no TTL cache, and successful writes invalidate pending reads for subsequent callers; each request decodes separate mutable state. This reduces duplicate full-dataset RPCs launched in parallel by project pages. The worker now checks only pending comparison/workbook IDs when idle, loading a full snapshot only for pending jobs. The original full-snapshot idle polling caused Supabase statement timeouts during page loads; the lightweight queue check removed that contention in live browser acceptance. Mutations still use revision/CAS protection.

## Model limitation

Persistent workbook parsing/checking uses real uploaded files. Drawing comparison is still the explicitly configured known-pair demo processor (`mock-drawing-1.0`). The newly added Python BIM service references pipeline files outside this repository; those files and the trained model integration are not present. Deployment does not pretend to enable real model inference. Connect the complete authenticated model service separately before presenting its outputs as model results.

## Cost controls

This setup adds no load balancer, NAT gateway, RDS database or GPU instance. Instance runtime, EBS, public IPv4 and any CPU burst/traffic charges still apply. Monitor AWS Billing and set a budget. Stopping EC2 stops compute charges but retains billable disks; retained Elastic IPs are also charged. Never remove application data to reset a demo.

## Verification on 5 November 2026

- TypeScript, ESLint and 126 unit tests passed locally.
- Both production applications built on the Linux EC2 host; the website was rebuilt after the API read optimization.
- Public HTTPS browser login, all module reads, anonymous denial, and a labelled persistent document upload/private download passed.
- Twelve deployed browser pages passed, including zh-HK, workbook detail, forecast canvas and drawing PDF comparison; the event stream returned 200 with no uncaught browser errors.
- The restored worker completed a persisted A-201 B→C comparison through queued/aligning/detecting/succeeded with four known demo changes. Its comparison and audit history were retained.
- Add-in HTTPS login, httpOnly/Secure/SameSite=None cookies, project/workbook/check reads, foreign-origin rejection and the downloadable production manifest passed. Actual Office-host cell selection/sideload remains a manual check.
- One labelled verification document was retained. No database reset, seed or migration was performed. No commits were created.
