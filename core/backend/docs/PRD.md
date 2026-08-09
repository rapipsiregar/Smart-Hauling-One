# Product Requirement Document (PRD)

## Smart Gate: Next-Gen Edge AI & Hybrid Telemetry for Mining Haulage
**Document Version:** 1.0  
**Target Operations:** JO BIB-TIA Open-Pit Mining Operations (PT Tunas Inti Abadi & PT Borneo Indah Cemerlang)  
**RFQ Reference:** RFQ/001/TIA/VI/2026  
**Implementation Period:** July – August 2026  

> **Related technical specification:** `docs/edge-system/` (`PRD.md`, `SRS.md`,
> `API_CONTRACT.md`) is the grounded, implementation-level spec for the edge-device work actually
> being built against this repo's real codebase — 4 gates, 1 camera each, Jetson Orin Nano Super
> devices, live YOLO+OCR consensus voting, per-device settings, and on-demand live raw CCTV
> viewing. Where this document's hardware vision (solar towers, UHF radio, global-shutter
> cameras) differs from what's actually being procured/built, `docs/edge-system/` reflects the
> real, current build; this document is kept as-is as the original RFQ-derived business
> narrative.

---

## Product Vision & Success Metrics

### The "Why"
The joint open-pit mining operations of PT Tunas Inti Abadi (PT TIA) and PT BIB rely heavily on Off-Highway Truck (OHT) fleets (specifically Caterpillar 777 and 773 series) to maintain production targets [09 Proposal (TEXT)]. The current manual haulage monitoring workflow at physical checkpoints ("Pos Jaga Manual") is vulnerable to operational inefficiencies, including:
* **Human Error and Fatigue:** Manual recording of truck crossings ("ritase") is prone to errors, particularly during night shifts or inclement weather [09 Proposal (TEXT)].
* **Data Integrity and Fraud Risks:** Manual tally sheets are susceptible to manipulation, resulting in data discrepancies ("ghost loads") that distort production volumes and inflate contractor payments [09 Proposal (TEXT)].
* **Connectivity and Location Gaps:** Deep-pit mining configurations create geographic shield zones ("dead zones") where standard cellular (LTE) and GPS/GNSS tracking signals are lost, leaving the operation without real-time tracking during transit [09 Proposal (TEXT)].
* **Harsh Environment Stressors:** Fine coal dust, heavy mud during the monsoon season, and continuous seismic vibrations from heavy machinery frequently cause standard electronics to fail [09 Proposal (TEXT)].

The "Smart Gate" (or Integrated Smart Hauling System - ISHS) automates 24/7 haulage tracking [09 Proposal (TEXT)]. By deploying edge-based computer vision on rugged, solar-powered mobile towers, the system aims to establish an objective, real-time, and auditable record of all haulage cycles directly from the field [09 Proposal (TEXT)].

---

### Success Metrics (KPIs)
To measure the operational success of the Smart Gate deployment, the product must meet the following performance targets:

| Key Performance Indicator | Target Metric | Verification Method |
| :--- | :--- | :--- |
| **OCR Identification Accuracy** | $\ge 98.5\%$ success rate under all weather and lighting conditions [09 Proposal (TEXT)] | Algorithmic matching of detected hull IDs against the master fleet registry [09 Proposal (TEXT)]. |
| **System Operational Uptime** | $\ge 99.9\%$ availability [09 Proposal (TEXT)] | System telemetry logs monitoring the Edge AI hardware and power subsystems [09 Proposal (TEXT)]. |
| **Data Synchronization Latency** | $< 5$ seconds under active LTE coverage [09 Proposal (TEXT)] | Time difference between edge-detection timestamp and central dashboard ingestion [09 Proposal (TEXT)]. |
| **Data Integrity & Auditability** | $100\%$ visual proof-shot linkage [09 Proposal (TEXT)] | Database compliance check ensuring every logged crossing event includes a cropped hull ID image and wide-angle contextual photo [09 Proposal (TEXT)]. |
| **Power Autonomy** | $\ge 3$ consecutive days (72 hours) [09 Proposal (TEXT)] | Continuous operations during total solar deprivation (heavy overcast/rain) [09 Proposal (TEXT)]. |

---

## User Personas & Problem Statements

