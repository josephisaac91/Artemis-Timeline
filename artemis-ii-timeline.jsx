import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── MISSION DATA ────────────────────────────────────────────────────────────
const CREW = [
  { name: "Reid Wiseman", role: "Commander", abbr: "RW", color: "#4FC3F7" },
  { name: "Victor Glover", role: "Pilot", abbr: "VG", color: "#81C784" },
  { name: "Christina Koch", role: "Mission Specialist", abbr: "CK", color: "#F48FB1" },
  { name: "Jeremy Hansen", role: "Mission Specialist (CSA)", abbr: "JH", color: "#FFD54F" },
];

// All times in EDT (UTC-4), stored as epoch ms
const edt = (dateStr) => {
  const d = new Date(dateStr + " GMT-0400");
  return d.getTime();
};

const MISSION_START = edt("2026-04-01 09:25:00"); // Crew wake-up
const MISSION_END = edt("2026-04-10 22:00:00"); // Post-splashdown
const MISSION_DURATION = MISSION_END - MISSION_START;

// Key trajectory waypoints: [time_ms, earth_distance_miles, moon_distance_miles, x_norm, y_norm]
// x_norm and y_norm are normalized coordinates for the 2D figure-8 path (0-1 range)
// Earth at (0.15, 0.5), Moon at (0.85, 0.5)
const TRAJECTORY = [
  // Flight Day 1 - Launch (Apr 1)
  { t: edt("2026-04-01 18:35:00"), earthDist: 0, moonDist: 238900, label: "Liftoff", x: 0.15, y: 0.5 },
  { t: edt("2026-04-01 18:43:00"), earthDist: 100, moonDist: 238800, label: "In orbit", x: 0.155, y: 0.48 },
  { t: edt("2026-04-01 22:00:00"), earthDist: 200, moonDist: 238700, label: "Earth orbit", x: 0.16, y: 0.45 },
  // Flight Day 2 - TLI (Apr 2)
  { t: edt("2026-04-02 12:00:00"), earthDist: 250, moonDist: 238650, label: "Pre-TLI orbit", x: 0.16, y: 0.42 },
  { t: edt("2026-04-02 19:49:00"), earthDist: 300, moonDist: 238600, label: "TLI burn", x: 0.17, y: 0.38 },
  { t: edt("2026-04-02 22:00:00"), earthDist: 5000, moonDist: 233900, label: "Outbound", x: 0.19, y: 0.35 },
  // Flight Day 3 (Apr 3)
  { t: edt("2026-04-03 12:00:00"), earthDist: 40000, moonDist: 198900, label: "Coast to Moon", x: 0.25, y: 0.30 },
  { t: edt("2026-04-03 23:00:00"), earthDist: 80000, moonDist: 158900, label: "Deep space", x: 0.33, y: 0.27 },
  // Flight Day 4 (Apr 4)
  { t: edt("2026-04-04 12:00:00"), earthDist: 120000, moonDist: 118900, label: "Halfway", x: 0.42, y: 0.26 },
  { t: edt("2026-04-04 23:00:00"), earthDist: 155000, moonDist: 83900, label: "Approaching Moon", x: 0.50, y: 0.28 },
  // Flight Day 5 (Apr 5)
  { t: edt("2026-04-05 12:00:00"), earthDist: 190000, moonDist: 48900, label: "Lunar approach", x: 0.58, y: 0.32 },
  { t: edt("2026-04-05 23:00:00"), earthDist: 220000, moonDist: 18900, label: "Near Moon", x: 0.68, y: 0.37 },
  // Flight Day 6 - Flyby (Apr 6)
  { t: edt("2026-04-06 00:37:00"), earthDist: 225000, moonDist: 14000, label: "Lunar sphere of influence", x: 0.70, y: 0.38 },
  { t: edt("2026-04-06 13:56:00"), earthDist: 252756, moonDist: 6000, label: "Distance record!", x: 0.80, y: 0.42 },
  { t: edt("2026-04-06 14:45:00"), earthDist: 252000, moonDist: 5500, label: "Observation begins", x: 0.82, y: 0.44 },
  { t: edt("2026-04-06 18:44:00"), earthDist: 250000, moonDist: 4200, label: "Comm blackout (behind Moon)", x: 0.87, y: 0.48 },
  { t: edt("2026-04-06 19:02:00"), earthDist: 249000, moonDist: 4070, label: "Closest approach!", x: 0.88, y: 0.50 },
  { t: edt("2026-04-06 19:25:00"), earthDist: 248500, moonDist: 4500, label: "Earthrise / Comm restored", x: 0.87, y: 0.52 },
  { t: edt("2026-04-06 22:00:00"), earthDist: 245000, moonDist: 10000, label: "Post-flyby", x: 0.83, y: 0.58 },
  // Flight Day 7 (Apr 7) - Return begins
  { t: edt("2026-04-07 12:00:00"), earthDist: 236022, moonDist: 36286, label: "Return trajectory", x: 0.72, y: 0.65 },
  { t: edt("2026-04-07 20:03:00"), earthDist: 220000, moonDist: 50000, label: "Return correction burn", x: 0.64, y: 0.70 },
  // Flight Day 8 (Apr 8)
  { t: edt("2026-04-08 12:00:00"), earthDist: 175000, moonDist: 95000, label: "Homeward bound", x: 0.52, y: 0.73 },
  { t: edt("2026-04-08 23:00:00"), earthDist: 140000, moonDist: 130000, label: "Coasting home", x: 0.42, y: 0.72 },
  // Flight Day 9 (Apr 9)
  { t: edt("2026-04-09 12:00:00"), earthDist: 95000, moonDist: 175000, label: "Approaching Earth", x: 0.33, y: 0.68 },
  { t: edt("2026-04-09 23:00:00"), earthDist: 50000, moonDist: 220000, label: "Earth approach", x: 0.25, y: 0.62 },
  // Flight Day 10 - Splashdown (Apr 10)
  { t: edt("2026-04-10 12:00:00"), earthDist: 15000, moonDist: 253000, label: "Final approach", x: 0.19, y: 0.56 },
  { t: edt("2026-04-10 19:53:00"), earthDist: 75, moonDist: 238900, label: "Reentry blackout", x: 0.155, y: 0.52 },
  { t: edt("2026-04-10 20:03:00"), earthDist: 4, moonDist: 238900, label: "Drogue chutes", x: 0.152, y: 0.51 },
  { t: edt("2026-04-10 20:07:00"), earthDist: 0, moonDist: 238900, label: "Splashdown!", x: 0.15, y: 0.5 },
];

