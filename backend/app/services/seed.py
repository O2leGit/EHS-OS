"""Seed database with Helix BioWorks demo data."""
import asyncio
import json
from datetime import date, timedelta
from app.core.database import get_pool, init_db
from app.core.auth import hash_password


async def seed():
    await init_db()
    pool = await get_pool()
    async with pool.acquire() as db:
        # Delete existing demo data and reseed
        existing = await db.fetchrow("SELECT id FROM tenants WHERE slug = 'helix-bioworks'")
        if existing:
            tid_old = existing["id"]
            await db.execute("DELETE FROM chat_messages WHERE tenant_id = $1", tid_old)
            await db.execute("DELETE FROM document_analyses WHERE tenant_id = $1", tid_old)
            await db.execute("DELETE FROM capas WHERE tenant_id = $1", tid_old)
            await db.execute("DELETE FROM incidents WHERE tenant_id = $1", tid_old)
            await db.execute("DELETE FROM documents WHERE tenant_id = $1", tid_old)
            await db.execute("DELETE FROM prompt_templates WHERE tenant_id = $1", tid_old)
            await db.execute("DELETE FROM users WHERE tenant_id = $1", tid_old)
            await db.execute("DELETE FROM tenants WHERE id = $1", tid_old)
            print("Cleared old demo data, reseeding...")

        # Create tenant
        tenant = await db.fetchrow(
            """INSERT INTO tenants (name, slug)
               VALUES ('Helix BioWorks', 'helix-bioworks') RETURNING id"""
        )
        tid = tenant["id"]

        # Create users
        admin = await db.fetchrow(
            """INSERT INTO users (tenant_id, email, password_hash, full_name, role)
               VALUES ($1, 'admin@helixbioworks.com', $2, 'Sarah Chen', 'admin') RETURNING id""",
            tid, hash_password("demo123"),
        )
        manager = await db.fetchrow(
            """INSERT INTO users (tenant_id, email, password_hash, full_name, role)
               VALUES ($1, 'jparker@helixbioworks.com', $2, 'James Parker', 'manager') RETURNING id""",
            tid, hash_password("demo123"),
        )
        user = await db.fetchrow(
            """INSERT INTO users (tenant_id, email, password_hash, full_name, role)
               VALUES ($1, 'mrodriguez@helixbioworks.com', $2, 'Maria Rodriguez', 'user') RETURNING id""",
            tid, hash_password("demo123"),
        )

        # Create incidents
        incidents_data = [
            ("injury", "high", "Chemical splash during transfer", "Lab technician received minor chemical splash to forearm during solvent transfer. First aid administered on-site. PPE (goggles, gloves) were worn but lab coat sleeve was rolled up.", "Building A - Lab 201", "Maria Rodriguez"),
            ("near_miss", "medium", "Unsecured gas cylinder in hallway", "Nitrogen gas cylinder found unsecured in Building B corridor during routine walkthrough. Cylinder was upright but not chained to wall mount.", "Building B - Corridor 2", "James Parker"),
            ("hazard", "high", "Fume hood airflow below threshold", "Annual fume hood certification found Hood #3 in Lab 105 operating at 85 fpm face velocity. Minimum required is 100 fpm per OSHA 29 CFR 1910.1450.", "Building A - Lab 105", "Sarah Chen"),
            ("environmental", "medium", "Waste satellite area exceeding 55-gallon limit", "Weekly inspection found satellite accumulation area in Lab 302 with approximately 70 gallons of hazardous waste. RCRA limit is 55 gallons.", "Building A - Lab 302", "Maria Rodriguez"),
            ("near_miss", "low", "Tripping hazard from extension cord", "Extension cord running across walkway in office area near Lab 201 entrance. No incident occurred but multiple staff reported near-trips.", "Building A - Office Area", "Anonymous"),
            ("observation", "low", "Emergency shower not tested monthly", "Review of maintenance logs shows Building B emergency shower/eyewash stations have not been tested since January.", "Building B - All Floors", "James Parker"),
            ("injury", "medium", "Ergonomic strain from repetitive pipetting", "Research associate reporting wrist pain after extended pipetting session (4+ hours). Referred to occupational health.", "Building A - Lab 203", "Anonymous"),
        ]

        incident_ids = []
        for i, (itype, sev, title, desc, loc, reporter) in enumerate(incidents_data):
            row = await db.fetchrow(
                """INSERT INTO incidents (tenant_id, incident_number, incident_type, severity, title,
                                          description, location, reported_by, status, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '%s days')
                   RETURNING id""" % (30 - i * 4),
                tid, f"INC-{i+1:04d}", itype, sev, title, desc, loc, reporter,
                "open" if i < 4 else "closed",
            )
            incident_ids.append(row["id"])

        # Create CAPAs linked to incidents
        capas_data = [
            (0, "Implement chemical transfer SOP update", "corrective", "high", "in_progress", 14, "Update chemical transfer SOP to require full PPE including buttoned lab coat. Add to training curriculum."),
            (1, "Install gas cylinder restraints in Building B", "corrective", "medium", "open", 7, "Purchase and install wall-mounted cylinder restraints for all corridor locations in Building B."),
            (2, "Repair fume hood #3 - Lab 105", "corrective", "critical", "open", 3, "Contact vendor for fume hood motor/blower repair. Hood is currently tagged out of service."),
            (3, "Reduce satellite waste accumulation", "corrective", "high", "in_progress", 10, "Schedule additional hazardous waste pickup. Retrain lab staff on 55-gallon satellite area limits."),
            (2, "Implement quarterly fume hood verification", "preventive", "medium", "open", 30, "Establish quarterly internal fume hood checks between annual certifications."),
            (5, "Establish monthly safety equipment testing schedule", "preventive", "medium", "open", 21, "Create monthly checklist for emergency shower/eyewash testing across all buildings."),
        ]

        for inc_idx, title, ctype, priority, status, days_due, desc in capas_data:
            await db.execute(
                """INSERT INTO capas (tenant_id, incident_id, capa_number, title, description,
                                      capa_type, status, priority, assigned_to, due_date)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
                tid, incident_ids[inc_idx],
                f"CAPA-{capas_data.index((inc_idx, title, ctype, priority, status, days_due, desc))+1:04d}",
                title, desc, ctype, status, priority, manager["id"],
                date.today() + timedelta(days=days_due),
            )

        # Create pre-analyzed document data (simulating already-ingested documents)
        framework_data = [
            ("1", "Corporate EHS Policy", None, "covered"),
            ("2", "Governance Structure", None, "covered"),
            ("2", "PDCA Methodology", None, "partial"),
            ("2", "Roles and Responsibilities", None, "covered"),
            ("3", "Leadership and Commitment", "100", "covered"),
            ("3", "Planning", "100", "partial"),
            ("3", "Performance Evaluation", "100", "gap"),
            ("3", "Improvement", "100", "partial"),
            ("3", "Chemical Safety", "200", "covered"),
            ("3", "Biosafety", "200", "covered"),
            ("3", "Radiation Safety", "200", "gap"),
            ("3", "Ergonomics", "200", "gap"),
            ("3", "Fire and Life Safety", "200", "partial"),
            ("3", "Incident Management", "300", "covered"),
            ("3", "Training", "300", "partial"),
            ("3", "Emergency Preparedness", "300", "covered"),
            ("3", "Auditing", "300", "gap"),
            ("3", "Business Continuity", "400", "gap"),
            ("3", "Crisis Management", "400", "gap"),
            ("3", "Security", "400", "partial"),
        ]

        # Create a fake analyzed document
        doc = await db.fetchrow(
            """INSERT INTO documents (tenant_id, filename, file_path, file_type, file_size, uploaded_by, status)
               VALUES ($1, 'Helix_BioWorks_EHS_Manual_2024.pdf', '/seed/manual.pdf', '.pdf', 2048000, $2, 'analyzed')
               RETURNING id""",
            tid, admin["id"],
        )

        for tier, category, series, status in framework_data:
            gaps = []
            risk = None
            reasoning = f"{'Fully addressed' if status == 'covered' else 'Partially addressed' if status == 'partial' else 'Not found'} in company EHS manual."
            if status == "gap":
                gaps = [f"No documentation found for {category}"]
                risk = "high" if tier == "3" and series in ("200", "300") else "medium"
                reasoning = f"No documentation covering {category} was found in the uploaded materials. This represents a gap in the EHS management system."
            elif status == "partial":
                gaps = [f"{category} mentioned but lacks specific procedures"]
                risk = "medium"

            await db.execute(
                """INSERT INTO document_analyses
                   (document_id, tenant_id, chunk_index, chunk_text, document_type,
                    framework_tier, framework_category, framework_series,
                    coverage_status, gaps, risk_severity, ai_reasoning)
                   VALUES ($1, $2, 0, $3, 'manual', $4, $5, $6, $7, $8, $9, $10)""",
                doc["id"], tid, f"[Seed data for {category}]",
                tier, category, series, status, json.dumps(gaps), risk, reasoning,
            )

        # Seed default prompt templates
        await db.execute(
            """INSERT INTO prompt_templates (tenant_id, name, template)
               VALUES ($1, 'document_analysis', $2)""",
            tid, "Analyze this document chunk against the Pfizer 4-Tier EHS framework...",
        )

        print("Seeded Helix BioWorks demo data successfully!")
        print("  Login: admin@helixbioworks.com / demo123")
        print("  Login: jparker@helixbioworks.com / demo123")
        print("  Login: mrodriguez@helixbioworks.com / demo123")


if __name__ == "__main__":
    asyncio.run(seed())
