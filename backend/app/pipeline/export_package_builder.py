from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class ExportPackageBuilder:
    """Build and serialise a structured export package with integrity hash."""

    @staticmethod
    def build_export_package(
        project_id: str,
        assessment: dict[str, Any],
        boq: dict[str, Any] | None,
        estimate: dict[str, Any] | None,
        decisions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Assemble a self-contained export package.

        Parameters
        ----------
        project_id:
            Project identifier.
        assessment:
            Assessment report dict (from :class:`ReadinessEngine`).
        boq:
            Optional BOQ dict (from :class:`BOQGenerator`).
        estimate:
            Optional estimate dict (from :class:`EstimateGenerator`).
        decisions:
            List of decision dicts (from :class:`DecisionLog`).

        Returns
        -------
        dict
            The complete export package with ``package_hash``.
        """
        generated_at = datetime.now(timezone.utc).isoformat()

        # Extract from decisions
        exclusions = [
            {
                "decision_id": d.get("decision_id"),
                "reason": d.get("reason"),
                "timestamp": d.get("timestamp"),
                "actor": d.get("actor"),
                "affected_scope": d.get("affected_scope"),
            }
            for d in decisions
            if d.get("decision_type") == "SCOPE_EXCLUDED"
        ]

        risk_acceptances = [
            {
                "decision_id": d.get("decision_id"),
                "reason": d.get("reason"),
                "timestamp": d.get("timestamp"),
                "actor": d.get("actor"),
                "affected_scope": d.get("affected_scope"),
            }
            for d in decisions
            if d.get("decision_type") == "RISK_ACCEPTED"
        ]

        decision_log = [
            {
                "decision_id": d.get("decision_id"),
                "decision_type": d.get("decision_type"),
                "actor": d.get("actor"),
                "reason": d.get("reason"),
                "timestamp": d.get("timestamp"),
            }
            for d in decisions
        ]

        # Optional IFC / material-classification context, preserved when the
        # assessment originated from an IFC file.
        assessment_metadata = assessment.get("metadata", {}) or {}

        # Package body (everything except the hash)
        package: dict[str, Any] = {
            "project_id": project_id,
            "generated_at": generated_at,
            "assessment": deepcopy(assessment),
            "boq": deepcopy(boq) if boq is not None else None,
            "estimate": deepcopy(estimate) if estimate is not None else None,
            "decision_log": decision_log,
            "exclusions": exclusions,
            "risk_acceptances": risk_acceptances,
            "ifc_metadata": assessment_metadata.get("ifc_metadata"),
            "file_type": assessment_metadata.get("file_type"),
            "schema_version": assessment_metadata.get("schema_version"),
            "material_family_summary": assessment.get(
                "material_family_summary", {}
            ),
        }

        # Compute hash over the deterministic JSON of the body
        body_str = json.dumps(package, sort_keys=True, ensure_ascii=False, default=str)
        package_hash = hashlib.sha256(body_str.encode("utf-8")).hexdigest()

        package["package_hash"] = package_hash
        return package

    @staticmethod
    def export_to_json(package: dict[str, Any], output_path: str) -> None:
        """Write *package* to *output_path* as pretty-printed JSON.

        Creates parent directories if they do not exist.
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with path.open("w", encoding="utf-8") as fh:
            json.dump(package, fh, indent=2, ensure_ascii=False, default=str)
