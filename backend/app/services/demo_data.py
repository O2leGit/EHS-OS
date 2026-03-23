"""Generate industry-specific demo data for new tenants."""
import random
from datetime import datetime, timedelta, timezone
from app.core.database import get_pool

INDUSTRY_CONFIG = {
    "aerospace": {
        "sites": [
            ("Main Assembly Plant", "MAP", "manufacturing", 450),
            ("Composites Facility", "CMP", "manufacturing", 200),
            ("Flight Test Center", "FTC", "lab", 120),
        ],
        "incident_types": [
            ("injury", "medium", "Repetitive motion injury during rivet installation", "Assembly Line 3", "Hand/wrist strain from pneumatic rivet gun operation during 6-hour shift"),
            ("injury", "high", "Chemical exposure during composite layup", "Composites Bay 2", "Worker exposed to epoxy resin fumes when ventilation system malfunctioned"),
            ("near_miss", "medium", "FOD found on runway during pre-flight inspection", "Hangar 4", "Foreign object debris (bolt) found on taxiway near active aircraft"),
            ("near_miss", "low", "Crane load indicator malfunction", "Assembly Line 1", "Overhead crane weight indicator showed incorrect reading during fuselage lift"),
            ("injury", "low", "Minor laceration from sheet metal edge", "Sheet Metal Shop", "Cut to forearm from unfinished aluminum edge during deburring"),
            ("environmental", "medium", "Hydraulic fluid spill in hangar", "Hangar 2", "5 gallons of Skydrol hydraulic fluid released during line replacement"),
            ("near_miss", "high", "Pressurized line not depressurized before maintenance", "Engine Test Cell", "Technician began disconnect on pressurized fuel line - caught by buddy check"),
            ("injury", "medium", "Noise-induced threshold shift", "Engine Test Cell", "Hearing test showed temporary threshold shift after engine run without double protection"),
            ("near_miss", "low", "Incorrect torque value applied to critical fastener", "Assembly Line 2", "Torque wrench calibration expired - 12 fasteners required re-torque"),
            ("environmental", "low", "Solvent waste container overfilled", "Paint Shop", "MEK waste drum exceeded 90% fill level - secondary containment prevented release"),
            ("injury", "medium", "Back strain lifting composite tool", "Composites Bay 1", "Worker lifted 45lb cure tool without assistance, reported lower back pain"),
            ("near_miss", "medium", "Lockout/tagout procedure not followed", "CNC Machine Shop", "Machine guard removed without LOTO during blade change - supervisor intervened"),
            ("injury", "low", "Eye irritation from sanding dust", "Paint Prep Area", "Particulate exposure during sanding despite PPE - improper seal on respirator"),
            ("near_miss", "high", "Dropped tool from height during wing assembly", "Final Assembly", "Socket wrench fell 25 feet from scaffold - hard hat area but no one struck"),
            ("injury", "medium", "Thermal burn from heat treat oven", "Heat Treat Dept", "Contact burn to forearm when reaching into oven with inadequate protective sleeve"),
        ],
        "capa_titles": [
            "Implement ergonomic tool rotation schedule for rivet operations",
            "Upgrade composites bay ventilation system to meet OSHA PEL",
            "FOD prevention program - daily runway sweep protocol",
            "Crane inspection and calibration program overhaul",
            "LOTO compliance audit and retraining program",
            "Fall protection equipment upgrade for final assembly",
        ],
    },
    "pharma": {
        "sites": [
            ("Manufacturing Campus", "MFG", "manufacturing", 600),
            ("Quality Control Lab", "QCL", "lab", 150),
            ("R&D Center", "RDC", "lab", 250),
        ],
        "incident_types": [
            ("injury", "high", "Chemical splash during API transfer", "Building 3 - Production", "Sulfuric acid splash to arm during manual transfer - chemical burn requiring medical treatment"),
            ("injury", "medium", "Needlestick during fill/finish operation", "Aseptic Fill Suite", "Operator sustained needlestick from pre-filled syringe during line clearance"),
            ("near_miss", "high", "Cross-contamination risk during changeover", "Building 2 - Oral Solids", "Residual API detected on equipment after validated cleaning procedure"),
            ("environmental", "medium", "Solvent release from scrubber malfunction", "Waste Treatment", "VOC emissions exceeded permit limits for 2 hours during scrubber failure"),
            ("near_miss", "medium", "Incorrect gowning procedure in cleanroom", "QC Microbiology Lab", "Analyst entered ISO 5 area without proper sterile gowning - caught by airlock camera"),
            ("injury", "low", "Ergonomic strain from repetitive pipetting", "Analytical Lab", "Wrist strain from 8-hour pipetting session during stability testing"),
            ("near_miss", "low", "Expired calibration on pH meter used for in-process testing", "Building 3 - IPC", "pH meter calibration expired 3 days prior - 2 batches under investigation"),
            ("injury", "medium", "Slip and fall in wet processing area", "Building 1 - Purification", "Worker slipped on wet floor near chromatography column - knee injury"),
            ("environmental", "low", "Waste solvent drum mislabeled", "Hazmat Storage", "Acetonitrile drum labeled as methanol - discovered during waste manifest audit"),
            ("near_miss", "medium", "Forklift near-miss in warehouse", "Raw Material Warehouse", "Forklift backed into pedestrian walkway without spotter - no injuries"),
            ("injury", "low", "Paper cut from packaging materials", "Packaging Line 2", "Minor laceration from corrugated cardboard during manual case packing"),
            ("injury", "medium", "Respiratory irritation from powder handling", "Granulation Suite", "Operator reported coughing and throat irritation after API weighing"),
            ("near_miss", "high", "Temperature excursion in cold storage", "Stability Chamber Room", "Refrigerator failure caused 8-hour excursion above 8C for clinical trial samples"),
            ("environmental", "medium", "Wastewater pH excursion", "WWTP", "Effluent pH dropped to 4.2 - below POTW permit limit of 5.5"),
            ("injury", "high", "Steam burn during autoclave operation", "Central Sterilization", "Steam release from autoclave door gasket failure caused second-degree burn to hand"),
        ],
        "capa_titles": [
            "Install closed transfer system for API handling",
            "Needlestick prevention program with engineered sharps controls",
            "Enhanced cleaning validation with TOC and HPLC verification",
            "Scrubber redundancy and alarm system upgrade",
            "Cleanroom gowning qualification refresher program",
            "Ergonomic pipetting station redesign",
        ],
    },
    "biotech": {
        "sites": [
            ("Research Campus", "RES", "lab", 400),
            ("GMP Manufacturing", "GMP", "manufacturing", 250),
            ("Distribution Center", "DST", "warehouse", 100),
        ],
        "incident_types": [
            ("injury", "high", "Biological exposure during cell culture work", "BSL-2 Lab Suite", "Splash of recombinant virus-containing media to mucous membrane during flask transfer"),
            ("injury", "medium", "Cryogenic burn from liquid nitrogen", "Cell Banking", "LN2 splash to forearm during vial retrieval from dewar - second degree frostbite"),
            ("near_miss", "high", "BSC certification expired in active lab", "Virology Lab", "Annual BSC certification lapsed by 45 days - discovered during facility audit"),
            ("environmental", "medium", "Biohazardous waste spill in corridor", "Building B Hallway", "Sharps container fell from cart during transport - 3 items released to floor"),
            ("near_miss", "medium", "Centrifuge rotor imbalance alarm", "Purification Suite", "High-speed centrifuge auto-stopped due to imbalance - rotor inspection required"),
            ("injury", "low", "Repetitive strain from pipetting", "Assay Development Lab", "Bilateral wrist pain from high-throughput screening campaign"),
            ("near_miss", "low", "Chemical incompatibility in waste stream", "Chemical Storage", "Bleach and acid waste mixed in secondary container - gas generation detected"),
            ("injury", "medium", "UV exposure during gel documentation", "Molecular Biology Lab", "Researcher exposed to UV light when transilluminator shield was cracked"),
            ("environmental", "low", "Autoclave condensate discharge exceeded BOD limit", "Central Services", "Waste autoclave condensate BOD at 450 mg/L vs 250 mg/L permit limit"),
            ("near_miss", "medium", "Freezer alarm not responded to for 4 hours", "Sample Storage -80C", "Alarm fatigue led to delayed response - samples reached -65C before recovery"),
            ("injury", "low", "Glass breakage laceration", "QC Lab", "Volumetric flask broke during washing - cut to palm requiring 3 sutures"),
            ("injury", "medium", "Formaldehyde exposure above PEL", "Histology Lab", "15-min STEL monitoring showed 3.2 ppm vs 2 ppm OSHA STEL during tissue processing"),
            ("near_miss", "high", "Compressed gas cylinder unsecured", "Gas Storage Room", "3 nitrogen cylinders found unchained during safety walk - seismic risk"),
            ("environmental", "medium", "Bioreactor foam-out to facility drain", "GMP Suite 200", "2000L bioreactor foam-out released cell culture media to floor drain"),
            ("injury", "high", "Allergic reaction to latex gloves", "Production Area", "Severe allergic reaction (anaphylaxis) - EpiPen administered, hospital transport"),
        ],
        "capa_titles": [
            "Implement splash guards and face shields for BSL-2 work",
            "Cryogenic PPE upgrade and training program",
            "BSC certification tracking system with 60-day advance alerts",
            "Biohazardous waste transport cart redesign with containment",
            "Freezer alarm escalation protocol with backup notification",
            "Formaldehyde-free tissue processing protocol evaluation",
        ],
    },
    "chemical": {
        "sites": [
            ("Chemical Plant", "CPL", "manufacturing", 350),
            ("R&D Laboratory", "RDL", "lab", 100),
            ("Tank Farm & Storage", "TFS", "warehouse", 75),
        ],
        "incident_types": [
            ("injury", "high", "Chemical burn from caustic splash", "Reactor Building", "NaOH splash to face and neck during valve operation - emergency shower used"),
            ("near_miss", "high", "Pressure relief valve activation", "Distillation Column 3", "PSV lifted at 95% of set pressure during exothermic reaction upset"),
            ("environmental", "high", "Chemical release to atmosphere", "Tank Farm", "Chlorine gas release from tank car unloading - shelter-in-place activated for 1 hour"),
            ("injury", "medium", "Thermal burn from steam line", "Boiler House", "Contact burn from uninsulated steam line during confined space entry"),
            ("near_miss", "medium", "Incorrect chemical addition to reactor", "Batch Processing", "Wrong raw material charged to reactor - caught before reaction initiation"),
            ("injury", "low", "Dermatitis from solvent exposure", "QC Lab", "Chronic skin irritation from repeated toluene contact during sampling"),
            ("environmental", "medium", "Stormwater contamination", "Loading Dock", "Chemical residue on loading dock washed into storm drain during rain event"),
            ("near_miss", "high", "LEL alarm in confined space", "Storage Tank T-105", "Combustible gas reading at 15% LEL during tank inspection - immediate evacuation"),
            ("injury", "medium", "Inhalation exposure during tank cleaning", "Tank Farm", "Residual vapors caused respiratory irritation despite supplied air respirator"),
            ("near_miss", "low", "Forklift tire failure near chemical storage", "Warehouse", "Front tire blowout while transporting drum pallet - no spill occurred"),
            ("injury", "high", "Eye injury from chemical splash", "Pilot Plant", "Hydrochloric acid splash to eye - 15 min eye wash, hospital transport"),
            ("environmental", "medium", "Wastewater treatment upset", "WWTP", "Biological treatment system upset from pH shock - 6 hours above permit for TSS"),
            ("near_miss", "medium", "Missing blind flange on process line", "Maintenance Shop", "Line opened for maintenance without blind flange - residual product released"),
            ("injury", "low", "Noise exposure in compressor room", "Utilities", "Dosimetry showed 92 dBA TWA for compressor room operators - above 85 dBA action level"),
            ("environmental", "low", "Minor oil sheen on cooling water discharge", "Cooling Tower", "Lubricating oil leak from pump seal created visible sheen in discharge canal"),
        ],
        "capa_titles": [
            "Install remote-operated valves for caustic service",
            "Pressure relief device testing frequency increase",
            "Chlorine detection and auto-shutoff system upgrade",
            "Confined space atmospheric monitoring protocol update",
            "Chemical addition verification system (barcode scanning)",
            "Stormwater pollution prevention plan revision",
        ],
    },
    "medical_device": {
        "sites": [
            ("Manufacturing Facility", "MFG", "manufacturing", 300),
            ("Sterilization Plant", "STP", "manufacturing", 80),
            ("R&D Engineering", "RDE", "lab", 150),
        ],
        "incident_types": [
            ("injury", "medium", "Needlestick during device assembly", "Clean Assembly Room", "Puncture wound from hypodermic needle during catheter assembly"),
            ("injury", "low", "Ergonomic strain from microscope use", "Inspection Station 3", "Neck and shoulder pain from prolonged microscope inspection of PCB assemblies"),
            ("near_miss", "medium", "EtO residual above specification", "Sterilization", "Ethylene oxide residual on device exceeded 25 ppm limit - lot held for aeration"),
            ("environmental", "medium", "EtO emission exceedance", "Sterilization Stack", "Continuous emissions monitor showed EtO above permit limit during sterilization cycle"),
            ("near_miss", "low", "Cleanroom particle count excursion", "ISO 7 Assembly", "0.5 micron particle count exceeded Class 10000 limit during shift change"),
            ("injury", "medium", "Laser eye exposure during alignment", "Laser Welding Cell", "Reflected beam exposure during titanium implant welding - ophthalmology evaluation"),
            ("near_miss", "high", "Wrong material used in implant manufacturing", "CNC Machining", "Ti-6Al-7Nb used instead of Ti-6Al-4V - detected at incoming QC inspection"),
            ("injury", "low", "Contact dermatitis from cleaning agents", "Final Packaging", "Skin reaction from IPA wipes during device cleaning before packaging"),
            ("environmental", "low", "Isopropyl alcohol waste accumulation", "Waste Storage", "IPA waste exceeded 90-day storage limit by 5 days - satellite container issue"),
            ("near_miss", "medium", "Sterilizer door interlock bypass", "Sterilization", "Maintenance bypassed door interlock without LOTO - discovered during walk-through"),
            ("injury", "high", "Crush injury from hydraulic press", "Molding Department", "Finger caught in injection mold during manual part removal - fracture"),
            ("near_miss", "low", "Missing bioburden test before sterilization", "QA Lab", "Pre-sterilization bioburden test not performed on 3 lots - hold and test required"),
            ("injury", "medium", "Soldering fume inhalation", "Electronics Assembly", "Lead-free solder flux exposure - respiratory symptoms during 10-hour shift"),
            ("near_miss", "medium", "Calibration drift on dimensional gauge", "Metrology Lab", "CMM showed 0.05mm drift - 2 weeks of measurements under investigation"),
            ("injury", "low", "Repetitive motion injury from assembly work", "Sub-Assembly Area", "Carpal tunnel symptoms from repetitive connector insertion tasks"),
        ],
        "capa_titles": [
            "Engineered sharps safety devices for assembly operations",
            "Ergonomic workstation redesign for inspection stations",
            "EtO aeration cycle optimization and monitoring upgrade",
            "Material verification system with positive ID scanning",
            "Hydraulic press guarding and two-hand control upgrade",
            "Solder fume extraction system installation",
        ],
    },
    "restaurant": {
        "sites": [
            ("Downtown Location", "DT1", "commercial", 45),
            ("Airport Location", "APT", "commercial", 30),
            ("Commissary Kitchen", "CMK", "manufacturing", 25),
        ],
        "incident_types": [
            ("injury", "high", "Deep laceration from slicing machine", "Kitchen", "Cook's hand caught in commercial meat slicer - required ER visit and stitches"),
            ("injury", "medium", "Burn from hot oil splash", "Fry Station", "Oil splashed from deep fryer during basket removal - second degree burn to forearm"),
            ("injury", "low", "Slip and fall on wet kitchen floor", "Kitchen", "Server slipped on grease near dish pit - bruised knee"),
            ("near_miss", "medium", "Grease fire in exhaust hood", "Kitchen", "Grease buildup in hood ignited briefly - suppression system not activated"),
            ("injury", "low", "Back strain from lifting supply boxes", "Storage Room", "Cook lifted 50lb box of frozen product from floor level"),
            ("near_miss", "low", "Walk-in cooler door stuck closed", "Walk-in Cooler", "Employee trapped in walk-in for 10 minutes - interior release malfunctioning"),
            ("environmental", "low", "Grease trap overflow", "Exterior", "Grease interceptor overflowed to parking lot during heavy rain"),
            ("injury", "medium", "Steam burn from commercial dishwasher", "Dish Area", "Worker opened dishwasher mid-cycle - steam burn to face and arms"),
            ("near_miss", "medium", "Chemical mixing incident", "Janitorial Closet", "Bleach and ammonia-based cleaner stored together - fumes detected"),
            ("injury", "low", "Repetitive strain from food prep", "Prep Station", "Wrist pain from hours of chopping vegetables"),
        ],
        "capa_titles": [
            "Install blade guards on all slicing equipment",
            "Anti-slip mat program for all kitchen areas",
            "Hood cleaning schedule increase to monthly",
            "Walk-in cooler safety release inspection program",
            "Chemical storage separation and labeling system",
        ],
    },
    "fishing": {
        "sites": [
            ("Harbor Operations", "HBR", "commercial", 60),
            ("Processing Plant", "PRC", "manufacturing", 120),
            ("Fleet Maintenance", "FLT", "manufacturing", 30),
        ],
        "incident_types": [
            ("injury", "high", "Man overboard during net hauling", "Vessel FV-201", "Crew member pulled overboard by fouled net line - rescued within 3 minutes"),
            ("injury", "high", "Crush injury from deck machinery", "Vessel FV-105", "Hand caught in winch drum during trawl retrieval - finger amputation"),
            ("injury", "medium", "Hypothermia from cold water exposure", "Vessel FV-301", "Wave washed over deck - crew member immersed in 42F water for 5 minutes"),
            ("near_miss", "high", "Stability issue during heavy seas", "Vessel FV-201", "Vessel listed 25 degrees during catch stacking - cargo shifted"),
            ("injury", "medium", "Laceration from fish processing knife", "Processing Line 2", "Deep cut to hand during manual filleting operation"),
            ("near_miss", "medium", "Ammonia leak in refrigeration system", "Cold Storage", "Ammonia detector alarmed at 35 ppm - evacuation and repair"),
            ("injury", "low", "Slip on fish-covered deck", "Processing Floor", "Worker slipped on wet processing floor - sprained ankle"),
            ("environmental", "medium", "Fish waste discharge violation", "Outfall Pipe", "Waste discharge exceeded permit BOD limits during peak processing"),
            ("near_miss", "low", "Forklift collision near dock edge", "Loading Dock", "Forklift braked at dock edge during ice delivery - 3 feet from water"),
            ("injury", "medium", "Repetitive motion injury from processing", "Packing Line", "Carpal tunnel from repetitive fish packing motions"),
        ],
        "capa_titles": [
            "Personal flotation device compliance program",
            "Winch guard and emergency stop upgrade for all vessels",
            "Vessel stability training and load management",
            "Ammonia detection and ventilation system upgrade",
            "Deck anti-slip coating and drainage improvement",
        ],
    },
    "professional_services": {
        "sites": [
            ("Main Office", "HQ1", "office", 150),
            ("Downtown Branch", "DT2", "office", 60),
            ("Remote/Field Operations", "FLD", "office", 30),
        ],
        "incident_types": [
            ("injury", "low", "Ergonomic strain from desk setup", "Open Office Floor 3", "Neck and shoulder pain from prolonged computer use - workstation not adjusted"),
            ("injury", "low", "Trip and fall over cable run", "Conference Room B", "Employee tripped on extension cord crossing walkway - bruised knee"),
            ("near_miss", "low", "Elevator malfunction with passengers", "Building Lobby", "Elevator stopped between floors for 20 minutes - 4 occupants"),
            ("injury", "low", "Paper cut requiring first aid", "Copy Room", "Deep paper cut from high-speed printer output tray"),
            ("near_miss", "medium", "Slip on icy parking lot", "Parking Garage", "Employee slipped on black ice near entrance - caught railing"),
            ("injury", "medium", "Vehicle accident during client visit", "Highway I-94", "Rear-ended while driving to client site - whiplash reported"),
            ("near_miss", "low", "Space heater near combustibles", "Office 412", "Personal space heater found running unattended next to paper files"),
            ("injury", "low", "Eye strain from screen glare", "Open Office Floor 2", "Persistent headaches from overhead lighting reflecting on monitors"),
            ("near_miss", "medium", "Threatening behavior from visitor", "Reception", "Non-client became aggressive in lobby - security called"),
            ("injury", "low", "Wrist strain from laptop use during travel", "Hotel/Remote", "Repetitive strain from working on laptop without external keyboard"),
        ],
        "capa_titles": [
            "Ergonomic assessment program for all workstations",
            "Cable management and trip hazard elimination",
            "Fleet safety and defensive driving program",
            "Workplace violence prevention plan update",
            "Remote work ergonomic equipment allowance",
        ],
    },
    "general_manufacturing": {
        "sites": [
            ("Main Plant", "PLT", "manufacturing", 400),
            ("Warehouse & Distribution", "WHS", "warehouse", 100),
            ("Quality Lab", "QAL", "lab", 50),
        ],
        "incident_types": [
            ("injury", "medium", "Laceration from machine guarding gap", "Production Floor", "Cut to hand when reaching into unguarded nip point on conveyor"),
            ("injury", "high", "Forklift struck pedestrian", "Shipping Dock", "Forklift contacted worker's leg at intersection - fracture to tibia"),
            ("near_miss", "medium", "Overhead crane load drop", "Assembly Area", "Sling failure caused 500lb load to drop 6 inches before safety catch engaged"),
            ("injury", "low", "Slip and fall on oily floor", "Machine Shop", "Worker slipped on hydraulic oil leak - bruised hip"),
            ("near_miss", "high", "Electrical arc flash near-miss", "MCC Room", "Arc flash during breaker racking without proper PPE - no injury due to distance"),
            ("environmental", "medium", "Oil spill to storm drain", "Parking Lot", "Used oil container tipped over near storm drain - 10 gallons released"),
            ("injury", "medium", "Hearing loss from noise exposure", "Stamping Department", "Annual audiogram showed standard threshold shift for press operator"),
            ("near_miss", "low", "Missing fire extinguisher", "Welding Bay 3", "Fire extinguisher removed for inspection and not replaced for 3 days"),
            ("injury", "low", "Back strain from manual lifting", "Receiving Dock", "Worker lifted 65lb box without mechanical assist - lower back strain"),
            ("near_miss", "medium", "Confined space entry without permit", "Waste Tank", "Worker entered permit-required confined space for retrieval without air monitoring"),
            ("injury", "medium", "Welding flash burn", "Fabrication Shop", "UV exposure to eyes from adjacent welding operation without screen"),
            ("environmental", "low", "Coolant leak from CNC machine", "Machine Shop", "Metalworking fluid leak pooled under machine - 5 gallons to floor drain"),
            ("near_miss", "high", "Fall from ladder", "Maintenance", "Ladder slipped on smooth floor during overhead pipe repair - worker caught railing"),
            ("injury", "low", "Heat stress during summer shift", "Foundry", "Worker showed signs of heat exhaustion during afternoon shift - 105F ambient"),
            ("injury", "medium", "Pinch point injury on press brake", "Sheet Metal Shop", "Finger caught between die and workpiece during press brake operation"),
        ],
        "capa_titles": [
            "Machine guarding audit and upgrade program",
            "Pedestrian-forklift separation barriers and warning systems",
            "Crane inspection and sling replacement schedule",
            "Electrical safety program with arc flash PPE categories",
            "Confined space program audit and rescue team training",
            "Fall protection assessment for all elevated work",
        ],
    },
}


