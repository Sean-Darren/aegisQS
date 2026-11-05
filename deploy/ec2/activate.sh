#!/usr/bin/env bash
# Run on EC2 only, after successful builds in the release directory.
set -euo pipefail
release=$(realpath "${1:?Usage: activate.sh /srv/smartqs/releases/RELEASE}")
[[ "$release" == /srv/smartqs/releases/* ]]
[[ -f "$release/.next/BUILD_ID" && -f "$release/addin/.next/BUILD_ID" ]]
install -m 644 "$release/deploy/ec2/manifest.xml" "$release/addin/public/manifest.xml"
for service in smartqs-web smartqs-excel smartqs-worker; do
  sudo install -m 644 "$release/deploy/ec2/$service.service" "/etc/systemd/system/$service.service"
done
sudo caddy validate --config "$release/deploy/ec2/Caddyfile" --adapter caddyfile
# Brief downtime prevents a running process reading a mixture of release assets.
sudo systemctl stop smartqs-web smartqs-excel smartqs-worker || true
ln -sfn "$release" /srv/smartqs/current
sudo install -m 644 "$release/deploy/ec2/Caddyfile" /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now smartqs-web smartqs-excel smartqs-worker caddy
sudo systemctl reload caddy