### 1. Site Operations & Production Manager
* **Profile:** Responsible for shift output, reconciling subcontractor volume logs, and ensuring production target alignment.
* **Pain Points:** 
  * Spends significant time reconciling 5% to 8% discrepancies between reported and actual hauling logs [09 Proposal (TEXT)].
  * Struggles with disputes from transport sub-contractors due to missing or contested manual logs [09 Proposal (TEXT)].
  * Lacks real-time visibility into active fleet cycle times to adjust deployments dynamically [09 Proposal (TEXT)].
* **Problem Statement:** "I need an objective, visually verified, real-time record of all haulage movements so that I can eliminate subcontractor disputes, optimize fleet cycle times, and prevent unearned volume payments."

### 2. Field Gate Auditor / Security Guard
* **Profile:** Stationary personnel assigned to checkpoint cabins to manually count and log OHT passages.
* **Pain Points:** 
  * Exposure to extreme environmental conditions (dense coal dust, heavy rain, high heat, low night visibility) [09 Proposal (TEXT)].
  * Physical strain from continuous, manual visual scanning of haulers, leading to logging errors or missed entries [09 Proposal (TEXT)].
* **Problem Statement:** "I need an automated system to capture truck identifiers so that I am not forced to perform repetitive, error-prone manual logging in hazardous, high-dust, and low-visibility conditions."

### 3. IT & Fleet Management System (FMS) Administrator
* **Profile:** Manages the site network infrastructure, database integrations, and hardware maintenance.
* **Pain Points:** 
  * Frequent data loss or sync delays caused by cellular dropouts in deep-pit dead zones [09 Proposal (TEXT)].
  * High maintenance overhead for field-deployed electronic units damaged by seismic vibrations or thermal overloads [09 Proposal (TEXT)].
* **Problem Statement:** "I need an edge-computing solution that operates locally during network dropouts, utilizes a vibration-resistant hardware design, and automatically syncs data when connectivity is restored."

---

## Agile User Stories & Epics

### Epic 1: Edge-Compute Object Detection & OCR
* **As a** Production Auditor,  
  **I want** the system to automatically recognize and extract the hull numbers of passing OHTs (Caterpillar 777/773) [09 Proposal (TEXT)],  
  **So that** I can track hauling logs without relying on manual entry [09 Proposal (TEXT)].
  * **Acceptance Criteria:**
    * The edge system must utilize YOLOv11 optimized via NVIDIA TensorRT on an industrial Jetson Orin platform [09 Proposal (TEXT)].
    * The system must use Instance Segmentation to reconstruct character structures when hull numbers are obscured by up to 30% mud or dust [09 Proposal (TEXT)].
    * The system must implement Temporal Majority Voting (TMV) over 30 to 60 consecutive video frames to prevent single-frame identification flickering [09 Proposal (TEXT)].

### Epic 2: Rugged & Autonomous Edge Infrastructure
* **As an** IT Administrator,  
  **I want** the Smart Gate hardware to run off-the-grid continuously and withstand harsh physical stressors [09 Proposal (TEXT)],  
  **So that** I can minimize field maintenance interventions and prevent system damage [09 Proposal (TEXT)].
  * **Acceptance Criteria:**
    * The structure must be a mobile "Skidding Tower" constructed of H-beam steel with integrated towing eyes [09 Proposal (TEXT)].
    * The power subsystem must include a $\ge 450\text{W}$ solar array and a $\ge 300\text{Ah}$ LiFePO4 battery bank [09 Proposal (TEXT)].
    * Hardware enclosures must have a minimum rating of IP66/IP67/IP69K, utilize passive fanless cooling, and implement M12 aviation-grade threaded connectors [09 Proposal (TEXT)].
    * Camera lenses must be treated with super-hydrophobic nano-coatings to repel water and mud [09 Proposal (TEXT)].