// Major mission events
const EVENTS = [
  { t: edt("2026-04-01 09:25:00"), title: "Crew Wake-Up", desc: "Astronauts wake at Kennedy Space Center", icon: "☀️", category: "milestone" },
  { t: edt("2026-04-01 12:50:00"), title: "Suit Up", desc: "Crew dons orange Orion Crew Survival System suits", icon: "🧑‍🚀", category: "crew" },
  { t: edt("2026-04-01 14:30:00"), title: "Board Orion", desc: "Crew boards spacecraft at Pad 39B", icon: "🚀", category: "crew" },
  { t: edt("2026-04-01 18:35:00"), title: "LIFTOFF", desc: "SLS launches from Kennedy Space Center LC-39B", icon: "🔥", category: "milestone" },
  { t: edt("2026-04-01 18:43:00"), title: "Orbit Insertion", desc: "Orion reaches Earth orbit ~8 min after launch", icon: "🌍", category: "maneuver" },
  { t: edt("2026-04-02 19:49:00"), title: "Translunar Injection", desc: "5 min 50 sec burn sends crew toward the Moon", icon: "🌙", category: "milestone" },
  { t: edt("2026-04-03 12:00:00"), title: "First Correction Burn", desc: "Trajectory correction on the way to the Moon", icon: "🔧", category: "maneuver" },
  { t: edt("2026-04-04 12:00:00"), title: "Manual Piloting Demo", desc: "Crew demonstrates manual spacecraft control", icon: "🎮", category: "crew" },
  { t: edt("2026-04-05 12:00:00"), title: "Suit Pressure Tests", desc: "Crew tests Orion Crew Survival System suits in space", icon: "🧪", category: "science" },
  { t: edt("2026-04-05 15:00:00"), title: "CPR Demo in Space", desc: "Glover, Koch & Hansen demonstrate CPR procedures", icon: "❤️", category: "science" },
  { t: edt("2026-04-06 00:37:00"), title: "Lunar Sphere of Influence", desc: "Orion enters the Moon's gravitational dominance", icon: "🌑", category: "milestone" },
  { t: edt("2026-04-06 13:56:00"), title: "DISTANCE RECORD", desc: "Farthest humans from Earth: 252,756 miles — surpassing Apollo 13", icon: "🏆", category: "milestone" },
  { t: edt("2026-04-06 14:45:00"), title: "Lunar Observation Begins", desc: "7-hour science flyby with 35 observation targets", icon: "🔭", category: "science" },
  { t: edt("2026-04-06 18:44:00"), title: "COMM BLACKOUT", desc: "Orion passes behind the Moon — 40 min silence", icon: "📡", category: "milestone" },
  { t: edt("2026-04-06 18:45:00"), title: "Earthset", desc: "Earth disappears behind the Moon from crew's view", icon: "🌅", category: "milestone" },
  { t: edt("2026-04-06 19:02:00"), title: "CLOSEST APPROACH", desc: "4,070 miles above the lunar surface", icon: "🌕", category: "milestone" },
  { t: edt("2026-04-06 19:07:00"), title: "Maximum Distance", desc: "252,760 miles from Earth — farthest point reached", icon: "📏", category: "milestone" },
  { t: edt("2026-04-06 19:25:00"), title: "EARTHRISE", desc: "Earth reappears — comms restored with Houston", icon: "🌎", category: "milestone" },
  { t: edt("2026-04-07 12:00:00"), title: "Group Photo", desc: "Crew pauses for iconic group photo inside Orion", icon: "📸", category: "photo" },
  { t: edt("2026-04-07 20:03:00"), title: "Return Correction Burn", desc: "15-second burn adjusts course toward Earth", icon: "🔧", category: "maneuver" },
  { t: edt("2026-04-08 12:00:00"), title: "Orthostatic Tests", desc: "Crew tests garments for gravity readjustment", icon: "🧪", category: "science" },
  { t: edt("2026-04-08 21:59:00"), title: "Manual Piloting Demo 2", desc: "Second manual control demonstration", icon: "🎮", category: "crew" },
  { t: edt("2026-04-09 12:00:00"), title: "Stowage & Prep", desc: "Crew begins securing cabin for reentry", icon: "📦", category: "crew" },
  { t: edt("2026-04-10 12:00:00"), title: "Reentry Prep", desc: "Final weather briefing and seat adjustments", icon: "🪂", category: "crew" },
  { t: edt("2026-04-10 19:53:00"), title: "REENTRY BLACKOUT", desc: "Plasma blackout at 400,000 ft — 35x speed of sound", icon: "🔥", category: "milestone" },
  { t: edt("2026-04-10 20:03:00"), title: "Drogue Chutes", desc: "Parachutes deploy at 22,000 ft", icon: "🪂", category: "maneuver" },
  { t: edt("2026-04-10 20:04:00"), title: "Main Chutes", desc: "Three main parachutes open at 6,000 ft", icon: "🪂", category: "maneuver" },
  { t: edt("2026-04-10 20:07:00"), title: "SPLASHDOWN", desc: "Pacific Ocean, off San Diego — Welcome home!", icon: "🌊", category: "milestone" },
];

