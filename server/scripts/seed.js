import { supabase } from "../lib/supabase.js";

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => iso(new Date(Date.now() + n * DAY));
const addDays = (s, n) => iso(new Date(new Date(s).getTime() + n * DAY));

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) { console.error(`✗ ${label}:`, error.message); process.exit(1); }
  return data;
}

// ---------- 1. Wipe old demo data (safe to re-run) ----------
console.log("Clearing old data...");
await must(supabase.from("entity_links").delete().gte("id", 0), "links");
await must(supabase.from("knowledge_items").delete().gte("id", 0), "knowledge");
await must(supabase.from("transfers").delete().gte("id", 0), "transfers");
await must(supabase.from("documents").delete().gte("id", 0), "documents");
await must(supabase.from("asset_events").delete().gte("id", 0), "events");
await must(supabase.from("assets").delete().neq("id", ""), "assets");

// ---------- 2. Departments + people ----------
const depts = await must(
  supabase.from("departments")
    .upsert([{ name: "CSE" }, { name: "ECE" }, { name: "MECH" }, { name: "ADMIN" }], { onConflict: "name" })
    .select(),
  "departments"
);
const deptId = Object.fromEntries(depts.map((d) => [d.name, d.id]));

const profiles = await must(supabase.from("profiles").select("id, name, role"), "profiles");
const admin = profiles.find((p) => p.role === "admin");
const hod = profiles.find((p) => p.role === "faculty");
if (!admin || !hod) { console.error("Need an admin and a faculty profile first"); process.exit(1); }

// ---------- 3. Assets ----------
const specs = [
  { dept: "CSE", prefix: "CSE-LAB-PC", start: 38, n: 8, type: "Desktop Computer", vendor: "Dell India", cost: 52000, wy: 3, locs: ["CSE Lab 1", "CSE Lab 2"] },
  { dept: "CSE", prefix: "CSE-LAP", start: 1, n: 4, type: "Laptop", vendor: "HP India", cost: 68000, wy: 3, locs: ["Faculty Room", "Project Lab"] },
  { dept: "CSE", prefix: "CSE-PROJ-P", start: 101, n: 3, type: "Projector", vendor: "Epson India", cost: 45000, wy: 2, locs: ["Seminar Hall", "Room 204", "Room 301"] },
  { dept: "CSE", prefix: "CSE-SRV", start: 1, n: 2, type: "Server", vendor: "Lenovo", cost: 310000, wy: 5, locs: ["Server Room"] },
  { dept: "CSE", prefix: "CSE-NET-SW", start: 1, n: 3, type: "Network Switch", vendor: "Cisco", cost: 38000, wy: 5, locs: ["Network Room", "CSE Lab 1"] },
  { dept: "CSE", prefix: "CSE-PRN", start: 1, n: 2, type: "Printer", vendor: "Canon India", cost: 24000, wy: 1, locs: ["Department Office"] },
  { dept: "ECE", prefix: "ECE-OSC", start: 1, n: 4, type: "Digital Oscilloscope", vendor: "Tektronix", cost: 95000, wy: 3, locs: ["ECE Lab 1", "ECE Lab 2"] },
  { dept: "ECE", prefix: "ECE-FG", start: 1, n: 3, type: "Function Generator", vendor: "Keysight", cost: 42000, wy: 3, locs: ["ECE Lab 1", "ECE Lab 2"] },
  { dept: "ECE", prefix: "ECE-RPI", start: 1, n: 4, type: "Raspberry Pi Kit", vendor: "Robu.in", cost: 6500, wy: 1, locs: ["IoT Lab"] },
  { dept: "MECH", prefix: "MECH-3DP", start: 1, n: 2, type: "3D Printer", vendor: "Creality", cost: 85000, wy: 2, locs: ["Workshop", "Design Lab"] },
  { dept: "MECH", prefix: "MECH-CNC", start: 1, n: 1, type: "CNC Trainer", vendor: "Bharat Fritz Werner", cost: 650000, wy: 5, locs: ["Workshop"] },
  { dept: "ADMIN", prefix: "ADM-BUS", start: 1, n: 2, type: "College Bus", vendor: "Ashok Leyland", cost: 2800000, wy: 5, locs: ["Transport Bay"] },
];

const assets = [];
const events = [];
let idx = 0;

