"""
Quick script: run MODEL.pdf through the full AegisQS pipeline.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from auto_assess import ZeroTouchAssessmentService
from boq_mapper import BOQItemMapper
from cost_breakdown import CostBreakdownCalculator
from estimate_generator import EstimateGenerator
from quantity_calculator import QuantityCalculator
from vector_pdf_parser import VectorPDFParser
from unit_rate_pricer import UnitRatePricer
from waste_contingency import WasteContingencyApplier

PDF_PATH = Path(__file__).resolve().parent / "MODEL.pdf"

BUILD_BOQ_TEMPLATE: list[dict] = [
    {"item_id": "BOQ-WALL", "description": "Concrete wall",
     "classification": "Ss_25_10_30", "unit": "m3", "rate": 115.0},
    {"item_id": "BOQ-DOOR", "description": "Timber door",
     "classification": "Ss_25_10_30", "unit": "m3", "rate": 450.0},
    {"item_id": "BOQ-WINDOW", "description": "Glazed window",
     "classification": "Ss_25_10_30", "unit": "m3", "rate": 350.0},
    {"item_id": "BOQ-COLUMN", "description": "Concrete column",
     "classification": "Ss_25_10_30", "unit": "m3", "rate": 125.0},
    {"item_id": "BOQ-BEAM", "description": "Steel beam",
     "classification": "Ss_25_10_30", "unit": "m3", "rate": 7065.0},
    {"item_id": "BOQ-SLAB", "description": "Concrete slab",
     "classification": "Ss_25_10_30", "unit": "m3", "rate": 110.0},
    {"item_id": "BOQ-STAIR", "description": "Concrete stair",
     "classification": "Ss_25_10_30", "unit": "m3", "rate": 200.0},
    {"item_id": "BOQ-GENERIC", "description": "Generic element",
     "classification": "Ss_25_10_30", "unit": "m3", "rate": 100.0},
]


def build_price_book() -> list[dict]:
    return [
        {"item_code": "BOQ-WALL", "description": "Concrete wall",
         "unit": "m3", "rate": 115.0, "trade": "Concrete", "material_type": "concrete"},
        {"item_code": "BOQ-DOOR", "description": "Timber door",
         "unit": "m3", "rate": 450.0, "trade": "Joinery", "material_type": "timber"},
        {"item_code": "BOQ-WINDOW", "description": "Glazed window",
         "unit": "m3", "rate": 350.0, "trade": "Glazing", "material_type": "glazing"},
        {"item_code": "BOQ-COLUMN", "description": "Concrete column",
         "unit": "m3", "rate": 125.0, "trade": "Concrete", "material_type": "concrete"},
        {"item_code": "BOQ-BEAM", "description": "Steel beam",
         "unit": "m3", "rate": 7065.0, "trade": "Structural Steel", "material_type": "steel"},
        {"item_code": "BOQ-SLAB", "description": "Concrete slab",
         "unit": "m3", "rate": 110.0, "trade": "Concrete", "material_type": "concrete"},
        {"item_code": "BOQ-STAIR", "description": "Concrete stair",
         "unit": "m3", "rate": 200.0, "trade": "Concrete", "material_type": "concrete"},
        {"item_code": "BOQ-GENERIC", "description": "Generic element",
         "unit": "m3", "rate": 100.0, "trade": "General", "material_type": "mixed"},
    ]


def main() -> int:
    print("=" * 72)
    print("AegisQS — MODEL.pdf Pipeline Run")
    print("=" * 72)

    if not PDF_PATH.exists():
        print(f"ERROR: {PDF_PATH} not found")
        return 1

    print(f"\n📄 File: {PDF_PATH.name}  ({PDF_PATH.stat().st_size / 1024:.0f} KB)")

    # ── Step 1: Assessment via ZeroTouchAssessmentService ────────────
    print("\n── Step 1: Zero-touch assessment ──")
    assessment = ZeroTouchAssessmentService.assess_model(str(PDF_PATH))
    print(f"  Gate:      {assessment['gate_state']}")
    print(f"  Score:     {assessment['overall_score']:.0f}/100")
    print(f"  Elements:  {assessment['element_count']}")
    print(f"  File type: {assessment['metadata']['file_type']}")
    print(f"  Summary:   {assessment['summary']}")

    if assessment["element_count"] == 0:
        print("\n  ⚠️  No elements detected in the PDF. This can happen if:")
        print("     • The drawing style doesn't match natural photos the model expects")
        print("     • Elements are too small or abstract")
        print("     • The page is mostly text, not a floor plan")
        print("\n  The pipeline completed successfully — the model just found nothing.")
        print("  For reliable detection, fine-tune a model on your drawing style.")
        return 0

    # ── Step 2: Show what was detected ───────────────────────────────
    print("\n── Step 2: Detected elements ──")
    parser = VectorPDFParser()
    elements = parser.parse(str(PDF_PATH))
    element_dicts = [el.model_dump() for el in elements]

    print(f"  {'#':<3s} {'ID':<22s} {'Category':<14s} "
          f"{'Area(m²)':>8s} {'Vol(m³)':>8s} {'Material':<20s} {'Confidence'}")
    print(f"  {'─'*3} {'─'*22} {'─'*14} {'─'*8} {'─'*8} {'─'*20} {'─'*10}")
    for i, el in enumerate(elements, 1):
        conf = el.properties.get("ai_confidence", "?")
        conf_str = f"{conf:.2f}" if isinstance(conf, float) else str(conf)
        print(f"  {i:<3d} {el.id:<22s} {el.category:<14s} "
              f"{el.area:>8.4f} {el.volume:>8.4f} "
              f"{el.material_name or '?':<20s} {conf_str}")

    # ── Step 3: Quantity aggregation ─────────────────────────────────
    print("\n── Step 3: Quantity aggregation ──")
    qtys = QuantityCalculator.calculate_quantities(element_dicts)
    gt = qtys["grand_totals"]
    print(f"  Total Volume:  {gt['total_volume_m3']:>10.4f} m³")
    print(f"  Total Area:    {gt['total_area_m2']:>10.4f} m²")
    print(f"  Total Length:  {gt['total_length_m']:>10.4f} m")

    print("\n  By element type:")
    for etype, vals in sorted(qtys["by_element_type"].items()):
        print(f"    {etype:<20s}  count={vals['count']:.0f}  "
              f"vol={vals['total_volume_m3']:.3f}m³  "
              f"area={vals['total_area_m2']:.3f}m²")

    print("\n  By material:")
    for mat, vals in sorted(qtys["by_material"].items()):
        if vals["count"] > 0:
            print(f"    {mat:<25s}  count={vals['count']:.0f}  "
                  f"vol={vals['total_volume_m3']:.3f}m³")

    # ── Step 4: BOQ mapping + pricing ────────────────────────────────
    print("\n── Step 4: BOQ mapping & pricing ──")
    boq_items = BOQItemMapper.map_to_boq(element_dicts, BUILD_BOQ_TEMPLATE)
    priced = UnitRatePricer.price_items(boq_items, build_price_book())

    print(f"  BOQ line items: {len(priced)}")
    for item in priced:
        print(f"    {item['item_id']:<20s}  qty={item['quantity']:.3f} "
              f"rate=${item['rate_applied']:.2f}  "
              f"total=${item['total_price']:.2f}  "
              f"conf={item['confidence']}")

    # ── Step 5: Waste + contingency ──────────────────────────────────
    print("\n── Step 5: Waste & contingency ──")
    waste = WasteContingencyApplier.apply_factors(
        priced,
        waste_factors={"concrete": 0.05, "steel": 0.03, "timber": 0.05, "default": 0.02},
        contingency_percentage=10.0,
    )
    print(f"  Waste-adjusted subtotal: ${waste['contingency_summary']['adjusted_subtotal']:,.2f}")
    print(f"  Contingency amount:      ${waste['contingency_summary']['amount']:,.2f}")
    print(f"  Grand total:             ${waste['grand_total']:,.2f}")

    # ── Step 6: Formal estimate ──────────────────────────────────────
    print("\n── Step 6: Formal estimate ──")
    cb = CostBreakdownCalculator.calculate_breakdown(waste["adjusted_boq"])
    estimate = EstimateGenerator.generate_estimate(
        waste, estimate_type="tender",
        project_name="MODEL.pdf — 2D Drawing",
        cost_breakdown=cb,
    )

    print(f"  Estimate ID:   {estimate['estimate_id']}")
    print(f"  Base cost:     ${estimate['base_cost']:>12,.2f}")
    print(f"  Waste-adjusted:${estimate['waste_adjusted_cost']:>12,.2f}")
    print(f"  Contingency:   ${estimate['contingency']['amount']:>12,.2f} "
          f"({estimate['contingency']['percentage']}%)")
    print(f"  ═══════════════════════════════════════")
    print(f"  TOTAL ESTIMATE: ${estimate['total_estimate']:>12,.2f}")
    print(f"  ═══════════════════════════════════════")

    print(f"\n  Cost breakdown:")
    print(f"    Materials:   ${cb['material_costs']:>10,.2f}")
    print(f"    Labour:      ${cb['labor_costs']:>10,.2f}")
    print(f"    Equipment:   ${cb['equipment_costs']:>10,.2f}")
    print(f"    Overhead:    ${cb['overhead_and_profit']:>10,.2f}")

    # ── Save full output ─────────────────────────────────────────────
    output_data = {
        "assessment_summary": {
            "gate_state": assessment["gate_state"],
            "score": assessment["overall_score"],
            "element_count": assessment["element_count"],
            "summary": assessment["summary"],
        },
        "elements": element_dicts,
        "quantities": qtys,
        "priced_boq": priced,
        "estimate": estimate,
    }
    output_path = PDF_PATH.with_suffix(".pipeline_output.json")
    output_path.write_text(json.dumps(output_data, indent=2, default=str), encoding="utf-8")
    print(f"\n📁 Full output saved to: {output_path}")

    print(f"\n{'=' * 72}")
    print("PIPELINE COMPLETE")
    print(f"{'=' * 72}")
    return 0


if __name__ == "__main__":
    sys.exit(main())