// Comm blackout periods
const BLACKOUTS = [
  { start: edt("2026-04-06 18:44:00"), end: edt("2026-04-06 19:25:00"), label: "Lunar comm blackout" },
  { start: edt("2026-04-10 19:53:00"), end: edt("2026-04-10 19:59:00"), label: "Reentry plasma blackout" },
];

// Mission control quotes
const QUOTES = [
  { t: edt("2026-04-01 18:35:00"), speaker: "Launch Director", text: "And liftoff of Artemis II — America returns to the Moon with crew!" },
  { t: edt("2026-04-02 19:55:00"), speaker: "CAPCOM", text: "Integrity, Houston. TLI is complete. You are on your way to the Moon." },
  { t: edt("2026-04-06 13:56:00"), speaker: "CAPCOM", text: "Integrity, you have just traveled farther from Earth than any human in history." },
  { t: edt("2026-04-06 18:44:00"), speaker: "CAPCOM", text: "Integrity, Houston. You're about to go behind the Moon. We'll see you on the other side." },
  { t: edt("2026-04-06 19:25:00"), speaker: "Reid Wiseman", text: "Houston, Integrity. We see Earth again. What a sight." },
  { t: edt("2026-04-10 20:07:00"), speaker: "Recovery Director", text: "Welcome home, Integrity. Splashdown confirmed." },
];

// Crew sleep/wake schedule (approximate, based on NASA blog data)
const CREW_SCHEDULE = {
  // Each entry: [startTime, endTime, activity]
  // Activities: "sleep", "exercise", "science", "piloting", "suit-ops", "observation", "reentry-prep", "free"
  all: [
    // FD1 - Launch day
    { start: edt("2026-04-01 09:25:00"), end: edt("2026-04-01 12:50:00"), activity: "free", label: "Pre-launch prep" },
    { start: edt("2026-04-01 12:50:00"), end: edt("2026-04-01 14:30:00"), activity: "suit-ops", label: "Suit up" },
    { start: edt("2026-04-01 14:30:00"), end: edt("2026-04-01 18:35:00"), activity: "free", label: "In spacecraft" },
    { start: edt("2026-04-01 18:35:00"), end: edt("2026-04-01 22:00:00"), activity: "piloting", label: "Launch & orbit ops" },
    { start: edt("2026-04-01 22:00:00"), end: edt("2026-04-02 02:00:00"), activity: "sleep", label: "Sleep (short)" },
    // FD2
    { start: edt("2026-04-02 06:00:00"), end: edt("2026-04-02 08:00:00"), activity: "free", label: "Wake & meals" },
    { start: edt("2026-04-02 08:00:00"), end: edt("2026-04-02 12:00:00"), activity: "science", label: "Systems checkout" },
    { start: edt("2026-04-02 12:00:00"), end: edt("2026-04-02 19:49:00"), activity: "piloting", label: "TLI prep" },
    { start: edt("2026-04-02 19:49:00"), end: edt("2026-04-02 21:00:00"), activity: "piloting", label: "TLI burn" },
    { start: edt("2026-04-02 21:00:00"), end: edt("2026-04-03 03:00:00"), activity: "sleep", label: "Sleep" },
    // FD3
    { start: edt("2026-04-03 11:00:00"), end: edt("2026-04-03 13:00:00"), activity: "exercise", label: "Exercise" },
    { start: edt("2026-04-03 13:00:00"), end: edt("2026-04-03 18:00:00"), activity: "science", label: "Correction burn prep" },
    { start: edt("2026-04-03 18:00:00"), end: edt("2026-04-03 22:00:00"), activity: "free", label: "Free time & meals" },
    { start: edt("2026-04-03 22:00:00"), end: edt("2026-04-04 03:00:00"), activity: "sleep", label: "Sleep" },
    // FD4
    { start: edt("2026-04-04 11:35:00"), end: edt("2026-04-04 14:00:00"), activity: "exercise", label: "Exercise" },
    { start: edt("2026-04-04 14:00:00"), end: edt("2026-04-04 20:00:00"), activity: "piloting", label: "Manual piloting demo" },
    { start: edt("2026-04-04 20:00:00"), end: edt("2026-04-05 03:15:00"), activity: "sleep", label: "Sleep" },
    // FD5
    { start: edt("2026-04-05 12:00:00"), end: edt("2026-04-05 15:00:00"), activity: "suit-ops", label: "Suit pressure tests" },
    { start: edt("2026-04-05 15:00:00"), end: edt("2026-04-05 17:00:00"), activity: "science", label: "CPR demo & medical" },
    { start: edt("2026-04-05 17:00:00"), end: edt("2026-04-05 20:00:00"), activity: "science", label: "Flyby prep" },
    { start: edt("2026-04-05 20:00:00"), end: edt("2026-04-06 02:20:00"), activity: "sleep", label: "Sleep" },
    // FD6 - Flyby!
    { start: edt("2026-04-06 10:50:00"), end: edt("2026-04-06 13:30:00"), activity: "science", label: "Flyby prep" },
    { start: edt("2026-04-06 13:30:00"), end: edt("2026-04-06 14:45:00"), activity: "science", label: "Science briefing" },
    { start: edt("2026-04-06 14:45:00"), end: edt("2026-04-06 21:45:00"), activity: "observation", label: "LUNAR FLYBY" },
    { start: edt("2026-04-06 21:45:00"), end: edt("2026-04-07 03:00:00"), activity: "sleep", label: "Sleep" },
    // FD7
    { start: edt("2026-04-07 11:00:00"), end: edt("2026-04-07 13:00:00"), activity: "free", label: "Group photo & meals" },
    { start: edt("2026-04-07 13:00:00"), end: edt("2026-04-07 18:00:00"), activity: "science", label: "Science activities" },
    { start: edt("2026-04-07 18:00:00"), end: edt("2026-04-07 21:00:00"), activity: "piloting", label: "Return correction burn" },
    { start: edt("2026-04-07 21:00:00"), end: edt("2026-04-08 03:00:00"), activity: "sleep", label: "Sleep" },
    // FD8
    { start: edt("2026-04-08 11:00:00"), end: edt("2026-04-08 14:00:00"), activity: "science", label: "Orthostatic garment test" },
    { start: edt("2026-04-08 14:00:00"), end: edt("2026-04-08 18:00:00"), activity: "exercise", label: "Exercise" },
    { start: edt("2026-04-08 18:00:00"), end: edt("2026-04-08 22:00:00"), activity: "piloting", label: "Manual piloting demo 2" },
    { start: edt("2026-04-08 22:00:00"), end: edt("2026-04-09 03:00:00"), activity: "sleep", label: "Sleep" },
    // FD9
    { start: edt("2026-04-09 11:00:00"), end: edt("2026-04-09 18:00:00"), activity: "reentry-prep", label: "Stowage & reentry prep" },
    { start: edt("2026-04-09 18:00:00"), end: edt("2026-04-09 22:00:00"), activity: "free", label: "Final free time" },
    { start: edt("2026-04-09 22:00:00"), end: edt("2026-04-10 03:00:00"), activity: "sleep", label: "Sleep" },
    // FD10 - Splashdown
    { start: edt("2026-04-10 10:00:00"), end: edt("2026-04-10 15:00:00"), activity: "reentry-prep", label: "Final reentry prep" },
    { start: edt("2026-04-10 15:00:00"), end: edt("2026-04-10 19:53:00"), activity: "suit-ops", label: "Suited for reentry" },
    { start: edt("2026-04-10 19:53:00"), end: edt("2026-04-10 20:07:00"), activity: "piloting", label: "REENTRY & LANDING" },
  ],
};