### Epic 3: Hybrid Fail-Safe Telemetry
* **As a** Site Operations Manager,  
  **I want** hauling events to be transmitted even during standard cellular network outages [09 Proposal (TEXT)],  
  **So that** operational dashboards display continuous, uninterrupted cycle data [09 Proposal (TEXT)].
  * **Acceptance Criteria:**
    * The system must support a dual-path communication routing architecture [09 Proposal (TEXT)].
    * **Path A (Telemetry):** Low-bandwidth JSON data (Unit ID, UTC timestamp, lane, and confidence score) must be transmitted immediately via industrial Satel UHF radio modems [09 Proposal (TEXT)].
    * **Path B (Visual Evidence):** Cropped hull images and context photos must be stored on local industrial-grade SSD buffers during cellular outages and synchronized via LTE/Starlink when cellular connections recover [09 Proposal (TEXT)].

### Epic 4: Analytics, Dashboard, & Verification
* **As an** Operations Analyst,  
  **I want** to access a secure, web-based monitoring interface [09 Proposal (TEXT)],  
  **So that** I can audit haulage cycles, view visual proof of crossings, and generate shiftly reports [09 Proposal (TEXT)].
  * **Acceptance Criteria:**
    * The dashboard must display real-time crossing lists containing: UTC Absolute Timestamp, Validated Hull ID, Lane/Check Point location, and direct links to visual proofs [09 Proposal (TEXT)].
    * The system must support exporting verified reports for data reconciliation with third-party subcontractors [09 Proposal (TEXT)].
    * The backend must expose a secure RESTful API or MQTT broker to ingest and sync data with existing ERP/FMS platforms [09 Proposal (TEXT)].

---

## Feature Scope & Prioritization

To align with the timeline of July – August 2026 under RFQ/001/TIA/VI/2026, the product rollout is divided into two phases [09 Proposal (TEXT)]:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 1: CORE AUTOMATION                              │
│  - 4 Site Deployments (CK, PPA, & South Checkpoints)                            │
│  - Front-Facing Cameras & YOLOv11 OCR Core                                      │
│  - Mobile Skidding Towers with Solar + LiFePO4 Systems                          │
│  - Hybrid UHF/LTE Telemetry Routing                                             │
│  - Master Fleet Database Config & Central Ingestion Dashboard                    │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2: ANALYTICAL EXPANSION                            │
│  - Rear-Facing Cameras (Multi-Perspective Redundancy)                           │
│  - Payload Volume & Material Load Geometry Estimation                           │
│  - Optical Tire & Chassis Condition Checks                                      │
│  - Deep Integration with Legacy Fleet Management (e.g., CAT MineStar)           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Core Automation (In-Scope)
This phase addresses the primary deliverables specified in the RFQ and immediate operational objectives [09 Proposal (TEXT)]:
* **Physical Deployments:** Installation at 4 site checkpoints: 2 Check Points (CP) in the North (CK and PPA) and 2 in the South (1 Southern CP to be deployed once OB access roadworks are completed) [09 Proposal (TEXT)].
* **YOLOv11 Frontal OCR Engine:** Optical Character Recognition of front-facing OHT fleet hull numbers [09 Proposal (TEXT)].
* **Temporal Majority Voting (TMV):** Local frame analysis logic to stabilize and validate edge OCR results before dispatching telemetry [09 Proposal (TEXT)].
* **Autonomous Mobile Skidding Towers:** Steel-framed mobile towers with independent solar power (500W Monocrystalline / 300Ah LiFePO4 batteries) [09 Proposal (TEXT)].
* **Hybrid Telemetry Routing:** Operational Satel UHF transmission for JSON metadata combined with Teltonika LTE router visual packet buffering [09 Proposal (TEXT)].
* **Fleet Master Database Setup:** Profiling of authorized OHT units, contractor registries, and license plates to serve as the local verification baseline [09 Proposal (TEXT)].
* **Real-Time Dashboards:** Ingestion interface displaying real-time vehicle crossings, absolute timestamps, matched IDs, and visual proof-shots [09 Proposal (TEXT)]. Additionally now specified: a per-gate **settings page** for tuning edge inference rate, and an on-demand **live raw CCTV viewer** (never a detection overlay) — see `docs/edge-system/PRD.md` Goals 2, 3, 6, 7.
* **Operational Training & Support:** Training programs for system administrators and field operators, accompanied by a 1-year product warranty [09 Proposal (TEXT)].

