"""Built-in material specification library.

Provides :data:`DEFAULT_MATERIALS`, a curated list of 100+ common
construction materials, and :class:`MaterialLibrary`, a small management
class for loading, searching, extending, merging, and persisting specs.

The library is designed to make AegisQS work out-of-the-box: when a caller
supplies no project specs, :class:`MaterialLibrary` (and the downstream
:class:`~material_mapper.MaterialMapper`) fall back to these defaults instead
of marking every material as ``NO_MATCH``.

Default material list (by family)
---------------------------------
CONCRETE (16)
    Concrete C20/25, Concrete C25/30, Concrete C30/37, Concrete C32/40,
    Concrete C35/45, Concrete C40/50, Reinforced concrete, Precast concrete,
    Ready-mix concrete, Screed concrete, Mass concrete, High-strength
    concrete, Lightweight concrete, Fibre-reinforced concrete,
    Self-compacting concrete, Porous concrete.

STEEL (12)
    Steel S275, Steel S355, Steel S420, Steel S460, Reinforcement steel B500,
    Mild steel, Stainless steel, Universal beam, Universal column, Steel
    section, Hollow section, Galvanised steel.

TIMBER (11)
    Timber C16, Timber C24, Timber C30, Softwood, Hardwood, Plywood, OSB,
    MDF, CLT, Glulam, Treated timber.

MASONRY (12)
    Clay brick, Concrete block, AAC block, Engineering brick, Facing brick,
    Limestone, Granite, Sandstone, CMU, Terracotta, Brickwork, Stone cladding.

INSULATION (10)
    Mineral wool, Rockwool, Glass wool, EPS, XPS, PIR, PUR, Phenolic foam,
    Cellulose, Spray foam.

GLAZING (6)
    Single glazing, Double glazing, Triple glazing, Toughened glass,
    Laminated glass, Low-E glass.

FINISHES (16)
    Gypsum plaster, Cement plaster, Emulsion paint, Gloss paint, Primer,
    Ceramic tile, Porcelain tile, Natural stone tile, Hardwood flooring,
    Laminate flooring, Vinyl flooring, Carpet, Wallpaper, Plasterboard,
    Skim coat, Acoustic ceiling tile.

MEMBRANES (8)
    Waterproofing membrane, Vapour barrier, DPC, Roofing felt, Breather
    membrane, Damp proof membrane, Self-adhesive membrane, Liquid
    waterproofing.

MEP (12)
    Copper pipe, PVC pipe, Steel pipe, Copper cable, PVC conduit, Galvanised
    ductwork, Aluminium duct, HVAC duct, Cast iron pipe, PEX pipe, Electrical
    cable, Ventilation duct.

Extending the library
---------------------
Use :meth:`MaterialLibrary.add_spec` or :meth:`MaterialLibrary.merge`::

    from default_material_library import MaterialLibrary
    from models import MaterialSpec, MaterialFamily

    library = MaterialLibrary()
    custom = MaterialSpec(
        id="MAT-CUSTOM-01",
        name="My Project Concrete",
        aliases=["mpc", "project concrete"],
        unit="m3",
        material_family=MaterialFamily.CONCRETE,
        properties={"density": 2400, "compressive_strength": 45},
    )
    library.add_spec(custom)
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

from models import MaterialFamily, MaterialSpec


def _spec(
    spec_id: str,
    name: str,
    aliases: list[str],
    unit: str,
    family: MaterialFamily,
    **properties: Any,
) -> MaterialSpec:
    """Build a :class:`MaterialSpec` with a consistent, terse shape."""
    return MaterialSpec(
        id=spec_id,
        name=name,
        aliases=aliases,
        unit=unit,
        material_family=family,
        properties=dict(properties),
    )


# ---------------------------------------------------------------------------
# Default material data
# ---------------------------------------------------------------------------

_CONCRETE: list[MaterialSpec] = [
    _spec("MAT-CONC-C20", "Concrete C20/25", ["c20", "concrete c20", "c20/25", "conc 20"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=20,
          thermal_conductivity=1.3, fire_rating=120, cost_per_unit=105),
    _spec("MAT-CONC-C25", "Concrete C25/30", ["c25", "concrete c25", "c25/30", "conc 25"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=25,
          thermal_conductivity=1.4, fire_rating=120, cost_per_unit=108),
    _spec("MAT-CONC-C30", "Concrete C30/37", ["c30", "concrete c30", "c30/37", "conc 30", "beton", "concrete", "hormigón", "béton"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=30,
          thermal_conductivity=1.5, fire_rating=120, cost_per_unit=112),
    _spec("MAT-CONC-C32", "Concrete C32/40", ["c32", "concrete c32", "c32/40", "conc 32", "c40"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=32,
          thermal_conductivity=1.5, fire_rating=120, cost_per_unit=115),
    _spec("MAT-CONC-C35", "Concrete C35/45", ["c35", "concrete c35", "c35/45", "conc 35"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=35,
          thermal_conductivity=1.6, fire_rating=120, cost_per_unit=118),
    _spec("MAT-CONC-C40", "Concrete C40/50", ["c40", "concrete c40", "c40/50", "conc 40"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=40,
          thermal_conductivity=1.7, fire_rating=120, cost_per_unit=122),
    _spec("MAT-CONC-RC", "Reinforced concrete", ["rc", "reinforced", "rcc", "reinforced concrete", "stahlbeton", "béton armé", "hormigón armado", "beton, tragend", "armierter beton"],
          "m3", MaterialFamily.CONCRETE, density=2500, compressive_strength=32,
          thermal_conductivity=1.7, fire_rating=120, cost_per_unit=150),
    _spec("MAT-CONC-PC", "Precast concrete", ["precast", "pc concrete", "precast concrete"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=40,
          thermal_conductivity=1.6, fire_rating=120, cost_per_unit=180),
    _spec("MAT-CONC-RMC", "Ready-mix concrete", ["ready mix", "readymix", "rm concrete"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=30,
          thermal_conductivity=1.5, fire_rating=120, cost_per_unit=110),
    _spec("MAT-CONC-SCREED", "Screed concrete", ["screed", "floor screed", "concrete screed", "estrich", "zementestrich", "chape", "solera"],
          "m3", MaterialFamily.CONCRETE, density=2200, compressive_strength=20,
          thermal_conductivity=1.2, fire_rating=90, cost_per_unit=95),
    _spec("MAT-CONC-MASS", "Mass concrete", ["mass concrete", "plain concrete", "unreinforced concrete", "massiv", "massivbeton", "unbewehrter beton", "wubo-beton"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=15,
          thermal_conductivity=1.3, fire_rating=120, cost_per_unit=90),
    _spec("MAT-CONC-HSC", "High-strength concrete", ["hsc", "high strength", "high strength concrete"],
          "m3", MaterialFamily.CONCRETE, density=2500, compressive_strength=60,
          thermal_conductivity=1.9, fire_rating=120, cost_per_unit=160),
    _spec("MAT-CONC-LWC", "Lightweight concrete", ["lightweight", "lwc", "lightweight concrete"],
          "m3", MaterialFamily.CONCRETE, density=1800, compressive_strength=25,
          thermal_conductivity=0.8, fire_rating=120, cost_per_unit=130),
    _spec("MAT-CONC-FRC", "Fibre-reinforced concrete", ["frc", "fibre concrete", "fiber reinforced concrete"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=35,
          thermal_conductivity=1.6, fire_rating=120, cost_per_unit=140),
    _spec("MAT-CONC-SCC", "Self-compacting concrete", ["scc", "self compacting", "self compacting concrete"],
          "m3", MaterialFamily.CONCRETE, density=2400, compressive_strength=40,
          thermal_conductivity=1.7, fire_rating=120, cost_per_unit=135),
    _spec("MAT-CONC-NF", "Porous concrete", ["no fines", "porous concrete", "permeable concrete"],
          "m3", MaterialFamily.CONCRETE, density=1900, compressive_strength=10,
          thermal_conductivity=0.9, fire_rating=90, cost_per_unit=100),
]

_STEEL: list[MaterialSpec] = [
    _spec("MAT-STEEL-S275", "Steel S275", ["s275", "grade s275", "structural steel s275"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=275,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=0.85),
    _spec("MAT-STEEL-S355", "Steel S355", ["s355", "grade s355", "structural steel s355"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=355,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=0.9),
    _spec("MAT-STEEL-S420", "Steel S420", ["s420", "grade s420", "structural steel s420"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=420,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=0.95),
    _spec("MAT-STEEL-S460", "Steel S460", ["s460", "grade s460", "structural steel s460"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=460,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=1.0),
    _spec("MAT-STEEL-REBAR", "Reinforcement steel B500", ["b500", "rebar b500", "reinforcement steel", "reinforcing bar"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=500,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=0.8),
    _spec("MAT-STEEL-MILD", "Mild steel", ["ms", "low carbon steel", "mild steel", "stahl", "baustahl", "acier", "acciaio"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=250,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=0.7),
    _spec("MAT-STEEL-SS", "Stainless steel", ["ss", "inox", "stainless"],
          "kg", MaterialFamily.STEEL, density=8000, yield_strength=300,
          thermal_conductivity=16, fire_rating=60, cost_per_unit=4.5),
    _spec("MAT-STEEL-UB", "Universal beam", ["ub", "universal beam", "i beam", "i-beam"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=355,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=0.95),
    _spec("MAT-STEEL-UC", "Universal column", ["uc", "universal column", "h column", "h-column"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=355,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=0.95),
    _spec("MAT-STEEL-SECTION", "Steel section", ["steel section", "section steel", "structural section"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=275,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=0.85),
    _spec("MAT-STEEL-HOLLOW", "Hollow section", ["shs", "rhs", "chs", "hollow steel section"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=355,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=1.05),
    _spec("MAT-STEEL-GALV", "Galvanised steel", ["galvanized steel", "galvanised", "zinc coated steel"],
          "kg", MaterialFamily.STEEL, density=7850, yield_strength=275,
          thermal_conductivity=50, fire_rating=30, cost_per_unit=1.1),
]

_TIMBER: list[MaterialSpec] = [
    _spec("MAT-TIM-C16", "Timber C16", ["c16", "grade c16", "softwood c16", "timber grade c16"],
          "m3", MaterialFamily.TIMBER, density=500, thermal_conductivity=0.13,
          fire_rating=15, cost_per_unit=250),
    _spec("MAT-TIM-C24", "Timber C24", ["c24", "grade c24", "structural timber", "timber grade c24", "holz", "bauholz", "nadelholz", "konstruktionsholz", "bois", "madera", "legno"],
          "m3", MaterialFamily.TIMBER, density=500, thermal_conductivity=0.13,
          fire_rating=15, cost_per_unit=300),
    _spec("MAT-TIM-C30", "Timber C30", ["c30", "grade c30", "timber grade c30"],
          "m3", MaterialFamily.TIMBER, density=520, thermal_conductivity=0.14,
          fire_rating=15, cost_per_unit=330),
    _spec("MAT-TIM-SOFT", "Softwood", ["softwood timber", "pine", "conifer"],
          "m3", MaterialFamily.TIMBER, density=450, thermal_conductivity=0.12,
          fire_rating=15, cost_per_unit=220),
    _spec("MAT-TIM-HARD", "Hardwood", ["hardwood timber", "oak", "deciduous timber"],
          "m3", MaterialFamily.TIMBER, density=700, thermal_conductivity=0.17,
          fire_rating=20, cost_per_unit=700),
    _spec("MAT-TIM-PLY", "Plywood", ["ply", "ply board", "plywood sheet"],
          "m3", MaterialFamily.TIMBER, density=600, thermal_conductivity=0.13,
          fire_rating=15, cost_per_unit=450),
    _spec("MAT-TIM-OSB", "OSB", ["osb board", "oriented strand board", "sterling board"],
          "m3", MaterialFamily.TIMBER, density=650, thermal_conductivity=0.13,
          fire_rating=15, cost_per_unit=350),
    _spec("MAT-TIM-MDF", "MDF", ["medium density fibreboard", "mdf board", "fiberboard"],
          "m3", MaterialFamily.TIMBER, density=750, thermal_conductivity=0.14,
          fire_rating=15, cost_per_unit=400),
    _spec("MAT-TIM-CLT", "CLT", ["cross laminated timber", "xlam", "clt panel"],
          "m3", MaterialFamily.TIMBER, density=480, thermal_conductivity=0.13,
          fire_rating=30, cost_per_unit=650),
    _spec("MAT-TIM-GLULAM", "Glulam", ["glued laminated timber", "glulam beam", "glulam"],
          "m3", MaterialFamily.TIMBER, density=500, thermal_conductivity=0.13,
          fire_rating=30, cost_per_unit=800),
    _spec("MAT-TIM-TREATED", "Treated timber", ["pressure treated", "tanalised timber", "preservative treated timber"],
          "m3", MaterialFamily.TIMBER, density=480, thermal_conductivity=0.12,
          fire_rating=15, cost_per_unit=280),
]

_MASONRY: list[MaterialSpec] = [
    _spec("MAT-MAS-BRICK", "Clay brick", ["common brick", "clay masonry", "fired brick"],
          "m2", MaterialFamily.MASONRY, density=1900, compressive_strength=20,
          thermal_conductivity=0.84, fire_rating=120, cost_per_unit=35),
    _spec("MAT-MAS-BLOCK", "Concrete block", ["dense block", "concrete masonry block", "dense concrete block"],
          "m2", MaterialFamily.MASONRY, density=2100, compressive_strength=7,
          thermal_conductivity=1.3, fire_rating=120, cost_per_unit=25),
    _spec("MAT-MAS-AAC", "AAC block", ["autoclaved aerated concrete", "aircrete", "aac block"],
          "m2", MaterialFamily.MASONRY, density=600, compressive_strength=4,
          thermal_conductivity=0.18, fire_rating=120, cost_per_unit=30),
    _spec("MAT-MAS-ENGBRICK", "Engineering brick", ["class b", "engineering brick", "class b engineering brick"],
          "m2", MaterialFamily.MASONRY, density=2100, compressive_strength=50,
          thermal_conductivity=1.1, fire_rating=120, cost_per_unit=45),
    _spec("MAT-MAS-FACEBRICK", "Facing brick", ["face brick", "brick facing", "facing brickwork"],
          "m2", MaterialFamily.MASONRY, density=1900, compressive_strength=20,
          thermal_conductivity=0.84, fire_rating=120, cost_per_unit=55),
    _spec("MAT-MAS-LIMESTONE", "Limestone", ["natural stone limestone", "limestone block", "limestone cladding"],
          "m2", MaterialFamily.MASONRY, density=2600, compressive_strength=60,
          thermal_conductivity=1.5, fire_rating=120, cost_per_unit=90),
    _spec("MAT-MAS-GRANITE", "Granite", ["natural stone granite", "granite block", "granite cladding"],
          "m2", MaterialFamily.MASONRY, density=2700, compressive_strength=150,
          thermal_conductivity=2.8, fire_rating=120, cost_per_unit=120),
    _spec("MAT-MAS-SANDSTONE", "Sandstone", ["natural stone sandstone", "sandstone block", "sandstone cladding"],
          "m2", MaterialFamily.MASONRY, density=2300, compressive_strength=40,
          thermal_conductivity=1.8, fire_rating=120, cost_per_unit=80),
    _spec("MAT-MAS-CMU", "CMU", ["concrete masonry unit", "cmu block", "concrete block unit"],
          "m2", MaterialFamily.MASONRY, density=2000, compressive_strength=10,
          thermal_conductivity=1.2, fire_rating=120, cost_per_unit=28),
    _spec("MAT-MAS-TERRACOTTA", "Terracotta", ["terracotta block", "terracotta tile", "clay block"],
          "m2", MaterialFamily.MASONRY, density=1800, compressive_strength=15,
          thermal_conductivity=0.8, fire_rating=120, cost_per_unit=60),
    _spec("MAT-MAS-BRICKWORK", "Brickwork", ["brick masonry", "brickwork wall", "brick wall", "mauerwerk", "ziegelmauerwerk", "maçonnerie", "muratura"],
          "m2", MaterialFamily.MASONRY, density=1900, compressive_strength=20,
          thermal_conductivity=0.84, fire_rating=120, cost_per_unit=65),
    _spec("MAT-MAS-STONECLAD", "Stone cladding", ["stone walling", "stone cladding panel", "masonry cladding"],
          "m2", MaterialFamily.MASONRY, density=2400, compressive_strength=50,
          thermal_conductivity=1.6, fire_rating=120, cost_per_unit=95),
    _spec("MAT-MAS-KALKSANDSTEIN", "Calcium silicate brick", ["kalksandstein", "sand lime brick", "sand-lime brick", "ks stein", "silicate brick", "calcium silicate masonry"],
          "m2", MaterialFamily.MASONRY, density=1800, compressive_strength=12,
          thermal_conductivity=0.9, fire_rating=120, cost_per_unit=38),
]

_INSULATION: list[MaterialSpec] = [
    _spec("MAT-INS-MINWOOL", "Mineral wool", ["rock wool", "stone wool", "glass wool", "mineral fibre", "dämmung", "daemmung", "mineralwolle", "isolation", "isolant", "aislante"],
          "m2", MaterialFamily.INSULATION, density=30, thermal_conductivity=0.037,
          fire_rating=120, cost_per_unit=6),
    _spec("MAT-INS-ROCKWOOL", "Rockwool", ["rock wool insulation", "rockwool batt", "stone wool insulation"],
          "m2", MaterialFamily.INSULATION, density=45, thermal_conductivity=0.037,
          fire_rating=120, cost_per_unit=8),
    _spec("MAT-INS-GLASSWOOL", "Glass wool", ["glass fibre insulation", "fibreglass insulation", "glass wool insulation"],
          "m2", MaterialFamily.INSULATION, density=20, thermal_conductivity=0.038,
          fire_rating=60, cost_per_unit=5),
    _spec("MAT-INS-EPS", "EPS", ["expanded polystyrene", "eps board", "polystyrene insulation"],
          "m2", MaterialFamily.INSULATION, density=25, thermal_conductivity=0.038,
          fire_rating=60, cost_per_unit=7),
    _spec("MAT-INS-XPS", "XPS", ["extruded polystyrene", "xps board", "extruded foam"],
          "m2", MaterialFamily.INSULATION, density=35, thermal_conductivity=0.034,
          fire_rating=60, cost_per_unit=9),
    _spec("MAT-INS-PIR", "PIR", ["polyisocyanurate", "pir board", "pir insulation"],
          "m2", MaterialFamily.INSULATION, density=30, thermal_conductivity=0.022,
          fire_rating=60, cost_per_unit=10),
    _spec("MAT-INS-PUR", "PUR", ["polyurethane", "pur foam", "polyurethane foam"],
          "m2", MaterialFamily.INSULATION, density=40, thermal_conductivity=0.026,
          fire_rating=60, cost_per_unit=9),
    _spec("MAT-INS-PHENOLIC", "Phenolic foam", ["phenolic insulation", "phenolic board", "phenolic foam board"],
          "m2", MaterialFamily.INSULATION, density=35, thermal_conductivity=0.021,
          fire_rating=60, cost_per_unit=12),
    _spec("MAT-INS-CELLULOSE", "Cellulose", ["cellulose insulation", "recycled cellulose", "blown cellulose"],
          "m2", MaterialFamily.INSULATION, density=45, thermal_conductivity=0.040,
          fire_rating=60, cost_per_unit=5),
    _spec("MAT-INS-SPRAY", "Spray foam", ["spray polyurethane foam", "spray foam insulation", "closed cell foam"],
          "m2", MaterialFamily.INSULATION, density=45, thermal_conductivity=0.026,
          fire_rating=60, cost_per_unit=11),
]

_GLAZING: list[MaterialSpec] = [
    _spec("MAT-GLAZ-SINGLE", "Single glazing", ["single glazed", "single pane", "single glass"],
          "m2", MaterialFamily.GLAZING, thermal_conductivity=1.0, cost_per_unit=35),
    _spec("MAT-GLAZ-DOUBLE", "Double glazing", ["double glazed", "insulated glazing unit", "double glazed unit"],
          "m2", MaterialFamily.GLAZING, thermal_conductivity=0.3, cost_per_unit=75),
    _spec("MAT-GLAZ-TRIPLE", "Triple glazing", ["triple glazed", "triple glazed unit", "triple pane"],
          "m2", MaterialFamily.GLAZING, thermal_conductivity=0.2, cost_per_unit=110),
    _spec("MAT-GLAZ-TOUGH", "Toughened glass", ["tempered glass", "toughened safety glass", "safety glass"],
          "m2", MaterialFamily.GLAZING, thermal_conductivity=1.0, cost_per_unit=55),
    _spec("MAT-GLAZ-LAM", "Laminated glass", ["safety glass laminate", "laminated safety glass", "laminated glazing"],
          "m2", MaterialFamily.GLAZING, thermal_conductivity=1.0, cost_per_unit=85),
    _spec("MAT-GLAZ-LOWE", "Low-E glass", ["low emissivity glass", "low e glass", "low-e glazing"],
          "m2", MaterialFamily.GLAZING, thermal_conductivity=0.6, cost_per_unit=65),
]

_FINISHES: list[MaterialSpec] = [
    _spec("MAT-FIN-GYPSUM", "Gypsum plaster", ["plaster", "gypsum finish", "plaster finish", "gips", "gipsputz", "gipskarton", "plâtre", "yeso"],
          "m2", MaterialFamily.FINISHES, density=900, thermal_conductivity=0.25,
          fire_rating=60, cost_per_unit=12),
    _spec("MAT-FIN-CEMENT", "Cement plaster", ["cement render", "sand cement plaster", "cement finish"],
          "m2", MaterialFamily.FINISHES, density=1800, thermal_conductivity=0.9,
          fire_rating=120, cost_per_unit=15),
    _spec("MAT-FIN-EMULSION", "Emulsion paint", ["emulsion", "wall paint", "emulsion coating"],
          "m2", MaterialFamily.FINISHES, cost_per_unit=3),
    _spec("MAT-FIN-GLOSS", "Gloss paint", ["gloss", "oil paint", "gloss finish paint"],
          "m2", MaterialFamily.FINISHES, cost_per_unit=4),
    _spec("MAT-FIN-PRIMER", "Primer", ["primer paint", "undercoat", "sealer primer"],
          "m2", MaterialFamily.FINISHES, cost_per_unit=2.5),
    _spec("MAT-FIN-CERAMIC", "Ceramic tile", ["ceramic", "glazed tile", "ceramic wall tile"],
          "m2", MaterialFamily.FINISHES, density=2300, thermal_conductivity=1.3,
          fire_rating=60, cost_per_unit=28),
    _spec("MAT-FIN-PORCELAIN", "Porcelain tile", ["porcelain", "porcelain floor tile", "vitrified tile"],
          "m2", MaterialFamily.FINISHES, density=2400, thermal_conductivity=1.5,
          fire_rating=60, cost_per_unit=38),
    _spec("MAT-FIN-STONETILE", "Natural stone tile", ["stone tile", "marble tile", "natural stone floor"],
          "m2", MaterialFamily.FINISHES, density=2600, thermal_conductivity=2.0,
          fire_rating=60, cost_per_unit=65),
    _spec("MAT-FIN-HARDFLOOR", "Hardwood flooring", ["wood floor", "timber floor", "hardwood floor"],
          "m2", MaterialFamily.FINISHES, density=700, thermal_conductivity=0.17,
          fire_rating=20, cost_per_unit=55),
    _spec("MAT-FIN-LAMFLOOR", "Laminate flooring", ["laminate", "laminate floor", "laminate plank"],
          "m2", MaterialFamily.FINISHES, density=800, thermal_conductivity=0.15,
          fire_rating=20, cost_per_unit=22),
    _spec("MAT-FIN-VINYL", "Vinyl flooring", ["vinyl", "lvt", "luxury vinyl tile"],
          "m2", MaterialFamily.FINISHES, density=1200, thermal_conductivity=0.3,
          fire_rating=20, cost_per_unit=25),
    _spec("MAT-FIN-CARPET", "Carpet", ["carpet tile", "broadloom", "carpet flooring"],
          "m2", MaterialFamily.FINISHES, density=350, thermal_conductivity=0.06,
          fire_rating=20, cost_per_unit=20),
    _spec("MAT-FIN-WALLPAPER", "Wallpaper", ["wall covering", "wallpaper roll", "decorative wall covering"],
          "m2", MaterialFamily.FINISHES, cost_per_unit=8),
    _spec("MAT-FIN-PLASTERBOARD", "Plasterboard", ["gypsum board", "drywall", "plaster board"],
          "m2", MaterialFamily.FINISHES, density=900, thermal_conductivity=0.25,
          fire_rating=30, cost_per_unit=7),
    _spec("MAT-FIN-SKIM", "Skim coat", ["skim finish", "skim plaster", "plaster skim"],
          "m2", MaterialFamily.FINISHES, density=1200, thermal_conductivity=0.3,
          fire_rating=30, cost_per_unit=5),
    _spec("MAT-FIN-CEILTILE", "Acoustic ceiling tile", ["ceiling tile", "suspended ceiling", "acoustic tile"],
          "m2", MaterialFamily.FINISHES, density=300, thermal_conductivity=0.06,
          fire_rating=30, cost_per_unit=18),
]

_MEMBRANES: list[MaterialSpec] = [
    _spec("MAT-MEM-WATERPROOF", "Waterproofing membrane", ["waterproof membrane", "tanking membrane", "waterproofing", "abdichtung", "bauwerksabdichtung", "étanchéité", "impermeabilizzazione"],
          "m2", MaterialFamily.MEMBRANES, thermal_conductivity=0.2, fire_rating=30, cost_per_unit=12),
    _spec("MAT-MEM-VAPOUR", "Vapour barrier", ["vapor barrier", "vapour control layer", "vcl"],
          "m2", MaterialFamily.MEMBRANES, thermal_conductivity=0.3, fire_rating=30, cost_per_unit=3),
    _spec("MAT-MEM-DPC", "DPC", ["damp proof course", "dpc membrane", "damp proof"],
          "m2", MaterialFamily.MEMBRANES, thermal_conductivity=0.3, fire_rating=30, cost_per_unit=4),
    _spec("MAT-MEM-ROOFING", "Roofing felt", ["bitumen felt", "felt", "roof felt"],
          "m2", MaterialFamily.MEMBRANES, thermal_conductivity=0.2, fire_rating=30, cost_per_unit=6),
    _spec("MAT-MEM-BREATHER", "Breather membrane", ["breathable membrane", "breather membrane", "roofing breather"],
          "m2", MaterialFamily.MEMBRANES, thermal_conductivity=0.3, fire_rating=30, cost_per_unit=5),
    _spec("MAT-MEM-DPM", "Damp proof membrane", ["dpm", "damp proof membrane", "dpm membrane"],
          "m2", MaterialFamily.MEMBRANES, thermal_conductivity=0.3, fire_rating=30, cost_per_unit=4),
    _spec("MAT-MEM-SELFADH", "Self-adhesive membrane", ["bituminous membrane", "self adhesive", "peel and stick membrane"],
          "m2", MaterialFamily.MEMBRANES, thermal_conductivity=0.2, fire_rating=30, cost_per_unit=9),
    _spec("MAT-MEM-LIQUID", "Liquid waterproofing", ["liquid membrane", "liquid applied waterproofing", "liquid waterproofing membrane"],
          "m2", MaterialFamily.MEMBRANES, thermal_conductivity=0.2, fire_rating=30, cost_per_unit=14),
]

_MEP: list[MaterialSpec] = [
    _spec("MAT-MEP-CU-PIPE", "Copper pipe", ["copper tube", "copper piping", "cu pipe"],
          "m", MaterialFamily.MEP, density=8960, thermal_conductivity=390, fire_rating=30, cost_per_unit=12),
    _spec("MAT-MEP-PVC-PIPE", "PVC pipe", ["pvc piping", "plastic pipe", "pvc tube"],
          "m", MaterialFamily.MEP, density=1400, thermal_conductivity=0.2, fire_rating=30, cost_per_unit=5),
    _spec("MAT-MEP-STEEL-PIPE", "Steel pipe", ["galvanized steel pipe", "mild steel pipe", "steel tube"],
          "m", MaterialFamily.MEP, density=7850, thermal_conductivity=50, fire_rating=30, cost_per_unit=9),
    _spec("MAT-MEP-CU-CABLE", "Copper cable", ["copper wire", "electrical copper cable", "copper conductor"],
          "m", MaterialFamily.MEP, density=8960, thermal_conductivity=390, fire_rating=30, cost_per_unit=3),
    _spec("MAT-MEP-PVC-CONDUIT", "PVC conduit", ["plastic conduit", "pvc duct", "electrical conduit"],
          "m", MaterialFamily.MEP, density=1400, thermal_conductivity=0.2, fire_rating=30, cost_per_unit=2.5),
    _spec("MAT-MEP-GALV-DUCT", "Galvanised ductwork", ["galvanized steel duct", "galv duct", "galvanised duct"],
          "m", MaterialFamily.MEP, density=7850, thermal_conductivity=50, fire_rating=30, cost_per_unit=18),
    _spec("MAT-MEP-ALU-DUCT", "Aluminium duct", ["aluminum duct", "aluminium ductwork", "alu duct"],
          "m", MaterialFamily.MEP, density=2700, thermal_conductivity=200, fire_rating=30, cost_per_unit=16),
    _spec("MAT-MEP-HVAC-DUCT", "HVAC duct", ["hvac ducting", "air duct", "ventilation ductwork"],
          "m", MaterialFamily.MEP, density=7850, thermal_conductivity=50, fire_rating=30, cost_per_unit=20),
    _spec("MAT-MEP-CI-PIPE", "Cast iron pipe", ["ci pipe", "soil pipe", "cast iron soil pipe"],
          "m", MaterialFamily.MEP, density=7200, thermal_conductivity=50, fire_rating=30, cost_per_unit=15),
    _spec("MAT-MEP-PEX-PIPE", "PEX pipe", ["pex tubing", "cross linked polyethylene pipe", "pex piping"],
          "m", MaterialFamily.MEP, density=950, thermal_conductivity=0.4, fire_rating=30, cost_per_unit=6),
    _spec("MAT-MEP-ELEC-CABLE", "Electrical cable", ["power cable", "wiring cable", "electrical wire"],
          "m", MaterialFamily.MEP, density=8960, thermal_conductivity=390, fire_rating=30, cost_per_unit=4),
    _spec("MAT-MEP-VENT-DUCT", "Ventilation duct", ["ventilation", "air ducting", "vent duct"],
          "m", MaterialFamily.MEP, density=7850, thermal_conductivity=50, fire_rating=30, cost_per_unit=19),
]

DEFAULT_MATERIALS: list[MaterialSpec] = (
    _CONCRETE
    + _STEEL
    + _TIMBER
    + _MASONRY
    + _INSULATION
    + _GLAZING
    + _FINISHES
    + _MEMBRANES
    + _MEP
)


# ---------------------------------------------------------------------------
# helpers for search / serialisation
# ---------------------------------------------------------------------------

_PUNCTUATION_RE = re.compile(r"[^\w\s]")
_WHITESPACE_RE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation and collapse whitespace."""
    lowered = text.lower()
    no_punct = _PUNCTUATION_RE.sub(" ", lowered)
    collapsed = _WHITESPACE_RE.sub(" ", no_punct)
    return collapsed.strip()


