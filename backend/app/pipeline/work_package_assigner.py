from __future__ import annotations

import re
from typing import Any

# Matches:  field  operator  value
# operator is one of:  ==  !=  in  not in
# value is a double-quoted string, single-quoted string, or a JSON array of strings
_COND_RE = re.compile(
    r"""(?P<field>\w+)\s*
        (?P<op>not\s+in|in|!=|==)\s*
        (?P<value>
            "(?:[^"\\]|\\.)*"|
            '(?:[^'\\]|\\.)*'|
            \[[^\]]*\]
        )""",
    re.VERBOSE,
)


class WorkPackageAssigner:
    """Assign BIM elements to work packages based on declarative rules."""

    @staticmethod
    def assign_work_packages(
        elements: list[dict[str, Any]],
        work_package_rules: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Evaluate rules in order and assign each element to the first matching WP.

        Parameters
        ----------
        elements:
            Element dicts; each must have an ``"id"`` key.
        work_package_rules:
            List of rule dicts with ``"id"``, ``"name"``, and
            ``"conditions"`` (list of condition strings).

        Returns
        -------
        dict
            ``{"assignments": {element_id: wp_id},
            "work_package_summaries": [...],
            "unassigned_elements": [...]}``
        """
        assignments: dict[str, str] = {}
        wp_buckets: dict[str, list[str]] = {wp["id"]: [] for wp in work_package_rules}
        unassigned: list[str] = []

        # Pre-parse conditions for each rule
        parsed_rules: list[tuple[str, str, list[_ParsedCondition]]] = []
        for wp in work_package_rules:
            parsed: list[_ParsedCondition] = []
            for cond_str in wp.get("conditions", []):
                pc = _parse_condition(cond_str)
                if pc:
                    parsed.append(pc)
            parsed_rules.append((wp["id"], wp["name"], parsed))

        # Assign each element
        for el in elements:
            el_id = el.get("id", "")
            matched = False

            for wp_id, _wp_name, conditions in parsed_rules:
                if not conditions:
                    continue
                if all(_evaluate(c, el) for c in conditions):
                    assignments[el_id] = wp_id
                    wp_buckets[wp_id].append(el_id)
                    matched = True
                    break  # first-match wins

            if not matched:
                unassigned.append(el_id)

        # Build summaries
        wp_name_lookup = {wp["id"]: wp["name"] for wp in work_package_rules}
        summaries: list[dict[str, Any]] = []
        for wp_id, el_ids in wp_buckets.items():
            summaries.append(
                {
                    "wp_id": wp_id,
                    "name": wp_name_lookup.get(wp_id, wp_id),
                    "element_count": len(el_ids),
                    "element_ids": el_ids,
                }
            )

        return {
            "assignments": assignments,
            "work_package_summaries": summaries,
            "unassigned_elements": unassigned,
        }


# ------------------------------------------------------------------
# condition parsing & evaluation
# ------------------------------------------------------------------


class _ParsedCondition:
    __slots__ = ("field", "op", "value")

    def __init__(self, field: str, op: str, value: Any) -> None:
        self.field = field
        self.op = op
        self.value = value


def _parse_condition(cond_str: str) -> _ParsedCondition | None:
    m = _COND_RE.search(cond_str)
    if not m:
        return None

    field = m.group("field")
    op = m.group("op").replace(" ", "")  # "not in" → "notin"
    raw_value = m.group("value").strip()

    # Parse value: string literal or JSON array
    if raw_value.startswith("["):
        # Simple JSON array — use eval for safety (only literals)
        from ast import literal_eval
        try:
            value = literal_eval(raw_value)
        except (ValueError, SyntaxError):
            value = raw_value
    else:
        # String literal — strip quotes
        value = raw_value[1:-1]  # remove outer quotes

    return _ParsedCondition(field, op, value)


def _evaluate(cond: _ParsedCondition, element: dict[str, Any]) -> bool:
    actual = element.get(cond.field)

    if cond.op == "==":
        return actual == cond.value
    if cond.op == "!=":
        return actual != cond.value
    if cond.op == "in":
        return actual in cond.value if isinstance(cond.value, list) else False
    if cond.op == "notin":
        return actual not in cond.value if isinstance(cond.value, list) else True
    return False
