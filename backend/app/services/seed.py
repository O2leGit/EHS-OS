"""Seed database with Helix BioWorks demo data."""
import asyncio
import json
from datetime import date, datetime, timedelta, timezone
from app.core.database import get_pool, init_db
from app.core.auth import hash_password


async def seed():
    await init_db()
    pool = await get_pool()
    async with pool.acquire() as db:
        existing = await db.fetchrow("SELECT id FROM tenants WHERE slug = 'helix-bioworks'")
        if existing:
            print("Demo data already exists, skipping seed.")
            # Always run reseed to keep data fresh
            await reseed_demo_data(db)
            return

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

        for idx, (inc_idx, title, ctype, priority, status, days_due, desc) in enumerate(capas_data):
            await db.execute(
                """INSERT INTO capas (tenant_id, incident_id, capa_number, title, description,
                                      capa_type, status, priority, assigned_to, due_date)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
                tid, incident_ids[inc_idx],
                f"CAPA-{idx+1:04d}",
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

        # Run reseed to apply enrichments
        await reseed_demo_data(db)


async def reseed_demo_data(db):
    """Update existing demo data with enriched content. Idempotent -- safe to run multiple times."""

    today = date.today()
    now = datetime.now(timezone.utc)

    # --- Resolve tenant and user IDs ---
    tenant = await db.fetchrow("SELECT id FROM tenants WHERE slug = 'helix-bioworks'")
    if not tenant:
        print("reseed: No helix-bioworks tenant found, skipping.")
        return
    tid = tenant["id"]

    admin = await db.fetchrow("SELECT id FROM users WHERE email = 'admin@helixbioworks.com'")
    manager = await db.fetchrow("SELECT id FROM users WHERE email = 'jparker@helixbioworks.com'")
    user = await db.fetchrow("SELECT id FROM users WHERE email = 'mrodriguez@helixbioworks.com'")

    if not all([admin, manager, user]):
        print("reseed: Missing user accounts, skipping.")
        return

    admin_id = admin["id"]
    manager_id = manager["id"]
    user_id = user["id"]

    # =========================================================================
    # Fix 4: Spread incidents across 6 months
    # =========================================================================
    incident_offsets = {
        "INC-0001": 160,  # ~Oct
        "INC-0002": 122,  # ~Nov
        "INC-0003": 88,   # ~Dec
        "INC-0004": 64,   # ~Jan
        "INC-0005": 42,   # ~Feb
        "INC-0006": 10,   # recent
        "INC-0007": 6,    # recent
    }

    for inc_num, days_ago in incident_offsets.items():
        ts = now - timedelta(days=days_ago)
        await db.execute(
            "UPDATE incidents SET created_at = $1 WHERE tenant_id = $2 AND incident_number = $3",
            ts, tid, inc_num,
        )

    # =========================================================================
    # Fix 2: Redistribute CAPA assignments
    # =========================================================================
    capa_assignments = {
        "CAPA-0001": admin_id,   # Sarah Chen
        "CAPA-0005": admin_id,   # Sarah Chen
        "CAPA-0004": user_id,    # Maria Rodriguez
        "CAPA-0006": user_id,    # Maria Rodriguez
        "CAPA-0002": manager_id, # James Parker (no change)
        "CAPA-0003": manager_id, # James Parker (no change)
    }

    for capa_num, assigned_id in capa_assignments.items():
        await db.execute(
            "UPDATE capas SET assigned_to = $1 WHERE tenant_id = $2 AND capa_number = $3",
            assigned_id, tid, capa_num,
        )

    # =========================================================================
    # Fix 3: Create overdue CAPAs
    # =========================================================================
    await db.execute(
        "UPDATE capas SET due_date = $1 WHERE tenant_id = $2 AND capa_number = 'CAPA-0003'",
        today - timedelta(days=5), tid,
    )
    await db.execute(
        "UPDATE capas SET due_date = $1 WHERE tenant_id = $2 AND capa_number = 'CAPA-0002'",
        today - timedelta(days=2), tid,
    )

    # =========================================================================
    # Fix 4 (cont): Update CAPA created_at to 2 days after linked incident
    # =========================================================================
    # CAPA -> incident_number mapping (from original seed):
    # CAPA-0001 -> INC-0001, CAPA-0002 -> INC-0002, CAPA-0003 -> INC-0003
    # CAPA-0004 -> INC-0004, CAPA-0005 -> INC-0003, CAPA-0006 -> INC-0006
    capa_incident_map = {
        "CAPA-0001": "INC-0001",
        "CAPA-0002": "INC-0002",
        "CAPA-0003": "INC-0003",
        "CAPA-0004": "INC-0004",
        "CAPA-0005": "INC-0003",
        "CAPA-0006": "INC-0006",
    }

    for capa_num, inc_num in capa_incident_map.items():
        days_ago = incident_offsets.get(inc_num, 0)
        capa_ts = now - timedelta(days=days_ago - 2)  # 2 days after incident
        await db.execute(
            "UPDATE capas SET created_at = $1 WHERE tenant_id = $2 AND capa_number = $3",
            capa_ts, tid, capa_num,
        )

    # =========================================================================
    # Fix 1: Add 4 more sample documents with framework coverage
    # =========================================================================
    new_docs = [
        {
            "filename": "Helix_BioWorks_Chemical_Hygiene_Plan_2025.pdf",
            "file_path": "/seed/chemical_hygiene.pdf",
            "file_type": ".pdf",
            "file_size": 1536000,
            "analyses": [
                {
                    "tier": "3", "category": "Chemical Safety", "series": "200",
                    "status": "covered",
                    "reasoning": "Chemical Hygiene Plan (2025) provides comprehensive coverage: written HazCom program (Section 2), SDS access procedures (Section 3), container labeling requirements (Section 4), chemical-specific SOPs for high-hazard materials (Section 6), and annual chemical inventory reconciliation (Section 8). Meets OSHA 29 CFR 1910.1200 and 29 CFR 1910.1450 requirements.",
                },
                {
                    "tier": "3", "category": "Fire and Life Safety", "series": "200",
                    "status": "covered",
                    "reasoning": "Emergency Action Plan covers evacuation procedures, assembly points, fire extinguisher locations and inspection schedules, and emergency notification chain. EHS Manual Section 7 adds hot work permit procedures. Chemical Hygiene Plan adds chemical spill fire response.",
                },
                {
                    "tier": "3", "category": "Training", "series": "300",
                    "status": "covered",
                    "reasoning": "Training Matrix Q1 2026 documents required training by role: new hire orientation, chemical hygiene, biosafety, bloodborne pathogens, hazardous waste, emergency response, and job-specific SOPs. Includes completion tracking and recertification schedules.",
                },
            ],
        },
        {
            "filename": "Helix_BioWorks_Emergency_Action_Plan_2024.pdf",
            "file_path": "/seed/emergency_action.pdf",
            "file_type": ".pdf",
            "file_size": 892000,
            "analyses": [
                {
                    "tier": "3", "category": "Business Continuity", "series": "400",
                    "status": "partial",
                    "gaps": ["No business impact analysis", "No recovery time objectives defined", "No alternate operations plan"],
                    "reasoning": "Emergency Action Plan addresses facility evacuation and immediate emergency response but does not cover business continuity elements: critical process identification, recovery time objectives, alternate facility plans, or IT disaster recovery.",
                },
                {
                    "tier": "3", "category": "Crisis Management", "series": "400",
                    "status": "partial",
                    "gaps": ["No media communication protocol", "No crisis decision authority matrix", "No post-crisis review process"],
                    "reasoning": "Emergency Action Plan includes emergency notification chain and external agency contacts. Does not address broader crisis management: media communication protocols, executive decision authority during crisis, stakeholder notification procedures.",
                },
            ],
        },
        {
            "filename": "Helix_BioWorks_Waste_Management_SOP_2025.pdf",
            "file_path": "/seed/waste_management.pdf",
            "file_type": ".pdf",
            "file_size": 724000,
            "analyses": [
                {
                    "tier": "3", "category": "Auditing", "series": "300",
                    "status": "partial",
                    "gaps": ["No comprehensive internal EHS audit program", "No audit schedule or checklist templates", "No audit finding tracking process"],
                    "reasoning": "Waste Management SOP includes quarterly waste accumulation area audit procedures. No broader internal EHS audit program documented.",
                },
                {
                    "tier": "3", "category": "Performance Evaluation", "series": "100",
                    "status": "partial",
                    "gaps": ["No defined EHS KPI framework", "No benchmark targets set", "No formal management review of EHS performance data"],
                    "reasoning": "Waste Management SOP includes monthly waste volume tracking and quarterly trend analysis. No broader EHS performance evaluation program.",
                },
            ],
        },
        {
            "filename": "Helix_BioWorks_Training_Matrix_Q1_2026.xlsx",
            "file_path": "/seed/training_matrix.xlsx",
            "file_type": ".xlsx",
            "file_size": 256000,
            "analyses": [
                {
                    "tier": "3", "category": "Planning", "series": "100",
                    "status": "covered",
                    "reasoning": "Training Matrix Q1 2026 includes training schedule with completion tracking, demonstrating planning evidence per ISO 45001 Clause 6.",
                },
            ],
        },
    ]

    for doc_info in new_docs:
        # Check if document already exists
        existing_doc = await db.fetchrow(
            "SELECT id FROM documents WHERE tenant_id = $1 AND filename = $2",
            tid, doc_info["filename"],
        )
        if existing_doc:
            doc_id = existing_doc["id"]
        else:
            row = await db.fetchrow(
                """INSERT INTO documents (tenant_id, filename, file_path, file_type, file_size, uploaded_by, status)
                   VALUES ($1, $2, $3, $4, $5, $6, 'analyzed') RETURNING id""",
                tid, doc_info["filename"], doc_info["file_path"],
                doc_info["file_type"], doc_info["file_size"], admin_id,
            )
            doc_id = row["id"]

        for analysis in doc_info["analyses"]:
            gaps = analysis.get("gaps", [])
            risk = None
            if analysis["status"] == "partial":
                risk = "medium"
            elif analysis["status"] == "gap":
                risk = "high"

            # Update existing analysis for this category if it exists (from the original doc)
            existing_analysis = await db.fetchrow(
                """SELECT id FROM document_analyses
                   WHERE tenant_id = $1 AND framework_category = $2
                   AND framework_series IS NOT DISTINCT FROM $3""",
                tid, analysis["category"], analysis.get("series"),
            )

            if existing_analysis:
                # Update the existing row with new coverage status and reasoning
                await db.execute(
                    """UPDATE document_analyses
                       SET coverage_status = $1, gaps = $2, risk_severity = $3, ai_reasoning = $4
                       WHERE id = $5""",
                    analysis["status"], json.dumps(gaps), risk, analysis["reasoning"],
                    existing_analysis["id"],
                )
            else:
                # Insert new analysis row for this document
                await db.execute(
                    """INSERT INTO document_analyses
                       (document_id, tenant_id, chunk_index, chunk_text, document_type,
                        framework_tier, framework_category, framework_series,
                        coverage_status, gaps, risk_severity, ai_reasoning)
                       VALUES ($1, $2, 0, $3, 'manual', $4, $5, $6, $7, $8, $9, $10)""",
                    doc_id, tid, f"[Seed data for {analysis['category']}]",
                    analysis["tier"], analysis["category"], analysis.get("series"),
                    analysis["status"], json.dumps(gaps), risk, analysis["reasoning"],
                )

    # =========================================================================
    # Fix 5: Update AI reasoning for ALL existing framework categories
    # =========================================================================
    enriched_reasoning = {
        ("Corporate EHS Policy", None): {
            "status": "covered",
            "gaps": [],
            "risk": None,
            "reasoning": "Section 1 of the Helix BioWorks EHS Manual establishes corporate EHS policy with signed leadership commitment, scope across all facilities, and annual review commitment. Meets ISO 45001 Clause 5.2 requirements.",
        },
        ("Governance Structure", None): {
            "status": "covered",
            "gaps": [],
            "risk": None,
            "reasoning": "Section 2 of the EHS Manual defines governance with EHS Director reporting to VP Operations, site safety officers at each location, and EHS Committee charter with quarterly meeting cadence.",
        },
        ("PDCA Methodology", None): {
            "status": "partial",
            "gaps": ["No formal management review schedule documented", "No defined triggers for corrective action from review findings"],
            "risk": "medium",
            "reasoning": "EHS Manual Section 3 references Plan-Do-Check-Act cycle conceptually but lacks specific procedures for the Check and Act phases.",
        },
        ("Roles and Responsibilities", None): {
            "status": "covered",
            "gaps": [],
            "risk": None,
            "reasoning": "EHS Manual Section 2.3 defines roles: EHS Director, Site Safety Officers, Lab Managers, and all employees with specific accountability statements.",
        },
        ("Leadership and Commitment", "100"): {
            "status": "covered",
            "gaps": [],
            "risk": None,
            "reasoning": "EHS Manual Section 1 includes signed statement from CEO, resource commitment, and leadership review obligations.",
        },
        ("Improvement", "100"): {
            "status": "partial",
            "gaps": ["Improvement mentioned but lacks specific procedures"],
            "risk": "medium",
            "reasoning": "EHS Manual Section 9 describes continuous improvement philosophy but lacks structured improvement methodology and documented improvement projects.",
        },
        ("Biosafety", "200"): {
            "status": "covered",
            "gaps": [],
            "risk": None,
            "reasoning": "EHS Manual Section 5 covers BSL-1 and BSL-2 operations including biological risk assessment procedures, biosafety cabinet certification schedules, autoclave validation, and bloodborne pathogen exposure control plan per OSHA 29 CFR 1910.1030.",
        },
        ("Radiation Safety", "200"): {
            "status": "gap",
            "gaps": ["No radiation safety program (appropriate if no radiation sources present)"],
            "risk": "low",
            "reasoning": "No documentation found addressing radiation safety. Helix BioWorks does not currently operate radiation-producing equipment. If operations expand to include isotope work, a Radiation Safety Program per 10 CFR 20 will be needed.",
        },
        ("Ergonomics", "200"): {
            "status": "gap",
            "gaps": ["No ergonomics assessment program", "No workstation evaluation procedures", "Active injury (INC-0007) demonstrates uncontrolled risk"],
            "risk": "high",
            "reasoning": "No ergonomics program documented. INC-0007 (ergonomic strain from repetitive pipetting) indicates this is an active risk. Repetitive motion injuries from pipetting are the #1 ergonomic hazard in life sciences laboratories.",
        },
        ("Incident Management", "300"): {
            "status": "covered",
            "gaps": [],
            "risk": None,
            "reasoning": "EHS Manual Section 8 establishes incident reporting procedures, investigation methodology (5-Why analysis), OSHA recordkeeping requirements (300/300A/301), and return-to-work protocols. 7 incidents currently tracked in system.",
        },
        ("Emergency Preparedness", "300"): {
            "status": "covered",
            "gaps": [],
            "risk": None,
            "reasoning": "Emergency Action Plan covers: evacuation procedures for fire, chemical spill, severe weather, and active threat; assembly point locations; emergency contact list; medical emergency response including first aid and AED locations.",
        },
        ("Security", "400"): {
            "status": "partial",
            "gaps": ["No cybersecurity provisions for EHS data systems", "No physical security assessment program"],
            "risk": "medium",
            "reasoning": "EHS Manual Section 10 covers facility access control (badge system), visitor management, and controlled substance storage security. Does not address cybersecurity for EHS systems or physical security assessments.",
        },
    }

    for (category, series), data in enriched_reasoning.items():
        await db.execute(
            """UPDATE document_analyses
               SET coverage_status = $1, gaps = $2, risk_severity = $3, ai_reasoning = $4
               WHERE tenant_id = $5 AND framework_category = $6
               AND framework_series IS NOT DISTINCT FROM $7""",
            data["status"], json.dumps(data["gaps"]), data.get("risk"),
            data["reasoning"], tid, category, series,
        )

    # =========================================================================
    # Fix 7: Add 13 more incidents (INC-0008 through INC-0020)
    # =========================================================================
    new_incidents = [
        ("INC-0008", "near_miss", "low", "Unlabeled secondary container in Lab 201 fridge", "Unlabeled secondary container found in Lab 201 refrigerator during routine inspection. Container held approximately 200mL of clear liquid. Contents identified as buffer solution after investigation.", "Building A - Lab 201", "Maria Rodriguez", "closed", 143),
        ("INC-0009", "hazard", "medium", "Biosafety cabinet annual certification expired for BSC-4", "BSC-4 in Lab 301 found with expired annual certification during scheduled equipment review. Cabinet was last certified 14 months ago. Certification is required annually per NSF/ANSI 49.", "Building B - Lab 301", "James Parker", "closed", 135),
        ("INC-0010", "near_miss", "low", "Chemical splash shield cracked on fume hood #2", "Cracked splash shield discovered on fume hood #2 during pre-use inspection. Shield has a 6-inch crack along the lower edge that could compromise containment during spill events.", "Building A - Lab 105", "Sarah Chen", "closed", 110),
        ("INC-0011", "injury", "low", "Paper cut during SDS binder organization", "Staff member received minor paper cut while organizing SDS binders. First aid administered (bandage applied). No medical treatment required.", "Building A - Office Area", "Anonymous", "closed", 102),
        ("INC-0012", "observation", "low", "PPE disposal bin overflowing outside Lab 302", "PPE disposal bin outside Lab 302 observed overflowing with used gloves and disposable gowns. Waste management notified for additional pickup.", "Building A - Lab 302", "Maria Rodriguez", "closed", 76),
        ("INC-0013", "near_miss", "medium", "Pipette tip box fell from overhead shelf onto bench", "Box of pipette tips fell from overhead shelf onto workbench in Lab 203. No personnel were struck. Shelf brackets found to be loose.", "Building A - Lab 203", "Anonymous", "closed", 57),
        ("INC-0014", "hazard", "medium", "Eyewash station blocked by equipment storage", "Emergency eyewash station in Lab 301 found blocked by temporarily stored centrifuge equipment. Access path was completely obstructed.", "Building B - Lab 301", "James Parker", "open", 37),
        ("INC-0015", "near_miss", "low", "Wet floor near autoclave with no warning sign", "Wet floor observed near autoclave area in Building B corridor. No wet floor sign posted. Condensation from autoclave cooling cycle was the source.", "Building B - Corridor 1", "Sarah Chen", "closed", 29),
        ("INC-0016", "injury", "medium", "Thumb strain from repetitive micropipette use", "Research associate reporting persistent thumb pain after extended micropipetting sessions over two weeks. Referred to occupational health for evaluation.", "Building A - Lab 203", "Maria Rodriguez", "open", 18),
        ("INC-0017", "environmental", "low", "Drain near loading dock has chemical residue", "Chemical residue observed around floor drain near loading dock. Residue appears to be from cleaning solution runoff. Sample collected for analysis.", "Building B - Exterior", "James Parker", "open", 12),
        ("INC-0018", "near_miss", "medium", "Glass beaker shattered during cleaning, fragments on floor", "500mL glass beaker shattered during cleaning at sink station in Lab 201. Glass fragments scattered across floor area. Area cordoned off and cleaned per glass breakage SOP.", "Building A - Lab 201", "Anonymous", "open", 4),
        ("INC-0019", "observation", "low", "Fire extinguisher inspection tag shows last check 14 months ago", "Monthly fire extinguisher inspection found unit in Building B Corridor 2 with inspection tag showing last check was 14 months prior. Unit appears functional but out of compliance.", "Building B - Corridor 2", "Sarah Chen", "open", 1),
        ("INC-0020", "hazard", "high", "Compressed gas manifold regulator leaking", "Audible gas leak detected at compressed nitrogen manifold regulator in Lab 105. Area evacuated and ventilation increased. Gas supply shut off at main valve pending repair.", "Building A - Lab 105", "James Parker", "open", 0),
    ]

    new_incident_ids = {}
    for inc_num, itype, sev, title, desc, loc, reporter, status, days_ago in new_incidents:
        existing_inc = await db.fetchrow(
            "SELECT id FROM incidents WHERE tenant_id = $1 AND incident_number = $2",
            tid, inc_num,
        )
        if existing_inc:
            # Update timestamp
            ts = now - timedelta(days=days_ago)
            await db.execute(
                "UPDATE incidents SET created_at = $1 WHERE id = $2",
                ts, existing_inc["id"],
            )
            new_incident_ids[inc_num] = existing_inc["id"]
        else:
            ts = now - timedelta(days=days_ago)
            row = await db.fetchrow(
                """INSERT INTO incidents (tenant_id, incident_number, incident_type, severity, title,
                                          description, location, reported_by, status, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id""",
                tid, inc_num, itype, sev, title, desc, loc, reporter, status, ts,
            )
            new_incident_ids[inc_num] = row["id"]

    # =========================================================================
    # Fix 7 (cont): Add 3 new CAPAs
    # =========================================================================
    new_capas = [
        ("CAPA-0007", "INC-0020", "Emergency inspection of all compressed gas systems", "corrective", "critical", "open", admin_id, 2,
         "Immediate inspection of all compressed gas manifolds, regulators, and cylinder connections across both buildings. Replace any components showing wear or damage."),
        ("CAPA-0008", "INC-0016", "Ergonomic assessment for pipetting-intensive roles", "corrective", "high", "open", user_id, 12,
         "Conduct ergonomic assessments for all roles involving >2 hours daily pipetting. Evaluate electronic pipettes, ergonomic grips, and rotation schedules."),
        ("CAPA-0009", "INC-0014", "Building B safety equipment access audit", "corrective", "medium", "open", manager_id, 16,
         "Audit all emergency safety equipment (eyewash stations, safety showers, fire extinguishers, first aid kits) in Building B for accessibility and clear access paths."),
    ]

    for capa_num, inc_num, title, ctype, priority, status, assigned_to, days_due, desc in new_capas:
        existing_capa = await db.fetchrow(
            "SELECT id FROM capas WHERE tenant_id = $1 AND capa_number = $2",
            tid, capa_num,
        )
        if existing_capa:
            # Update existing
            inc_id = new_incident_ids.get(inc_num)
            if not inc_id:
                inc_row = await db.fetchrow(
                    "SELECT id FROM incidents WHERE tenant_id = $1 AND incident_number = $2",
                    tid, inc_num,
                )
                inc_id = inc_row["id"] if inc_row else None
            await db.execute(
                """UPDATE capas SET assigned_to = $1, due_date = $2, priority = $3
                   WHERE id = $4""",
                assigned_to, today + timedelta(days=days_due), priority, existing_capa["id"],
            )
        else:
            inc_id = new_incident_ids.get(inc_num)
            if not inc_id:
                inc_row = await db.fetchrow(
                    "SELECT id FROM incidents WHERE tenant_id = $1 AND incident_number = $2",
                    tid, inc_num,
                )
                inc_id = inc_row["id"] if inc_row else None

            # created_at = 2 days after the linked incident
            inc_days_ago = {
                "INC-0020": 0,
                "INC-0016": 18,
                "INC-0014": 37,
            }
            capa_ts = now - timedelta(days=inc_days_ago.get(inc_num, 0) - 2)

            await db.execute(
                """INSERT INTO capas (tenant_id, incident_id, capa_number, title, description,
                                      capa_type, status, priority, assigned_to, due_date, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
                tid, inc_id, capa_num, title, desc, ctype, status, priority,
                assigned_to, today + timedelta(days=days_due), capa_ts,
            )

    print("Reseed: Demo data enriched successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
