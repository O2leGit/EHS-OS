from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()

TEMPLATES = [
    {
        "name": "Fire Extinguisher Monthly",
        "category": "Fire Safety",
        "items": [
            "Extinguisher is in designated location",
            "Access is not blocked or obstructed",
            "Pressure gauge in green zone",
            "Pin and tamper seal intact",
            "No visible damage, corrosion, or leakage",
            "Inspection tag is current",
            "Operating instructions legible and facing outward",
            "Hose and nozzle in good condition",
        ],
    },
    {
        "name": "Forklift Pre-Use",
        "category": "Equipment",
        "items": [
            "Tires in good condition, no damage",
            "Forks straight, not cracked or worn",
            "Fluid levels OK (oil, hydraulic, coolant)",
            "Horn, lights, and backup alarm functional",
            "Brakes (service and parking) working",
            "Seat belt functional",
            "Steering responds correctly",
            "No fluid leaks under vehicle",
            "Load backrest and overhead guard secure",
            "Battery connections tight and clean",
        ],
    },
    {
        "name": "PPE Stock Check",
        "category": "PPE",
        "items": [
            "Safety glasses available in all required sizes",
            "Nitrile gloves stocked (S, M, L, XL)",
            "Hearing protection available",
            "Hard hats inspected and available",
            "Face shields clean and undamaged",
            "Respirator cartridges in date",
            "Safety vests available",
            "Steel-toe boot covers available",
        ],
    },
    {
        "name": "Eyewash Station Weekly",
        "category": "Emergency Equipment",
        "items": [
            "Station is accessible within 10 seconds",
            "Area around station clear of obstructions",
            "Dust covers in place",
            "Water flows from both nozzles",
            "Water is clear (flushed for 3 minutes)",
            "Sign is visible and unobstructed",
            "Inspection tag updated",
        ],
    },
    {
        "name": "First Aid Kit",
        "category": "Emergency Equipment",
        "items": [
            "Kit is in designated location",
            "Kit is easily accessible",
            "Adhesive bandages stocked",
            "Gauze pads and rolls available",
            "Antiseptic wipes present",
            "Medical tape available",
            "Scissors and tweezers present",
            "Gloves (nitrile) stocked",
            "Cold packs available",
            "All items within expiration date",
        ],
    },
    {
        "name": "Housekeeping Audit",
        "category": "General Safety",
        "items": [
            "Floors clean and dry, no slip hazards",
            "Walkways and aisles clear",
            "Trash and recycling emptied regularly",
            "Spill kits available and stocked",
            "Storage areas organized",
            "No tripping hazards (cords, hoses)",
            "Lighting adequate in all areas",
            "Restrooms clean and stocked",
            "Break areas clean and sanitary",
        ],
    },
    {
        "name": "Ladder Inspection",
        "category": "Equipment",
        "items": [
            "Rails straight, no bending or damage",
            "Rungs tight, no missing or loose rungs",
            "Feet/shoes present and in good condition",
            "Spreader bars lock properly (stepladder)",
            "No corrosion or deterioration",
            "Labels legible (weight rating, warnings)",
            "Rope and pulley functional (extension ladder)",
            "No modifications or repairs attempted",
        ],
    },
    {
        "name": "Chemical Storage",
        "category": "Hazmat",
        "items": [
            "SDS sheets available for all chemicals",
            "Incompatible chemicals stored separately",
            "All containers properly labeled",
            "Secondary containment in place",
            "Ventilation adequate",
            "Flammable storage cabinet used correctly",
            "Spill kit nearby and stocked",
            "No expired chemicals on shelves",
            "Eye wash within 10 seconds travel",
            "PPE available at storage area",
        ],
    },
    {
        "name": "Emergency Exit",
        "category": "Fire Safety",
        "items": [
            "Exit signs illuminated and visible",
            "Exit doors open freely",
            "Exit path clear of obstructions",
            "Emergency lighting functional",
            "Evacuation maps posted and current",
            "Assembly point signs visible",
            "Door hardware in working condition",
            "No storage blocking exit routes",
        ],
    },
    {
        "name": "Electrical Panel Clearance",
        "category": "Electrical Safety",
        "items": [
            "36-inch clearance maintained in front",
            "Panel door closes and latches properly",
            "All breakers labeled correctly",
            "No signs of overheating or burn marks",
            "No exposed wiring",
            "Cover plate intact, no missing knockouts",
            "Area is dry, no water sources nearby",
            "Warning signs posted",
        ],
    },
]


class InspectionCreate(BaseModel):
    template_name: str
    inspector_name: Optional[str] = None
    site_id: Optional[str] = None
    status: str = "in_progress"
    score: Optional[int] = None
    total_items: Optional[int] = None
    passed_items: Optional[int] = None
    failed_items: Optional[int] = None
    notes: Optional[str] = None


@router.get("/templates")
async def list_templates(current_user: dict = Depends(get_current_user)):
    return TEMPLATES


@router.get("/")
async def list_inspections(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        return []
    rows = await db.fetch(
        """SELECT id, site_id, template_name, inspector_name, status,
                  score, total_items, passed_items, failed_items, notes,
                  completed_at, created_at
           FROM inspections WHERE tenant_id = $1::uuid
           ORDER BY created_at DESC""",
        tenant_id,
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_inspection(body: InspectionCreate, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        return {"error": "No tenant context"}

    completed_at = "NOW()" if body.status == "completed" else None

    row = await db.fetchrow(
        """INSERT INTO inspections (tenant_id, site_id, template_name, inspector_name,
                  status, score, total_items, passed_items, failed_items, notes, completed_at)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                   CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END)
           RETURNING id, template_name, status, created_at""",
        tenant_id,
        body.site_id,
        body.template_name,
        body.inspector_name or current_user.get("full_name", "Unknown"),
        body.status,
        body.score,
        body.total_items,
        body.passed_items,
        body.failed_items,
        body.notes,
    )
    return dict(row)