for (const s of specs) {
  for (let i = 0; i < s.n; i++) {
    idx++;
    const id = `${s.prefix}-${String(s.start + i).padStart(3, "0")}`;
    const purchase = daysFromNow(-(150 + ((idx * 53) % 600)));
    const warranty = idx % 7 === 0 ? daysFromNow(10 + (idx % 15)) : addDays(purchase, 365 * s.wy);

    const final = s.locs[i % s.locs.length];
    const origin = s.locs[(i + 1) % s.locs.length];
    const moved = s.locs.length > 1 && idx % 3 === 0;

    let lastM = idx % 4 === 0 ? null : daysFromNow(-(30 + ((idx * 17) % 300)));
    if (lastM && lastM < addDays(purchase, 10)) lastM = addDays(purchase, 10);
    const nextM = idx % 5 === 0 ? daysFromNow(-(5 + (idx % 20))) : lastM ? addDays(lastM, 180) : daysFromNow(60);

    const custodian = idx % 11 === 0 ? null : idx % 2 ? hod.id : admin.id;
    const status = !custodian ? "unused" : idx === 13 ? "under_repair" : "active";

    assets.push({
      id, type: s.type, serial_no: `SN${String(100000 + idx * 7919).slice(0, 6)}`,
      vendor: s.vendor, cost: Math.round(s.cost * (0.95 + (idx % 5) * 0.02)),
      purchase_date: purchase, warranty_expiry: warranty,
      department_id: deptId[s.dept], location: final, custodian_id: custodian,
      status, last_maintenance: lastM, next_maintenance: nextM,
    });

    const at = (d) => new Date(d).toISOString();
    events.push({ asset_id: id, event_type: "purchased", to_location: "Central Store", notes: `Purchased from ${s.vendor}`, created_at: at(purchase) });
    events.push({ asset_id: id, event_type: "assigned", to_location: moved ? origin : final, to_user: custodian, approved_by: admin.id, created_at: at(addDays(purchase, 5)) });
    if (moved) {
      events.push({ asset_id: id, event_type: "transferred", from_location: origin, to_location: final, from_user: custodian, to_user: custodian, approved_by: hod.id, notes: "Moved to balance lab usage", created_at: at(addDays(purchase, 90)) });
    }
    if (lastM) {
      events.push({ asset_id: id, event_type: "maintained", approved_by: admin.id, notes: "Routine service and inspection", created_at: at(lastM) });
    }
  }
}

await must(supabase.from("assets").insert(assets), "assets insert");
await must(supabase.from("asset_events").insert(events), "events insert");
console.log(`✓ ${assets.length} assets, ${events.length} lifecycle events`);

// One pending transfer for the demo
await must(
  supabase.from("transfers").insert({ asset_id: "CSE-PROJ-P-102", to_location: "Room 301", requested_by: admin.id, status: "pending" }),
  "transfer"
);