### Phase 2: Analytical Expansion (Deferred / Future Phase)
These features are out-of-scope for the immediate deployment timeline but represent future capabilities [09 Proposal (TEXT)]:
* **Rear-View Camera Integration:** Secondary camera feeds for dual-perspective validation [09 Proposal (TEXT)].
* **Payload & Volumetric Estimation:** Edge analysis of truck bed geometry to identify underloaded or overloaded haulers [09 Proposal (TEXT)].
* **Tire & Chassis Inspections:** Automated computer vision detection of structural damage, tread wear, or mud build-up on haulage vehicles [09 Proposal (TEXT)].
* **Direct ERP/FMS Deep Integration:** Native API integrations with specialized mining platforms (e.g., CAT MineStar) [09 Proposal (TEXT)].

---

## User Experience (UX) & Workflow Outline

The following workflow describes how the system captures, validates, and displays haulage events without requiring manual intervention in the field [09 Proposal (TEXT)]:

```
 [OHT Hauler Approaches CP]
             │
             ▼
 [Global Shutter Camera Captures Frame Stream] (Sync'd PWM LED Pulse)
             │
             ▼
 [NVIDIA Jetson Orin Local Edge Pipeline]
    ├── 1. Image De-noising & De-hazing (Removes dust/mist)
    ├── 2. Oriented Bounding Box (OBB) Detection (Resolves haul incline/tilt)
    ├── 3. Instance Segmentation (Isolates text through mud)
    └── 4. Local OCR Model Inference
             │
             ▼
 [Temporal Majority Voting (TMV) Logic] (Validates ID over consecutive frames)
             │
             ▼
 [Bifurcated Transmission Protocol]
    ├── Path A (Low Bandwidth): UHF Radio ──────► [Immediate JSON Ingestion] (Near Real-Time)
    └── Path B (High Bandwidth): LTE/Starlink ──► [Visual Evidence Upload] (Buffered if offline)
             │
             ▼
 [Central Riung Sora / TIA Dashboard]
    ├── Correlates UHF telemetry with LTE visual evidence
    └── Renders entry in verified ledger (with Crop + Context image proof)
```

### Dashboard View Design Guidelines
The target monitoring application must present an intuitive interface built around three functional areas [09 Proposal (TEXT)]:
1. **The Live Terminal Feed:** Displays a real-time list of vehicle crossings, featuring:
   * Confirmed Hull ID (e.g., `DT-118` [09 Proposal (TEXT)])
   * Calculated confidence percentage (e.g., `99.8%` [09 Proposal (TEXT)])
   * UTC Absolute Timestamp (synchronized to GNSS master time [09 Proposal (TEXT)])
   * Entry Check Point location and Directional flow
2. **Visual Audit Section:** Clicking any crossing event opens a split pane displaying:
   * **The Cropped Frame:** High-contrast crop of the identified hull number.
   * **The Context Frame:** A wide-angle view of the vehicle to verify load status.
3. **Shift Reporting Module:** Allows operators to generate shift-end summaries comparing actual validated crossings against expected targets [09 Proposal (TEXT)].

---

## Technical Context & Constraints

### 1. Hardware Architecture
The Edge AI platform must be engineered to survive the extreme temperatures, humidity, and constant vibrations of open-pit mining operations [09 Proposal (TEXT)]:

* **Processing Unit:** NVIDIA Jetson Orin Nano Super or Orin NX module, delivering up to 100 TOPS of AI processing capability [09 Proposal (TEXT)].
* **Passive Heat Dissipation:** Fanless industrial chassis with high-reflectivity dual-wall radiant outer shields, separated by a convective air gap to prevent thermal throttling up to +55°C [09 Proposal (TEXT)].
* **Optical Sensors:** IP67-rated global shutter cameras equipped with 120dB+ Wide Dynamic Range (WDR) to manage low sun positions or oncoming high-intensity headlights [09 Proposal (TEXT)].
* **Synchronized Pulse Illumination:** High-lux LED arrays synchronized via Pulse-Width Modulation (PWM) with the camera shutter speed to provide visual contrast without blinding haulers [09 Proposal (TEXT)].
* **Industrial Fasteners:** Standard RJ45 and USB connections are excluded in favor of threaded, gas-tight M12 aviation-grade connectors to resist high-frequency mechanical vibration [09 Proposal (TEXT)].