async def generate_demo_data(tenant_id: str, industry: str, num_incidents: int = 25):
    """Generate realistic demo data for a tenant based on industry."""
    config = INDUSTRY_CONFIG.get(industry, INDUSTRY_CONFIG["general_manufacturing"])
    pool = await get_pool()
    async with pool.acquire() as db:
        now = datetime.now(timezone.utc)

        # Create sites
        site_ids = {}
        for name, code, site_type, employees in config["sites"]:
            existing = await db.fetchrow(
                "SELECT id FROM sites WHERE tenant_id = $1::uuid AND code = $2", tenant_id, code)
            if not existing:
                row = await db.fetchrow(
                    """INSERT INTO sites (tenant_id, name, code, site_type, employee_count)
                       VALUES ($1::uuid, $2, $3, $4, $5) RETURNING id""",
                    tenant_id, name, code, site_type, employees,
                )
                site_ids[code] = row["id"]
            else:
                site_ids[code] = existing["id"]

        site_codes = list(site_ids.keys())

        # Create incidents spread over 6 months
        incident_templates = config["incident_types"]
        num_to_create = min(num_incidents, len(incident_templates) * 2)
        created_incident_ids = []

        for i in range(num_to_create):
            template = incident_templates[i % len(incident_templates)]
            inc_type, severity, title, location, description = template
            days_ago = random.randint(5, 180)
            site_code = site_codes[i % len(site_codes)]
            inc_num = f"INC-{i+1:04d}"
            status = random.choice(["open", "open", "investigating", "closed", "closed", "closed"])
            reported_by = random.choice(["Floor Supervisor", "Operator", "Safety Manager", "Technician", "Engineer", "Maintenance Tech"])

            existing = await db.fetchrow(
                "SELECT id FROM incidents WHERE tenant_id = $1::uuid AND incident_number = $2", tenant_id, inc_num)
            if not existing:
                row = await db.fetchrow(
                    """INSERT INTO incidents (tenant_id, site_id, incident_number, incident_type, severity,
                                              title, description, location, reported_by, status, created_at)
                       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id""",
                    tenant_id, site_ids[site_code], inc_num, inc_type, severity,
                    title, description, location, reported_by, status,
                    now - timedelta(days=days_ago),
                )
                created_incident_ids.append(row["id"])

        # Create CAPAs linked to incidents
        capa_titles = config["capa_titles"]
        for i, title in enumerate(capa_titles):
            capa_num = f"CAPA-{i+1:04d}"
            incident_id = created_incident_ids[i] if i < len(created_incident_ids) else None
            status = random.choice(["open", "in_progress", "in_progress", "closed", "closed"])
            priority = random.choice(["high", "high", "medium", "medium", "low"])
            due_date = (now + timedelta(days=random.randint(-10, 30))).date()

            existing = await db.fetchrow(
                "SELECT id FROM capas WHERE tenant_id = $1::uuid AND capa_number = $2", tenant_id, capa_num)
            if not existing:
                await db.execute(
                    """INSERT INTO capas (tenant_id, incident_id, capa_number, title, capa_type, status,
                                          priority, due_date, created_at)
                       VALUES ($1::uuid, $2, $3, $4, 'corrective', $5, $6, $7, $8)""",
                    tenant_id, incident_id, capa_num, title, status, priority, due_date,
                    now - timedelta(days=random.randint(5, 60)),
                )

        return {
            "sites_created": len(site_ids),
            "incidents_created": len(created_incident_ids),
            "capas_created": len(capa_titles),
        }