// ---------- 4. Institutional knowledge ----------
const knowledge = [
  { kind: "project", title: "Smart Campus Bus Tracker", dept: "CSE", year: 2025, guide: "Dr. Priya", students: ["Arun", "Kavya", "Rahul"], hardware: ["ECE-RPI-001", "ADM-BUS-001"],
    content: "IoT-based transportation project that tracks college buses in real time using GPS modules and Raspberry Pi. Students see bus location and ETA in a mobile web app. Deployed on two college routes in Chennai." },
  { kind: "project", title: "Crop Disease Detection using CNN", dept: "CSE", year: 2025, guide: "Dr. Suresh", students: ["Meena", "Karthik"], hardware: ["CSE-SRV-001"],
    content: "Deep learning system that identifies leaf diseases in tomato and paddy crops from smartphone photos. Trained a CNN on the PlantVillage dataset with 94% accuracy. Report includes a farmer-friendly mobile interface." },
  { kind: "project", title: "IoT Smart Parking System", dept: "ECE", year: 2024, guide: "Dr. Anand", students: ["Divya", "Vikram"], hardware: ["ECE-RPI-002"],
    content: "Ultrasonic sensors and ESP32 boards detect free parking slots on campus and show availability on a dashboard. An IoT transportation project with MQTT messaging." },
  { kind: "project", title: "Face Recognition Attendance System", dept: "CSE", year: 2024, guide: "Dr. Priya", students: ["Sneha", "Naveen"], hardware: ["CSE-LAP-001"],
    content: "Automated classroom attendance using OpenCV face recognition with a webcam. Reduced attendance time from 5 minutes to under 30 seconds. Includes privacy notes and consent procedure." },
  { kind: "project", title: "Smart Irrigation Controller", dept: "ECE", year: 2025, guide: "Dr. Anand", students: ["Lakshmi", "Prakash"], hardware: ["ECE-RPI-003"],
    content: "Soil moisture sensors drive a pump relay automatically, with weather-based decisions through an API. Aimed at small farms. Related to crop monitoring and agriculture IoT work." },
  { kind: "project", title: "Water Quality Monitoring using IoT", dept: "ECE", year: 2023, guide: "Dr. Meera", students: ["Ashwin", "Harini"], hardware: ["ECE-OSC-001"],
    content: "pH and turbidity sensors send readings from campus water tanks to a cloud dashboard. Alerts are triggered when readings cross safe thresholds." },
  { kind: "project", title: "Traffic Density Estimation for Chennai Junctions", dept: "CSE", year: 2025, guide: "Dr. Suresh", students: ["Rohit", "Pooja"], hardware: ["CSE-SRV-002"],
    content: "Computer vision (YOLO) counts vehicles from junction camera footage to estimate congestion. Transportation analytics project with a signal timing recommendation module." },
  { kind: "project", title: "Campus Helpdesk Chatbot", dept: "CSE", year: 2024, guide: "Dr. Priya", students: ["Janani", "Abishek"], hardware: [],
    content: "NLP chatbot answering student queries on timetables, fee deadlines and exam rules. Built with a retrieval pipeline over college circulars." },
  { kind: "project", title: "Low-Cost 3D Printed Prosthetic Hand", dept: "MECH", year: 2024, guide: "Dr. Raghav", students: ["Surya", "Mohan"], hardware: ["MECH-3DP-001"],
    content: "Prosthetic hand printed in PLA and actuated by servo motors with EMG-style control. Total cost under Rs. 6,000. Documented print settings and lessons learned on tolerance." },
  { kind: "project", title: "Solar Tracker for Rooftop Panels", dept: "MECH", year: 2023, guide: "Dr. Raghav", students: ["Deepak", "Nisha"], hardware: [],
    content: "Dual-axis solar tracker using LDR sensors and stepper motors improved panel output by about 22% over fixed panels in tests on the MECH block rooftop." },
  { kind: "decision", title: "Decision: Replace Lab 1 desktops in 2025", dept: "CSE", year: 2025, guide: "Dr. Priya", students: [], hardware: ["CSE-LAB-PC-042"],
    content: "HOD approved replacing the older Lab 1 desktops because they could not run the new AI/ML coursework, had failing hard disks, and repair costs exceeded 40% of replacement cost. Old machines were moved to the practice lab or marked unused." },
  { kind: "procedure", title: "Oscilloscope Calibration Procedure", dept: "ECE", year: 2024, guide: "Dr. Anand", students: [], hardware: ["ECE-OSC-001"],
    content: "Calibrate every 6 months. Warm up the device for 30 minutes, run the self-calibration, verify with the 1 kHz probe compensation signal, and record results in the lab log. Report failures to the lab in-charge." },
  { kind: "meeting", title: "Lab Upgrade Review Meeting, March 2026", dept: "CSE", year: 2026, guide: "Dr. Priya", students: [], hardware: ["CSE-PROJ-P-102"],
    content: "Reviewed projector shortages. Decided to move one projector from the Seminar Hall to Room 301 for the new semester and to retire two units whose lamps were beyond service life." },
];

const inserted = await must(
  supabase.from("knowledge_items")
    .insert(knowledge.map((k) => ({ kind: k.kind, title: k.title, content: k.content, department_id: deptId[k.dept], year: k.year, faculty_guide: k.guide })))
    .select("id, title"),
  "knowledge insert"
);
const kid = Object.fromEntries(inserted.map((r) => [r.title, r.id]));

// ---------- 5. Knowledge graph links ----------
const assetIds = new Set(assets.map((a) => a.id));
const links = [];
for (const k of knowledge) {
  const from = { from_type: k.kind, from_id: String(kid[k.title]) };
  links.push({ ...from, to_type: "person", to_id: k.guide, relation: "guided_by" });
  links.push({ ...from, to_type: "department", to_id: k.dept, relation: "belongs_to" });
  k.students.forEach((s) => links.push({ ...from, to_type: "person", to_id: s, relation: "built_by" }));
  k.hardware.filter((h) => assetIds.has(h)).forEach((h) =>
    links.push({ ...from, to_type: "asset", to_id: h, relation: "used_hardware" })
  );
}
await must(supabase.from("entity_links").insert(links), "links insert");

console.log(`✓ ${knowledge.length} knowledge items, ${links.length} graph links`);
console.log("Seed complete.");