```
              ┌──────────────────────────────────────────────────────┐
              │           Reflective Powder-Coated Outer Skin        │
              └─────────────────────────┬────────────────────────────┘
                                        │ (25mm Convective Air Gap)
              ┌─────────────────────────▼────────────────────────────┐
              │       NEMA 4X / IP66 Internal Sub-Enclosure          │
              │                                                      │
              │   ┌────────────────────┐    ┌────────────────────┐   │
              │   │ NVIDIA Jetson Orin │    │  Industrial SSD    │   │
              │   │     Edge Module    │    │   (Local Buffer)   │   │
              │   └─────────▲──────────┘    └─────────▲──────────┘   │
              └─────────────┼─────────────────────────┼──────────────┘
                            └───────────┬─────────────┘
                                        │
                            ┌───────────▼─────────────┐
                            │ Threaded M12 Connectors │
                            └─────────────────────────┘
```

### 2. Network Redundancy Architecture
The network layer must maintain data delivery during complete cellular dropouts using two independent hardware links [09 Proposal (TEXT)]:

```
                    ┌───────────────────────────────┐
                    │      Smart Gate Edge Node     │
                    └───────────────┬───────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [Satel UHF Radio Link]             [Teltonika LTE/Starlink]
                  │                                   │
       (JSON Metadata Package)              (Visual Image Evidence)
                  │                                   │
                  ▼                                   ▼
        [Local Site Server]                 [Cloud DB / ERP Engine]
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    ▼
                     [Central Dashboard Integration]
```

### 3. Structural & Power Constraints
* **Physical Footprint:** Designed around a trailer-skid configuration (trailer length $\approx 4\text{m}$, tower height $4-6\text{m}$ [09 Proposal (TEXT)]) to allow transport across unimproved haulage surfaces [09 Proposal (TEXT)].
* **Power Plant:** 100% off-grid system utilizing a minimum 450W-500W Monocrystalline solar panel array paired with a 300Ah Lithium Iron Phosphate (LiFePO4) battery bank [09 Proposal (TEXT)].
* **Battery Longevity:** Minimum of 3000 charge cycles, with a depth of discharge (DoD) optimized to support 72 continuous hours of operation during periods of no solar input [09 Proposal (TEXT)].

---

## Risks, Assumptions, & Open Questions

| Risk/Dependency Classification | Description | Proposed Mitigation / Action Plan |
| :--- | :--- | :--- |
| **Site Infrastructure Dependency** | Deferral of the 4th checkpoint deployment (South CP) due to uncompleted overburden (OB) haulage road access [09 Proposal (TEXT)]. | **Mitigation:** Deploy Phase 1 immediately across the 3 ready checkpoints (North CK, North PPA, and the 1st South CP) [09 Proposal (TEXT)]. Store the 4th node in local inventory, ready to deploy once civil road construction is finalized. |
| **Monsoon Power Outages** | Extreme weather during the monsoon season may exceed the 3-day solar autonomy window, leading to battery depletion [09 Proposal (TEXT)]. | **Mitigation:** Implement a remote "Low-Power Mode" that can be triggered via telemetry when battery capacity falls below 20%, turning off high-draw LTE modules while preserving basic local camera edge captures and low-bandwidth UHF JSON reporting. |
| **Master Data Integration** | The OCR validation engine depends on an up-to-date registry of authorized OHT unit IDs, contractor allocations, and color profiles [09 Proposal (TEXT)]. | **Mitigation:** Establish a clear data-sharing agreement during initial setup [09 Proposal (TEXT)]. Provide PT TIA / PT BIB administrators with a template schema to import and update active fleet rosters. |
| **Software Interface Specifications [TBD]** | The exact API endpoints, MQTT broker topics, and database schemas for PT TIA's internal FMS or ERP (such as CAT MineStar) are not fully defined [09 Proposal (TEXT)]. | **Action Item:** Schedule technical scoping workshops with PT TIA's IT systems team during the engineering design phase to align database schema integration requirements [09 Proposal (TEXT)]. **Partially addressed:** the edge-device-to-induk API surface (crossing ingestion, heartbeat, settings, live view) is now fully specified in `docs/edge-system/API_CONTRACT.md` — the remaining gap is specifically the downstream FMS/ERP integration, not the edge/induk boundary. |