// Photos (using Flickr data found through research)
const PHOTOS = [
  {
    id: 1,
    t: edt("2026-04-03 16:00:00"),
    title: "Spaceship Earth",
    desc: "Christina Koch peers out of Orion's window, looking back at Earth as the crew travels toward the Moon",
    url: "https://live.staticflickr.com/65535/55187293546_7a0c0b7d6e_b.jpg",
    flickrUrl: "https://www.flickr.com/photos/nasa2explore/55187293546/",
    credit: "NASA/JSC",
  },
  {
    id: 2,
    t: edt("2026-04-06 15:00:00"),
    title: "Lunar Observation",
    desc: "Commander Reid Wiseman peers out the window as his first lunar observation period begins",
    url: "https://live.staticflickr.com/65535/55192164982_8b2d7c9e4a_b.jpg",
    flickrUrl: "https://www.flickr.com/photos/nasa2explore/55192164982/",
    credit: "NASA/JSC",
  },
  {
    id: 3,
    t: edt("2026-04-06 19:00:00"),
    title: "Artemis II in Eclipse",
    desc: "The Moon fully eclipses the Sun as captured by the Artemis II crew during the lunar flyby",
    url: "https://live.staticflickr.com/65535/55193054741_4e3b8c1d5f_b.jpg",
    flickrUrl: "https://www.flickr.com/photos/nasa2explore/55193054741",
    credit: "NASA/JSC",
  },
  {
    id: 4,
    t: edt("2026-04-07 12:00:00"),
    title: "Crew Group Photo",
    desc: "The Artemis II crew poses inside Orion: Koch, Hansen, Wiseman, and Glover",
    url: "https://live.staticflickr.com/65535/55194658516_2c4a8f0e9b_b.jpg",
    flickrUrl: "https://www.flickr.com/photos/nasa2explore/55194658516",
    credit: "NASA/JSC",
  },
];

// Flight day labels
const FLIGHT_DAYS = [
  { day: 1, date: "Apr 1", start: edt("2026-04-01 09:25:00"), label: "Launch" },
  { day: 2, date: "Apr 2", start: edt("2026-04-02 06:00:00"), label: "TLI" },
  { day: 3, date: "Apr 3", start: edt("2026-04-03 06:00:00"), label: "Outbound" },
  { day: 4, date: "Apr 4", start: edt("2026-04-04 06:00:00"), label: "Piloting" },
  { day: 5, date: "Apr 5", start: edt("2026-04-05 06:00:00"), label: "Suit Tests" },
  { day: 6, date: "Apr 6", start: edt("2026-04-06 06:00:00"), label: "FLYBY" },
  { day: 7, date: "Apr 7", start: edt("2026-04-07 06:00:00"), label: "Return" },
  { day: 8, date: "Apr 8", start: edt("2026-04-08 06:00:00"), label: "Tests" },
  { day: 9, date: "Apr 9", start: edt("2026-04-09 06:00:00"), label: "Prep" },
  { day: 10, date: "Apr 10", start: edt("2026-04-10 06:00:00"), label: "SPLASHDOWN" },
];

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }

function getTrajectoryAt(timeMs) {
  if (timeMs <= TRAJECTORY[0].t) return TRAJECTORY[0];
  if (timeMs >= TRAJECTORY[TRAJECTORY.length - 1].t) return TRAJECTORY[TRAJECTORY.length - 1];
  for (let i = 0; i < TRAJECTORY.length - 1; i++) {
    if (timeMs >= TRAJECTORY[i].t && timeMs <= TRAJECTORY[i + 1].t) {
      const progress = (timeMs - TRAJECTORY[i].t) / (TRAJECTORY[i + 1].t - TRAJECTORY[i].t);
      return {
        earthDist: lerp(TRAJECTORY[i].earthDist, TRAJECTORY[i + 1].earthDist, progress),
        moonDist: lerp(TRAJECTORY[i].moonDist, TRAJECTORY[i + 1].moonDist, progress),
        x: lerp(TRAJECTORY[i].x, TRAJECTORY[i + 1].x, progress),
        y: lerp(TRAJECTORY[i].y, TRAJECTORY[i + 1].y, progress),
        label: TRAJECTORY[i].label,
      };
    }
  }
  return TRAJECTORY[0];
}

function isInBlackout(timeMs) {
  return BLACKOUTS.find(b => timeMs >= b.start && timeMs <= b.end);
}

function formatNumber(n) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatTime(ms) {
  const d = new Date(ms);
  return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) + " EDT";
}

function formatTimeShort(ms) {
  const d = new Date(ms);
  return d.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true });
}

// ─── ACTIVITY COLORS ─────────────────────────────────────────────────────────
const ACTIVITY_COLORS = {
  sleep: "#1a237e",
  exercise: "#2e7d32",
  science: "#0277bd",
  piloting: "#e65100",
  "suit-ops": "#6a1b9a",
  observation: "#ffd600",
  "reentry-prep": "#b71c1c",
  free: "#37474f",
};