def _levenshtein(s1: str, s2: str) -> int:
    """Return the edit distance between two strings."""
    if len(s1) < len(s2):
        s1, s2 = s2, s1
    if not s2:
        return len(s1)

    prev_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1, start=1):
        curr_row = [i]
        for j, c2 in enumerate(s2, start=1):
            curr_row.append(
                min(
                    curr_row[j - 1] + 1,
                    prev_row[j] + 1,
                    prev_row[j - 1] + (0 if c1 == c2 else 1),
                )
            )
        prev_row = curr_row
    return prev_row[-1]


def _spec_to_dict(spec: MaterialSpec) -> dict[str, Any]:
    """Convert a spec to a JSON-safe dictionary."""
    return {
        "id": spec.id,
        "name": spec.name,
        "aliases": list(spec.aliases),
        "unit": spec.unit,
        "family": spec.material_family.value,
        "properties": dict(spec.properties),
    }


# ---------------------------------------------------------------------------
# MaterialLibrary
# ---------------------------------------------------------------------------


class MaterialLibrary:
    """Manage a collection of material specifications.

    Parameters
    ----------
    specs:
        Optional starting specs.  When omitted, the built-in
        :data:`DEFAULT_MATERIALS` are loaded automatically.
    """

    __slots__ = ("_specs", "_by_id")

    _specs: list[MaterialSpec]
    _by_id: dict[str, MaterialSpec]

    def __init__(self, specs: list[MaterialSpec] | None = None) -> None:
        if specs is None:
            specs = list(DEFAULT_MATERIALS)
        self._specs: list[MaterialSpec] = []
        self._by_id: dict[str, MaterialSpec] = {}
        for spec in specs:
            self.add_spec(spec)

    # ------------------------------------------------------------------
    # read / write
    # ------------------------------------------------------------------

    def load_from_json(self, path: str) -> None:
        """Replace the current library with specs read from a JSON file."""
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = data.get("materials", data.get("specs", []))
        specs = [MaterialSpec(**self._coerce_spec_dict(item)) for item in data]
        self._replace(specs)

    def load_from_csv(self, path: str) -> None:
        """Replace the current library with specs read from a CSV file."""
        specs: list[MaterialSpec] = []
        with Path(path).open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                specs.append(
                    MaterialSpec(
                        id=row["id"],
                        name=row["name"],
                        aliases=self._parse_json_list(row.get("aliases", "[]")),
                        unit=row.get("unit") or None,
                        material_family=MaterialFamily(row["family"]),
                        properties=self._parse_json_dict(
                            row.get("properties", "{}")
                        ),
                    )
                )
        self._replace(specs)

    def save_to_json(self, path: str) -> None:
        """Persist the current library as JSON."""
        payload = [_spec_to_dict(s) for s in self._specs]
        Path(path).write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    # ------------------------------------------------------------------
    # mutation
    # ------------------------------------------------------------------

    def add_spec(self, spec: MaterialSpec) -> None:
        """Add or replace a single spec by ``spec.id``."""
        if spec.id in self._by_id:
            idx = next(
                i for i, s in enumerate(self._specs) if s.id == spec.id
            )
            self._specs[idx] = spec
        else:
            self._specs.append(spec)
        self._by_id[spec.id] = spec

    def remove_spec(self, spec_id: str) -> None:
        """Remove a spec by id, silently ignoring unknown ids."""
        self._specs = [s for s in self._specs if s.id != spec_id]
        self._by_id.pop(spec_id, None)

    def update_spec(self, spec_id: str, **kwargs: Any) -> None:
        """Update one or more fields on an existing spec."""
        spec = self._by_id.get(spec_id)
        if spec is None:
            raise KeyError(f"Unknown material spec id: {spec_id}")
        updated = spec.model_copy(update=kwargs)
        self.add_spec(updated)

    def merge(
        self,
        other_library: MaterialLibrary,
        overwrite: bool = False,
    ) -> None:
        """Merge another library into this one.

        By default existing ids are preserved.  With ``overwrite=True``,
        specs from *other_library* replace same-id entries here.
        """
        for spec in other_library.get_all_specs():
            if spec.id in self._by_id and not overwrite:
                continue
            self.add_spec(spec)

    # ------------------------------------------------------------------
    # queries
    # ------------------------------------------------------------------

    def get_spec(self, spec_id: str) -> MaterialSpec | None:
        """Return the spec with *spec_id*, or ``None``."""
        return self._by_id.get(spec_id)

    def get_all_specs(self) -> list[MaterialSpec]:
        """Return a copy of all specs in the library."""
        return list(self._specs)

    def get_specs_by_family(self, family: MaterialFamily) -> list[MaterialSpec]:
        """Return every spec in *family*."""
        return [s for s in self._specs if s.material_family == family]

    def search(self, query: str, limit: int = 10) -> list[MaterialSpec]:
        """Fuzzy-search specs by name and aliases.

        Results are ranked by a combination of exact-match status, substring
        proximity, and edit distance, then truncated to *limit*.
        """
        query_norm = _normalize(query)
        if not query_norm:
            return self._specs[:limit]

        scored: list[tuple[float, int, MaterialSpec]] = []
        for idx, spec in enumerate(self._specs):
            candidates = [spec.name, *spec.aliases]
            best_score = 1000.0
            for candidate in candidates:
                candidate_norm = _normalize(candidate)
                if candidate_norm == query_norm:
                    best_score = 0.0
                    break
                distance = _levenshtein(query_norm, candidate_norm)
                if query_norm in candidate_norm:
                    distance = min(distance, 0.0)
                best_score = min(best_score, float(distance))
            scored.append((best_score, idx, spec))

        scored.sort(key=lambda item: (item[0], item[1]))
        return [spec for _score, _idx, spec in scored[:limit]]

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    def _replace(self, specs: list[MaterialSpec]) -> None:
        """Atomically replace the entire library."""
        self._specs = []
        self._by_id = {}
        for spec in specs:
            self.add_spec(spec)

    @staticmethod
    def _coerce_spec_dict(item: dict[str, Any]) -> dict[str, Any]:
        """Normalise a JSON spec dict for :class:`MaterialSpec` construction."""
        family = item.get("family", item.get("material_family", "OTHER"))
        if isinstance(family, MaterialFamily):
            family = family.value
        return {
            "id": item["id"],
            "name": item["name"],
            "aliases": item.get("aliases", []),
            "unit": item.get("unit"),
            "material_family": family,
            "properties": item.get("properties", {}),
        }

    @staticmethod
    def _parse_json_list(raw: str) -> list[str]:
        try:
            value = json.loads(raw)
            return value if isinstance(value, list) else []
        except (json.JSONDecodeError, TypeError):
            return []

    @staticmethod
    def _parse_json_dict(raw: str) -> dict[str, Any]:
        try:
            value = json.loads(raw)
            return value if isinstance(value, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}


__all__ = [
    "DEFAULT_MATERIALS",
    "MaterialLibrary",
]
