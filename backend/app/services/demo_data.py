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
    "landscaping": {
        "sites": [
            ("Main Operations Yard", "OPS", "commercial", 80),
            ("North County Crew Base", "NCB", "commercial", 35),
            ("Equipment & Fleet Shop", "EFS", "manufacturing", 15),
        ],
        "incident_types": [
            ("injury", "high", "Struck by falling tree limb during removal", "Client Site - Palm Beach", "Crew member struck by 8-inch diameter limb during crown reduction - head laceration"),
            ("injury", "medium", "Chainsaw kickback laceration", "Client Site - Boca Raton", "Chainsaw kicked back during stump cutting - deep cut to left thigh through chaps"),
            ("injury", "medium", "Heat illness during summer crew work", "Client Site - Fort Lauderdale", "Worker collapsed from heat exhaustion during 95F afternoon mowing shift"),
            ("injury", "low", "Eye injury from flying debris during mowing", "Client Site - Coral Springs", "Rock launched by commercial mower struck worker's safety glasses - eye irritation"),
            ("near_miss", "high", "Contact with overhead power line during tree trimming", "Client Site - Doral", "Pole pruner contacted 7200V distribution line - no injury due to fiberglass tool"),
            ("injury", "medium", "Back injury from lifting hardscape materials", "Client Site - Weston", "Worker strained back lifting 80lb paver pallet without equipment"),
            ("near_miss", "medium", "Trailer detached from truck on highway", "I-95 Southbound", "Trailer hitch pin failed - trailer separated at 45mph, no collision"),
            ("injury", "low", "Chemical burn from herbicide application", "Client Site - Plantation", "Glyphosate concentrate splashed on forearm during tank mixing"),
            ("injury", "low", "Bee sting allergic reaction", "Client Site - Davie", "Worker disturbed yellow jacket nest while edging - anaphylaxis, EpiPen used"),
            ("near_miss", "low", "Riding mower rollover on slope", "Client Site - Parkland", "Zero-turn mower slid on wet slope - operator jumped clear before rollover"),
            ("environmental", "medium", "Fertilizer runoff into canal", "Client Site - Miami Lakes", "Over-application of nitrogen fertilizer before rain event - visible algae bloom"),
            ("injury", "medium", "Hand injury from commercial edger", "Client Site - Homestead", "Rotating blade contact when guard shifted during edging - tendon damage"),
            ("near_miss", "medium", "Unsecured equipment fell from trailer during transport", "US-1 Highway", "Blower and trimmer fell onto roadway from unsecured trailer rack"),
            ("injury", "low", "Noise-induced hearing shift", "Operations Yard", "Annual audiogram showed threshold shift for leaf blower operators"),
            ("injury", "low", "Poison ivy/poison oak dermatitis", "Client Site - Jupiter", "Severe contact dermatitis from clearing overgrown lot"),
        ],
        "capa_titles": [
            "Electrical hazard awareness training for all tree crews",
            "Heat illness prevention program with mandatory hydration breaks",
            "Trailer inspection and securement checklist program",
            "PPE upgrade: chainsaw chaps, face shields, hearing protection",
            "Herbicide handling and mixing SOP with spill kit requirement",
            "Slope assessment protocol for riding mower operations",
        ],
    },
    "construction": {
        "sites": [
            ("Active Job Site - Tower Project", "TWR", "construction", 200),
            ("Active Job Site - Retail Build", "RTL", "construction", 80),
            ("Equipment Yard & Office", "EQP", "commercial", 30),
        ],
        "incident_types": [
            ("injury", "high", "Fall from scaffold", "Tower Project - Floor 12", "Worker fell 6 feet from scaffold platform without guardrail - broken wrist"),
            ("injury", "high", "Struck by falling object", "Tower Project - Floor 8", "Hammer dropped from upper floor struck worker below - hard hat prevented head injury but shoulder fracture"),
            ("near_miss", "high", "Trench wall collapse", "Retail Build - Utility Trench", "4-foot trench wall collapsed while worker inside - extricated uninjured"),
            ("injury", "medium", "Nail gun injury to hand", "Retail Build - Framing", "Pneumatic nail gun discharged through plywood into worker's palm"),
            ("near_miss", "medium", "Crane outrigger on unstable ground", "Tower Project - Ground Level", "Mobile crane outrigger pad sank 6 inches into soft soil during lift"),
            ("injury", "low", "Concrete burn to knees", "Tower Project - Floor 3", "Prolonged kneeling in wet concrete without knee pads - chemical burn"),
            ("environmental", "medium", "Sediment discharge from site", "Retail Build - Perimeter", "Stormwater runoff carried sediment past silt fence to adjacent waterway"),
            ("injury", "medium", "Silica exposure during concrete cutting", "Tower Project - Ground Level", "Air monitoring showed respirable silica at 75 ug/m3 vs 50 ug/m3 PEL during saw cutting"),
            ("near_miss", "low", "Unsecured load on material hoist", "Tower Project - Floor 15", "Drywall sheets shifted on hoist platform - secured before travel"),
            ("injury", "low", "Heat stroke during summer pour", "Retail Build - Parking Area", "Concrete finisher showed heat stroke symptoms during 98F afternoon pour"),
            ("near_miss", "high", "Electrical contact during excavation", "Retail Build - Parking Area", "Excavator bucket contacted unmarked underground electrical conduit - no energized"),
            ("injury", "medium", "Back injury from rebar tying", "Tower Project - Floor 6", "Ironworker strained lower back during repetitive rebar tying in bent position"),
            ("near_miss", "medium", "Tower crane anti-collision alarm", "Tower Project - Crane", "Two tower cranes approached minimum separation distance - auto-stop engaged"),
            ("injury", "low", "Ankle sprain on uneven ground", "Retail Build - Grade Beam", "Worker stepped in rebar dowel hole and twisted ankle"),
            ("environmental", "low", "Concrete washout outside designated area", "Tower Project - Ground Level", "Ready-mix truck washed out on unprepared ground - concrete entered storm inlet"),
        ],
        "capa_titles": [
            "Scaffold inspection and competent person program",
            "Dropped object prevention plan with exclusion zones",
            "Trench safety program - shoring required over 4 feet",
            "Silica exposure control plan with engineering controls",
            "Crane lift plan review and ground condition assessment",
            "Heat illness prevention with wet bulb monitoring",
        ],
    },
    "hospitality": {
        "sites": [
            ("Main Hotel & Resort", "HTL", "commercial", 300),
            ("Beach Club & Pool", "BCH", "commercial", 60),
            ("Conference Center", "CNF", "commercial", 40),
        ],
        "incident_types": [
            ("injury", "medium", "Slip and fall in pool area", "Pool Deck", "Guest slipped on wet pool deck - hotel liable, knee injury requiring medical"),
            ("injury", "high", "Burn from kitchen equipment", "Main Kitchen", "Line cook sustained deep fryer burn to arm during oil change procedure"),
            ("injury", "low", "Housekeeping repetitive strain injury", "Guest Room Floor 8", "Housekeeper reported chronic shoulder pain from bed making and vacuuming"),
            ("near_miss", "medium", "Pool chemical over-chlorination", "Pool Equipment Room", "Chlorine feed pump malfunction caused pool to reach 8 ppm - guest complaints"),
            ("injury", "low", "Needle found in guest room", "Guest Room 412", "Housekeeper found used syringe under mattress - sharps exposure protocol activated"),
            ("near_miss", "high", "Kitchen fire from grease buildup", "Banquet Kitchen", "Grease fire in exhaust hood - suppression system activated, kitchen evacuated"),
            ("injury", "medium", "Bellhop back injury from luggage", "Hotel Lobby", "Bellhop strained back lifting oversized luggage from vehicle trunk"),
            ("environmental", "low", "Laundry chemical discharge", "Laundry Facility", "Detergent pump failure caused concentrated discharge to sanitary sewer"),
            ("near_miss", "low", "Elevator door malfunction", "Tower Elevator 3", "Elevator door closed on guest's arm - sensor failed to detect obstruction"),
            ("injury", "low", "Bartender laceration from broken glass", "Lobby Bar", "Wine glass broke during polishing - deep cut to finger"),
            ("near_miss", "medium", "Carbon monoxide alarm in parking garage", "Underground Garage", "CO levels reached 50 ppm during peak checkout - ventilation fans activated"),
            ("injury", "medium", "Maintenance worker electrical shock", "Mechanical Room", "120V shock while replacing outlet in wet location - GFCI not installed"),
            ("near_miss", "low", "Guest food allergy incident", "Restaurant", "Allergen not flagged on modified dish - guest identified before consuming"),
            ("injury", "low", "Landscaper heat exhaustion", "Resort Grounds", "Groundskeeper collapsed during afternoon heat while trimming hedges"),
            ("injury", "medium", "Valet parking accident", "Valet Station", "Valet driver struck bollard at low speed - guest vehicle damage, minor whiplash"),
        ],
        "capa_titles": [
            "Pool deck anti-slip surface upgrade program",
            "Kitchen hood cleaning and fire suppression inspection",
            "Ergonomic housekeeping equipment evaluation",
            "Pool chemical handling and monitoring automation",
            "Carbon monoxide monitoring system for parking garage",
            "Electrical safety audit for wet locations",
        ],
    },
    "agriculture": {
        "sites": [
            ("Main Farm Operations", "FRM", "commercial", 100),
            ("Packing House", "PKH", "manufacturing", 60),
            ("Equipment Barn & Shop", "EQB", "manufacturing", 20),
        ],
        "incident_types": [
            ("injury", "high", "Tractor rollover in field", "North Field Section 4", "Tractor rolled on slope during mowing - ROPS prevented crush but operator bruised"),
            ("injury", "medium", "Pesticide exposure during application", "South Orchard", "Spray drift contacted worker in adjacent row - skin and respiratory irritation"),
            ("injury", "medium", "Heat illness during harvest", "Strawberry Fields", "Picker collapsed from heat exhaustion during 96F afternoon harvest"),
            ("near_miss", "high", "Grain bin entrapment near-miss", "Storage Silo 3", "Worker entered bin without lockout - auger activated, pulled clear by coworker"),
            ("injury", "low", "Repetitive strain from picking", "Tomato House 2", "Chronic wrist pain from repetitive harvesting motions"),
            ("environmental", "medium", "Pesticide runoff into drainage canal", "South Field", "Heavy rain after application carried pesticide residue into drainage canal"),
            ("near_miss", "medium", "PTO entanglement near-miss", "Equipment Barn", "Worker's loose clothing caught on PTO shaft - fabric tore before entanglement"),
            ("injury", "medium", "Animal-related injury", "Livestock Area", "Worker kicked by cattle during loading - fractured rib"),
            ("injury", "low", "Snake bite during field work", "Irrigation Pump Station", "Copperhead bite to ankle while checking irrigation pump - hospital treatment"),
            ("near_miss", "low", "Forklift tip on uneven packing house floor", "Packing House", "Forklift tilted on cracked concrete while carrying loaded pallet"),
            ("injury", "low", "Dermatitis from plant contact", "Nursery Section", "Contact dermatitis from handling plants without gloves"),
            ("environmental", "low", "Fertilizer storage leak", "Chemical Storage", "Liquid fertilizer tank valve leaked 20 gallons to containment area"),
            ("near_miss", "medium", "Lightning strike near workers", "Open Field", "Lightning struck within 200 yards of field crew - no warning issued"),
            ("injury", "medium", "Chainsaw laceration during clearing", "Fence Line", "Cut to leg during brush clearing - chainsaw chaps prevented deeper wound"),
            ("injury", "low", "Bee sting allergic reaction", "Pollination Area", "Seasonal worker stung multiple times - moderate allergic reaction"),
        ],
        "capa_titles": [
            "ROPS verification and seatbelt compliance program",
            "Pesticide application buffer zone and drift prevention",
            "Heat illness prevention with shade and hydration stations",
            "Grain bin entry permit and lockout procedure",
            "PTO guard inspection and loose clothing policy",
            "Lightning safety protocol with weather monitoring",
        ],
    },
    "roofing_solar": {
        "sites": [
            ("Main Office & Yard", "HQ1", "commercial", 60),
            ("South County Crew Base", "SCB", "commercial", 30),
            ("Solar Division", "SLR", "commercial", 25),
        ],
        "incident_types": [
            ("injury", "high", "Fall from roof edge - no guardrail", "Job Site - Residential", "Roofer fell 18 feet from roof edge without fall protection - broken pelvis"),
            ("injury", "high", "Fall through skylight opening", "Job Site - Commercial", "Worker stepped on unmarked skylight cover - fell 12 feet to floor below"),
            ("near_miss", "high", "Ladder slip on wet surface", "Job Site - Residential", "Extension ladder base slid on dew-covered concrete - worker grabbed gutter"),
            ("injury", "medium", "Heat exhaustion on black roof surface", "Job Site - Flat Roof", "Worker collapsed on 160F roof surface during August re-roof - hospital transport"),
            ("injury", "medium", "Nail gun injury through foot", "Job Site - New Construction", "Pneumatic nailer penetrated roof deck and worker's boot below"),
            ("near_miss", "medium", "Unsecured material blown off roof", "Job Site - Commercial", "20mph gust blew stack of shingles off 3-story roof to sidewalk below"),
            ("injury", "low", "Chemical burn from roofing adhesive", "Job Site - Flat Roof", "Hot tar splash to forearm during modified bitumen application"),
            ("injury", "medium", "Arc flash during solar panel wiring", "Job Site - Solar Install", "DC arc flash when panel string was energized during combiner box wiring"),
            ("near_miss", "high", "Scaffold collapse during tear-off", "Job Site - Commercial", "Pump jack scaffold tilted when brace failed - 2 workers evacuated safely"),
            ("injury", "low", "Knee injury from prolonged kneeling", "Job Site - Residential", "Chronic knee pain from repetitive shingle installation without knee pads"),
        ],
        "capa_titles": [
            "100% fall protection compliance program with daily audits",
            "Skylight and opening protection marking system",
            "Heat illness prevention with mandatory hydration and shade breaks",
            "Solar electrical safety training and LOTO for PV systems",
            "Material securement and wind speed work suspension policy",
        ],
    },
    "healthcare": {
        "sites": [
            ("Main Hospital Campus", "MHC", "commercial", 800),
            ("Outpatient Clinic Network", "OPC", "commercial", 150),
            ("Long-Term Care Facility", "LTC", "commercial", 200),
        ],
        "incident_types": [
            ("injury", "high", "Patient handling back injury", "Med-Surg Unit 3N", "Nurse strained lower back during manual patient repositioning - no lift available"),
            ("injury", "medium", "Needlestick during blood draw", "Phlebotomy Lab", "Needle punctured glove during venipuncture - bloodborne pathogen exposure protocol"),
            ("injury", "high", "Workplace violence - patient assault", "Emergency Department", "Patient struck nurse during psychiatric crisis - facial laceration"),
            ("injury", "medium", "Slip and fall on wet floor", "Operating Room Corridor", "Surgeon slipped on fluid spill outside OR - wrist fracture"),
            ("near_miss", "high", "Medication error near-miss", "Pharmacy", "10x dose dispensed - caught by pharmacist during verification check"),
            ("injury", "low", "Latex allergy reaction", "ICU", "Nurse developed contact dermatitis from latex glove use despite policy change"),
            ("near_miss", "medium", "Chemical spill in sterile processing", "Central Sterile", "Glutaraldehyde container dropped during transport - 2L spill in corridor"),
            ("injury", "medium", "Repetitive strain from charting", "Nursing Station Floor 4", "Wrist tendinitis from prolonged electronic health record documentation"),
            ("near_miss", "medium", "Fire door blocked in patient care area", "Rehabilitation Unit", "Fire door propped open with wheelchair for 3 days - fire marshal cited"),
            ("injury", "low", "Formaldehyde exposure in pathology", "Histology Lab", "Short-term exposure above OSHA STEL during tissue grossing"),
            ("injury", "medium", "Patient lift equipment failure", "Long-Term Care Wing B", "Ceiling lift sling strap tore during transfer - patient and aide fell"),
            ("near_miss", "low", "TB exposure from undiagnosed patient", "Emergency Department", "Active TB diagnosed 3 days after admission - 12 staff exposures"),
            ("injury", "low", "Sharps injury from insulin pen", "Diabetic Clinic", "Nurse stuck by used insulin pen needle during disposal"),
            ("near_miss", "medium", "Surgical smoke exposure", "Operating Room 7", "Electrosurgical smoke evacuation system not functioning during procedure"),
            ("injury", "medium", "Assault by visitor", "Waiting Room", "Agitated family member pushed registration clerk - bruised shoulder"),
        ],
        "capa_titles": [
            "Safe patient handling program with mechanical lift requirement",
            "Needlestick prevention - transition to safety-engineered devices",
            "Workplace violence prevention plan with de-escalation training",
            "Chemical spill response kit deployment in all departments",
            "Surgical smoke evacuation compliance program",
            "TB screening and airborne infection isolation protocol update",
        ],
    },
    "warehousing": {
        "sites": [
            ("Distribution Center", "DC1", "warehouse", 250),
            ("Fulfillment Center", "FC1", "warehouse", 400),
            ("Cross-Dock Facility", "XDK", "warehouse", 80),
        ],
        "incident_types": [
            ("injury", "high", "Forklift struck pedestrian at intersection", "DC1 Aisle 14", "Forklift contacted order picker at blind intersection - broken leg"),
            ("injury", "high", "Crushed by falling pallet from rack", "FC1 Zone C", "Top-level pallet shifted during adjacent retrieval - fell on worker below"),
            ("injury", "medium", "Back injury from manual lifting", "FC1 Packing Station 8", "Worker lifted 55lb box overhead to conveyor - acute lower back strain"),
            ("near_miss", "high", "Rack collapse near-miss", "DC1 Bay 22", "Forklift struck rack upright - 3 bays of racking shifted, evacuated area"),
            ("injury", "medium", "Conveyor entanglement", "FC1 Sortation Line", "Worker's glove caught in conveyor roller - finger laceration"),
            ("near_miss", "medium", "Dock plate failure", "XDK Dock Door 4", "Dock leveler dropped while forklift was crossing - no fall occurred"),
            ("injury", "low", "Repetitive motion injury from scanning", "FC1 Pick Zone A", "Trigger finger from handheld scanner use during 10-hour shift"),
            ("injury", "medium", "Heat illness in non-climate-controlled warehouse", "DC1 Bulk Storage", "Worker exhibited heat exhaustion symptoms during August receiving"),
            ("near_miss", "low", "Charging station hydrogen gas buildup", "DC1 Battery Room", "Ventilation fan failure in battery charging area - H2 detector alarmed"),
            ("injury", "low", "Box cutter laceration", "FC1 Inbound Receiving", "Cut to palm during case opening with retractable blade knife"),
            ("near_miss", "medium", "Forklift propane tank leak", "XDK Loading Area", "Propane smell detected from forklift - valve fitting loose"),
            ("injury", "medium", "Fall from loading dock edge", "DC1 Dock Door 7", "Worker stepped off dock edge in low light - 4-foot fall to ground"),
            ("near_miss", "low", "Overhead door descended on trailer", "FC1 Dock Door 12", "Automatic door closed while trailer was pulling away - door damaged"),
            ("injury", "low", "Ankle sprain on uneven floor", "DC1 Staging Area", "Tripped on damaged floor joint while pulling pallet jack"),
            ("injury", "medium", "Struck by falling box from height", "FC1 Mezzanine", "Box pushed off mezzanine edge during restocking - struck worker below"),
        ],
        "capa_titles": [
            "Forklift-pedestrian separation barriers and traffic management",
            "Rack inspection program with quarterly professional assessment",
            "Ergonomic lifting aids and max weight policy enforcement",
            "Heat illness prevention with fans, hydration, and cool-down areas",
            "Dock safety: barriers, lighting, and fall protection",
            "Conveyor guarding and emergency stop cable installation",
        ],
    },
    "food_processing": {
        "sites": [
            ("Processing Plant", "PP1", "manufacturing", 300),
            ("Cold Storage Facility", "CSF", "warehouse", 60),
            ("Quality & R&D Lab", "QRD", "lab", 40),
        ],
        "incident_types": [
            ("injury", "high", "Amputation from meat processing equipment", "Cut Floor Line 2", "Worker's finger caught in bandsaw during carcass splitting - partial amputation"),
            ("injury", "high", "Ammonia release in refrigeration area", "Engine Room", "Ammonia line leak released 50 ppm in adjacent production area - 5 workers evacuated"),
            ("injury", "medium", "Slip and fall on wet production floor", "Packaging Line 3", "Worker slipped on chicken fat near conveyor - fractured wrist"),
            ("injury", "medium", "Repetitive motion injury from deboning", "Cut Floor Line 1", "Carpal tunnel diagnosis after 2 years of repetitive knife work"),
            ("near_miss", "high", "Lockout/tagout violation on grinder", "Grinding Room", "Maintenance cleared jam without LOTO - machine started during clearing"),
            ("injury", "low", "Cold stress in freezer storage", "Cold Storage -20F", "Worker spent 45 minutes in -20F freezer without adequate cold gear"),
            ("environmental", "medium", "Wastewater BOD exceedance", "WWTP Outfall", "Process wastewater exceeded 300 mg/L BOD permit limit during washdown"),
            ("near_miss", "medium", "Conveyor chain broke during operation", "Packaging Line 1", "Drive chain failed and whipped - no workers in strike zone"),
            ("injury", "medium", "Chemical burn from sanitizer", "CIP Station", "Peracetic acid splash to neck during clean-in-place connection"),
            ("injury", "low", "Noise exposure in grinding area", "Grinding Room", "Dosimetry showed 95 dBA TWA for grinder operators - above action level"),
            ("near_miss", "low", "Allergen cross-contact risk", "Mixing Room", "Peanut-containing ingredient used on shared equipment without allergen clean"),
            ("injury", "medium", "Forklift collision in cold storage", "Cold Storage Dock", "Forklift struck rack in fog-reduced visibility from cold-to-warm transition"),
            ("injury", "low", "Knife cut during manual trimming", "Trim Table 4", "Laceration to non-knife hand during manual fat trimming"),
            ("near_miss", "medium", "CO2 stunner malfunction", "Stunning Area", "CO2 levels dropped below effective concentration - animals not properly stunned"),
            ("environmental", "low", "Odor complaint from neighbors", "Rendering Area", "3 odor complaints from residential area downwind of rendering operations"),
        ],
        "capa_titles": [
            "Machine guarding audit with amputation prevention focus",
            "Ammonia leak detection and emergency response upgrade",
            "Anti-slip flooring and footwear program for wet areas",
            "Ergonomic knife and workstation redesign for cut floor",
            "LOTO compliance program with monthly audits",
            "Cold stress prevention with exposure time limits",
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