const ACTIVITY_LABELS = {
  sleep: "Sleep",
  exercise: "Exercise",
  science: "Science & Testing",
  piloting: "Piloting & Burns",
  "suit-ops": "Suit Operations",
  observation: "Lunar Observation",
  "reentry-prep": "Reentry Prep",
  free: "Free Time / Meals",
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

// 2D Orbital Visualization
function OrbitalView({ currentTime, width = 600, height = 400 }) {
  const canvasRef = useRef(null);
  const traj = getTrajectoryAt(currentTime);
  const blackout = isInBlackout(currentTime);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = width;
    const H = height;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, W, H);

    // Stars
    const starSeed = 42;
    for (let i = 0; i < 120; i++) {
      const sx = ((starSeed * (i + 1) * 7919) % W);
      const sy = ((starSeed * (i + 1) * 6271) % H);
      const brightness = 0.2 + ((i * 31) % 80) / 100;
      ctx.fillStyle = `rgba(255,255,255,${brightness})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw trajectory path
    ctx.beginPath();
    ctx.strokeStyle = "rgba(100,150,255,0.2)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < TRAJECTORY.length; i++) {
      const px = TRAJECTORY[i].x * W;
      const py = TRAJECTORY[i].y * H;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Draw traveled path
    ctx.beginPath();
    ctx.strokeStyle = "rgba(100,200,255,0.6)";
    ctx.lineWidth = 2;
    for (let i = 0; i < TRAJECTORY.length; i++) {
      if (TRAJECTORY[i].t > currentTime) break;
      const px = TRAJECTORY[i].x * W;
      const py = TRAJECTORY[i].y * H;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    // Add current position
    ctx.lineTo(traj.x * W, traj.y * H);
    ctx.stroke();

    // Earth
    const ex = 0.15 * W, ey = 0.5 * H, er = 18;
    const earthGrad = ctx.createRadialGradient(ex - 4, ey - 4, 2, ex, ey, er);
    earthGrad.addColorStop(0, "#6db3f2");
    earthGrad.addColorStop(0.5, "#1e88e5");
    earthGrad.addColorStop(1, "#0d47a1");
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();
    // Earth glow
    ctx.beginPath();
    ctx.arc(ex, ey, er + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(30,136,229,0.15)";
    ctx.fill();
    ctx.fillStyle = "#8ec8ff";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Earth", ex, ey + er + 16);

    // Moon
    const mx = 0.85 * W, my = 0.5 * H, mr = 10;
    const moonGrad = ctx.createRadialGradient(mx - 2, my - 2, 1, mx, my, mr);
    moonGrad.addColorStop(0, "#e0e0e0");
    moonGrad.addColorStop(0.5, "#bdbdbd");
    moonGrad.addColorStop(1, "#757575");
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = moonGrad;
    ctx.fill();
    // Moon glow
    ctx.beginPath();
    ctx.arc(mx, my, mr + 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,200,200,0.1)";
    ctx.fill();
    ctx.fillStyle = "#bbb";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Moon", mx, my + mr + 16);

    // Spacecraft
    const sx = traj.x * W;
    const sy = traj.y * H;

    // Spacecraft glow
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fillStyle = blackout ? "rgba(255,60,60,0.3)" : "rgba(255,200,50,0.3)";
    ctx.fill();
    // Spacecraft dot
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fillStyle = blackout ? "#ff4444" : "#FFD54F";
    ctx.fill();
    // Spacecraft label
    ctx.fillStyle = blackout ? "#ff6666" : "#FFD54F";
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Orion", sx + 10, sy - 4);
    ctx.font = "10px system-ui";
    ctx.fillStyle = "#999";
    ctx.fillText(traj.label || "", sx + 10, sy + 10);

    // Distance line to Earth (dashed)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(100,180,255,0.2)";
    ctx.lineWidth = 1;
    ctx.moveTo(ex, ey);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance line to Moon (dashed)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(200,200,200,0.15)";
    ctx.lineWidth = 1;
    ctx.moveTo(mx, my);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Blackout overlay
    if (blackout) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("SIGNAL LOST", W / 2, 30);
      ctx.font = "11px system-ui";
      ctx.fillStyle = "#ff8888";
      ctx.fillText(blackout.label, W / 2, 48);
    }
  }, [currentTime, width, height, traj, blackout]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ borderRadius: 8, border: "1px solid #1a1a2e" }} />;
}

// Distance Counter
function DistanceCounter({ currentTime }) {
  const traj = getTrajectoryAt(currentTime);
  const isRecord = traj.earthDist >= 252000;

  return (
    <div style={{ display: "flex", gap: 24, justifyContent: "center", padding: "12px 0" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>Distance from Earth</div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Courier New', monospace", color: isRecord ? "#ffd600" : "#4FC3F7", textShadow: isRecord ? "0 0 20px rgba(255,214,0,0.5)" : "none" }}>
          {formatNumber(traj.earthDist)} <span style={{ fontSize: 14, color: "#888" }}>mi</span>
        </div>
        {isRecord && <div style={{ color: "#ffd600", fontSize: 11, fontWeight: 600 }}>RECORD DISTANCE</div>}
      </div>
      <div style={{ width: 1, background: "#222" }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>Distance from Moon</div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Courier New', monospace", color: traj.moonDist < 5000 ? "#ffd600" : "#bbb" }}>
          {formatNumber(traj.moonDist)} <span style={{ fontSize: 14, color: "#888" }}>mi</span>
        </div>
        {traj.moonDist <= 4070 && <div style={{ color: "#ffd600", fontSize: 11, fontWeight: 600 }}>CLOSEST APPROACH</div>}
      </div>
    </div>
  );
}

// Quote Display
function QuoteDisplay({ currentTime }) {
  const activeQuote = useMemo(() => {
    let best = null;
    for (const q of QUOTES) {
      const diff = currentTime - q.t;
      if (diff >= 0 && diff < 3600000) { // Show quote for 1 hour after its time
        if (!best || q.t > best.t) best = q;
      }
    }
    return best;
  }, [currentTime]);

  if (!activeQuote) return null;

  return (
    <div style={{
      textAlign: "center",
      padding: "12px 20px",
      background: "rgba(255,255,255,0.03)",
      borderRadius: 8,
      borderLeft: "3px solid #4FC3F7",
      margin: "8px 0",
    }}>
      <div style={{ color: "#ccc", fontSize: 14, fontStyle: "italic" }}>"{activeQuote.text}"</div>
      <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>— {activeQuote.speaker}</div>
    </div>
  );
}

// Crew Activity Swimlanes
function CrewSwimlines({ currentTime }) {
  const windowHours = 8;
  const windowMs = windowHours * 3600000;
  const windowStart = currentTime - windowMs / 2;
  const windowEnd = currentTime + windowMs / 2;

  const visibleActivities = CREW_SCHEDULE.all.filter(
    a => a.end > windowStart && a.start < windowEnd
  );

  const barHeight = 22;
  const labelWidth = 100;
  const totalWidth = 500;
  const trackWidth = totalWidth - labelWidth;

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Crew Schedule</div>
      <svg width={totalWidth} height={barHeight + 20} style={{ overflow: "visible" }}>
        {/* Time labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const t = windowStart + frac * windowMs;
          return (
            <text key={i} x={labelWidth + frac * trackWidth} y={10} fill="#555" fontSize={9} textAnchor="middle">
              {formatTimeShort(t)}
            </text>
          );
        })}
        {/* Activity bars */}
        {visibleActivities.map((a, i) => {
          const startFrac = Math.max(0, (a.start - windowStart) / windowMs);
          const endFrac = Math.min(1, (a.end - windowStart) / windowMs);
          const x = labelWidth + startFrac * trackWidth;
          const w = (endFrac - startFrac) * trackWidth;
          if (w < 1) return null;
          return (
            <g key={i}>
              <rect x={x} y={16} width={w} height={barHeight} rx={3}
                fill={ACTIVITY_COLORS[a.activity] || "#333"} opacity={0.8} />
              {w > 40 && (
                <text x={x + w / 2} y={16 + barHeight / 2 + 4} fill="white" fontSize={9}
                  textAnchor="middle" fontWeight={600}>{a.label}</text>
              )}
            </g>
          );
        })}
        {/* Current time indicator */}
        <line x1={labelWidth + trackWidth / 2} y1={14} x2={labelWidth + trackWidth / 2} y2={16 + barHeight + 2}
          stroke="#ffd600" strokeWidth={2} />
      </svg>
      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 8 }}>
        {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: ACTIVITY_COLORS[key] }} />
            <span style={{ color: "#888", fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Photo Gallery
function PhotoGallery({ currentTime, onPhotoClick }) {
  const nearbyPhotos = PHOTOS.filter(p => {
    const diff = Math.abs(currentTime - p.t);
    return diff < 24 * 3600000; // Show photos within 24 hours
  }).sort((a, b) => Math.abs(a.t - currentTime) - Math.abs(b.t - currentTime));

  if (nearbyPhotos.length === 0) return null;

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Mission Photos</div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {nearbyPhotos.map(photo => (
          <div key={photo.id} onClick={() => onPhotoClick(photo)}
            style={{
              minWidth: 160, cursor: "pointer", borderRadius: 8, overflow: "hidden",
              border: "1px solid #222", background: "#111", transition: "transform 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <img src={photo.url} alt={photo.title}
              style={{ width: 160, height: 100, objectFit: "cover" }}
              onError={e => { e.target.style.display = "none"; }}
            />
            <div style={{ padding: "6px 8px" }}>
              <div style={{ color: "#ccc", fontSize: 11, fontWeight: 600 }}>{photo.title}</div>
              <div style={{ color: "#666", fontSize: 10 }}>{formatTime(photo.t)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Photo Modal
function PhotoModal({ photo, onClose }) {
  if (!photo) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.9)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        maxWidth: "90vw", maxHeight: "90vh", background: "#111",
        borderRadius: 12, overflow: "hidden", border: "1px solid #333",
      }}>
        <img src={photo.url} alt={photo.title}
          style={{ maxWidth: "90vw", maxHeight: "70vh", objectFit: "contain" }}
          onError={e => { e.target.alt = "Photo unavailable"; }}
        />
        <div style={{ padding: "16px 20px" }}>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>{photo.title}</div>
          <div style={{ color: "#aaa", fontSize: 13, marginTop: 4 }}>{photo.desc}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ color: "#666", fontSize: 12 }}>{formatTime(photo.t)}</span>
            <span style={{ color: "#666", fontSize: 12 }}>{photo.credit}</span>
          </div>
          <a href={photo.flickrUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: "#4FC3F7", fontSize: 12, textDecoration: "none", marginTop: 8, display: "inline-block" }}>
            View on Flickr →
          </a>
        </div>
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.1)",
          border: "none", color: "#fff", fontSize: 20, cursor: "pointer",
          width: 36, height: 36, borderRadius: "50%", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>×</button>
      </div>
    </div>
  );
}

// Timeline Events Bar
function EventsBar({ currentTime }) {
  const nearEvents = EVENTS.filter(e => {
    const diff = currentTime - e.t;
    return diff >= -1800000 && diff <= 3600000; // 30 min before to 1 hour after
  });

  if (nearEvents.length === 0) return null;

  const latest = nearEvents[nearEvents.length - 1];
  const categoryColors = {
    milestone: "#ffd600",
    crew: "#4FC3F7",
    maneuver: "#FF7043",
    science: "#81C784",
    photo: "#F48FB1",
  };

  return (
    <div style={{
      padding: "10px 16px", borderRadius: 8,
      background: `linear-gradient(90deg, ${categoryColors[latest.category] || "#4FC3F7"}11, transparent)`,
      borderLeft: `3px solid ${categoryColors[latest.category] || "#4FC3F7"}`,
      margin: "8px 0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{latest.icon}</span>
        <div>
          <div style={{ color: categoryColors[latest.category] || "#4FC3F7", fontSize: 14, fontWeight: 700 }}>{latest.title}</div>
          <div style={{ color: "#999", fontSize: 12 }}>{latest.desc}</div>
        </div>
        <div style={{ marginLeft: "auto", color: "#555", fontSize: 11 }}>{formatTime(latest.t)}</div>
      </div>
    </div>
  );
}

// Flight Day Indicator
function FlightDayIndicator({ currentTime }) {
  let currentDay = FLIGHT_DAYS[0];
  for (const fd of FLIGHT_DAYS) {
    if (currentTime >= fd.start) currentDay = fd;
  }

  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center", padding: "8px 0" }}>
      {FLIGHT_DAYS.map(fd => {
        const isActive = fd.day === currentDay.day;
        const isPast = fd.start < currentTime;
        return (
          <div key={fd.day} style={{
            padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: isActive ? 700 : 400,
            background: isActive ? "#1a237e" : "transparent",
            color: isActive ? "#fff" : isPast ? "#555" : "#333",
            border: isActive ? "1px solid #3949ab" : "1px solid transparent",
          }}>
            <div>FD{fd.day}</div>
            <div style={{ fontSize: 9, opacity: 0.7 }}>{fd.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// Main Timeline Slider
function TimelineSlider({ currentTime, setCurrentTime, isPlaying, setIsPlaying, playSpeed, setPlaySpeed }) {
  const progress = (currentTime - MISSION_START) / MISSION_DURATION;
  const speeds = [1, 10, 60, 600, 3600];
  const speedLabels = ["1×", "10×", "1min/s", "10min/s", "1hr/s"];

  return (
    <div style={{ padding: "12px 0" }}>
      {/* Playback controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button onClick={() => setIsPlaying(!isPlaying)} style={{
          background: isPlaying ? "#b71c1c" : "#1b5e20", border: "none", color: "#fff",
          padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13,
        }}>
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          {speeds.map((s, i) => (
            <button key={s} onClick={() => setPlaySpeed(s)} style={{
              background: playSpeed === s ? "#1a237e" : "#1a1a2e",
              border: playSpeed === s ? "1px solid #3949ab" : "1px solid #222",
              color: playSpeed === s ? "#fff" : "#888",
              padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11,
            }}>
              {speedLabels[i]}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", color: "#4FC3F7", fontSize: 13, fontWeight: 600 }}>
          {formatTime(currentTime)}
        </div>
      </div>
      {/* Slider */}
      <div style={{ position: "relative", height: 40 }}>
        {/* Flight day markers */}
        {FLIGHT_DAYS.map(fd => {
          const pos = ((fd.start - MISSION_START) / MISSION_DURATION) * 100;
          return (
            <div key={fd.day} style={{
              position: "absolute", left: `${pos}%`, top: 0, height: 8,
              borderLeft: "1px solid #333", fontSize: 8, color: "#555", paddingLeft: 2,
            }}>
              {fd.date}
            </div>
          );
        })}
        {/* Event markers on timeline */}
        {EVENTS.filter(e => e.category === "milestone").map((e, i) => {
          const pos = ((e.t - MISSION_START) / MISSION_DURATION) * 100;
          return (
            <div key={i} style={{
              position: "absolute", left: `${pos}%`, top: 10, width: 2, height: 8,
              background: "#ffd600", borderRadius: 1, transform: "translateX(-1px)",
            }} title={e.title} />
          );
        })}
        {/* Photo markers */}
        {PHOTOS.map(p => {
          const pos = ((p.t - MISSION_START) / MISSION_DURATION) * 100;
          return (
            <div key={p.id} style={{
              position: "absolute", left: `${pos}%`, top: 10, transform: "translateX(-4px)",
              fontSize: 8, cursor: "pointer",
            }} title={p.title}>📷</div>
          );
        })}
        {/* Blackout zones */}
        {BLACKOUTS.map((b, i) => {
          const startPos = ((b.start - MISSION_START) / MISSION_DURATION) * 100;
          const endPos = ((b.end - MISSION_START) / MISSION_DURATION) * 100;
          return (
            <div key={i} style={{
              position: "absolute", left: `${startPos}%`, width: `${endPos - startPos}%`,
              top: 20, height: 16, background: "rgba(255,0,0,0.15)", borderRadius: 2,
            }} title={b.label} />
          );
        })}
        {/* Track */}
        <input type="range" min={0} max={1} step={0.0001}
          value={progress}
          onChange={e => setCurrentTime(MISSION_START + parseFloat(e.target.value) * MISSION_DURATION)}
          style={{
            position: "absolute", top: 20, width: "100%", height: 16,
            WebkitAppearance: "none", appearance: "none", background: "transparent",
            cursor: "pointer", zIndex: 10,
          }}
        />
        <div style={{
          position: "absolute", top: 24, left: 0, right: 0, height: 8,
          background: "#1a1a2e", borderRadius: 4, overflow: "hidden", pointerEvents: "none",
        }}>
          <div style={{
            width: `${progress * 100}%`, height: "100%",
            background: "linear-gradient(90deg, #1a237e, #4FC3F7)",
            borderRadius: 4,
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function ArtemisTimeline() {
  const [currentTime, setCurrentTime] = useState(MISSION_START);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(60);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [orbitalWidth, setOrbitalWidth] = useState(600);
  const containerRef = useRef(null);

  // Responsive orbital view
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setOrbitalWidth(Math.min(containerRef.current.offsetWidth - 32, 700));
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + playSpeed * 1000; // playSpeed seconds per tick (16ms)
        if (next >= MISSION_END) {
          setIsPlaying(false);
          return MISSION_END;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [isPlaying, playSpeed]);

  const blackout = isInBlackout(currentTime);

  return (
    <div ref={containerRef} style={{
      background: "#0a0a14", color: "#e0e0e0", minHeight: "100vh",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 20px 16px", borderBottom: "1px solid #1a1a2e",
        background: "linear-gradient(180deg, #0d1117, #0a0a14)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
            ARTEMIS <span style={{ color: "#4FC3F7" }}>II</span>
          </h1>
          <span style={{ color: "#555", fontSize: 13 }}>Mission Timeline</span>
        </div>
        <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
          April 1–10, 2026 · Wiseman · Glover · Koch · Hansen · 10 days around the Moon
        </div>
        <div style={{ color: "#444", fontSize: 10, marginTop: 4, fontStyle: "italic" }}>
          Fan-made visualization — not affiliated with NASA
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        {/* Flight Day Indicator */}
        <FlightDayIndicator currentTime={currentTime} />

        {/* Orbital View */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
          <OrbitalView currentTime={currentTime} width={orbitalWidth} height={Math.round(orbitalWidth * 0.6)} />
        </div>

        {/* Distance Counter */}
        <DistanceCounter currentTime={currentTime} />

        {/* Current Event */}
        <EventsBar currentTime={currentTime} />

        {/* Mission Quote */}
        <QuoteDisplay currentTime={currentTime} />

        {/* Timeline Slider */}
        <TimelineSlider
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          playSpeed={playSpeed}
          setPlaySpeed={setPlaySpeed}
        />

        {/* Crew Swimlanes */}
        <CrewSwimlines currentTime={currentTime} />

        {/* Photos */}
        <PhotoGallery currentTime={currentTime} onPhotoClick={setSelectedPhoto} />

        {/* Photo Modal */}
        <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "24px 0", borderTop: "1px solid #1a1a2e", marginTop: 16 }}>
          <div style={{ color: "#333", fontSize: 11 }}>
            Data sourced from NASA mission blogs and public Flickr archives
          </div>
          <div style={{ color: "#222", fontSize: 10, marginTop: 4 }}>
            Not an official NASA product
          </div>
        </div>
      </div>

      {/* Global styles for range input */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #4FC3F7;
          cursor: pointer;
          border: 2px solid #0a0a14;
          box-shadow: 0 0 8px rgba(79,195,247,0.5);
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #4FC3F7;
          cursor: pointer;
          border: 2px solid #0a0a14;
          box-shadow: 0 0 8px rgba(79,195,247,0.5);
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 8px;
          background: transparent;
        }
        input[type="range"]::-moz-range-track {
          height: 8px;
          background: transparent;
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a14; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>
    </div>
  );
}
