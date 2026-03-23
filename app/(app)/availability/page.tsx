"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function generateTimes() {
  const times: string[] = [];
  for (let hour = 8; hour < 22; hour++) {
    times.push(`${hour}:00`);
    times.push(`${hour}:30`);
  }
  return times;
}

const times = generateTimes();

function toDayTimeKey(d: Date) {
  const jsDay = d.getDay();
  const map = [6, 0, 1, 2, 3, 4, 5];
  const dayIndex = map[jsDay];
  const day = days[dayIndex];
  const hh = d.getHours();
  const mm = d.getMinutes();
  const time = `${hh}:${mm === 0 ? "00" : "30"}`;
  return `${day}-${time}`;
}

// ── ICS parsing ──────────────────────────────────────────────────────────────

function getWeekMonday(d: Date): Date {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay() + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseICSDate(raw: string): Date | null {
  // Strip param prefix like "TZID=America/New_York:" → take everything after last ":"
  const colIdx = raw.lastIndexOf(":");
  const value = (colIdx >= 0 ? raw.substring(colIdx + 1) : raw).trim();

  if (value.length === 8 && !value.includes("T")) {
    // DATE only: YYYYMMDD → all-day, skip (return marker)
    return new Date(+value.slice(0, 4), +value.slice(4, 6) - 1, +value.slice(6, 8));
  }
  if (value.length >= 15) {
    const y = +value.slice(0, 4),
      m = +value.slice(4, 6) - 1,
      d = +value.slice(6, 8);
    const h = +value.slice(9, 11),
      min = +value.slice(11, 13),
      s = +value.slice(13, 15);
    return value.endsWith("Z")
      ? new Date(Date.UTC(y, m, d, h, min, s))
      : new Date(y, m, d, h, min, s);
  }
  return null;
}

function expandRRule(
  start: Date,
  duration: number,
  rrule: string,
  weekStart: Date,
  weekEnd: Date
): { start: Date; end: Date }[] {
  const params: Record<string, string> = {};
  rrule.split(";").forEach((p) => {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  });

  const freq = params["FREQ"];
  const interval = parseInt(params["INTERVAL"] || "1");
  const until = params["UNTIL"] ? parseICSDate(params["UNTIL"]) : null;
  const byDay =
    params["BYDAY"]?.split(",").map((d) => d.slice(-2).toUpperCase()) || null;
  const dayCode = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const results: { start: Date; end: Date }[] = [];

  if (freq === "DAILY") {
    const stepMs = interval * 86400000;
    const msDiff = weekStart.getTime() - start.getTime();
    const steps = msDiff > 0 ? Math.ceil(msDiff / stepMs) : 0;
    let current = new Date(start.getTime() + steps * stepMs);
    while (current < weekEnd) {
      if (until && current > until) break;
      if (!byDay || byDay.includes(dayCode[current.getDay()])) {
        results.push({
          start: new Date(current),
          end: new Date(current.getTime() + duration),
        });
      }
      current = new Date(current.getTime() + stepMs);
    }
  } else if (freq === "WEEKLY") {
    const startMonday = getWeekMonday(start);
    const currentWeekMonday = getWeekMonday(weekStart);
    const weeksDiff = Math.round(
      (currentWeekMonday.getTime() - startMonday.getTime()) / (7 * 86400000)
    );

    // Only proceed if this week is an occurrence week
    if (weeksDiff >= 0 && weeksDiff % interval === 0) {
      if (byDay) {
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(currentWeekMonday.getTime() + i * 86400000);
          const dayName = dayCode[dayDate.getDay()];
          if (byDay.includes(dayName)) {
            const occ = new Date(dayDate);
            occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
            if (occ >= weekStart && occ < weekEnd && (!until || occ <= until)) {
              results.push({ start: occ, end: new Date(occ.getTime() + duration) });
            }
          }
        }
      } else {
        // Same day of week as DTSTART
        const dayOffset = (start.getDay() + 6) % 7; // Mon=0
        const occ = new Date(currentWeekMonday.getTime() + dayOffset * 86400000);
        occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
        if (occ >= weekStart && occ < weekEnd && (!until || occ <= until)) {
          results.push({ start: occ, end: new Date(occ.getTime() + duration) });
        }
      }
    }
  } else if (freq === "MONTHLY" || freq === "YEARLY") {
    let current = new Date(start);
    let n = 0;
    while (current < weekEnd && n < 200) {
      if (until && current > until) break;
      if (current >= weekStart) {
        results.push({
          start: new Date(current),
          end: new Date(current.getTime() + duration),
        });
      }
      if (freq === "MONTHLY") current.setMonth(current.getMonth() + interval);
      else current.setFullYear(current.getFullYear() + interval);
      n++;
    }
  }

  return results;
}

function markBusySlots(start: Date, end: Date, busy: Set<string>, eventTitles: Map<string, string>, title: string) {
  const slot = new Date(start);
  slot.setSeconds(0, 0);
  const mins = slot.getMinutes();
  slot.setMinutes(mins < 30 ? 0 : 30); // round down to 30-min boundary

  while (slot < end) {
    const h = slot.getHours();
    if (h >= 8 && h < 22) {
      const key = toDayTimeKey(slot);
      busy.add(key);
      eventTitles.set(key, title);
    }
    slot.setTime(slot.getTime() + 30 * 60000);
  }
}

interface ICSParseResult {
  busySlots: Set<string>;
  eventTitles: Map<string, string>;
  eventCount: number;
}

function parseICSForWeek(icsText: string, weekStart: Date, weekEnd: Date): ICSParseResult {
  // Unfold RFC 5545 continuation lines
  const text = icsText
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .replace(/\r\n/g, "\n");

  const busy = new Set<string>();
  const eventTitles = new Map<string, string>();
  let eventCount = 0;

  const eventBlocks = [...text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)];

  for (const match of eventBlocks) {
    const lines = match[1].split("\n");

    const getProp = (name: string): string | null => {
      const up = name.toUpperCase();
      for (const line of lines) {
        const uline = line.toUpperCase();
        if (uline.startsWith(up + ":") || uline.startsWith(up + ";")) {
          return line.substring(line.indexOf(":") + 1).trim();
        }
      }
      return null;
    };

    const dtstart = getProp("DTSTART");
    const dtend = getProp("DTEND");
    const rrule = getProp("RRULE");
    const summary = getProp("SUMMARY") || "Busy";

    if (!dtstart) continue;

    const start = parseICSDate(dtstart);
    if (!start) continue;

    // Skip all-day events (DATE-only values have no 'T')
    const rawVal = dtstart.includes(":") ? dtstart.split(":").pop()! : dtstart;
    if (!rawVal.includes("T")) continue;

    const endRaw = dtend ? parseICSDate(dtend) : null;
    const duration = endRaw
      ? endRaw.getTime() - start.getTime()
      : 3600000; // default 1h

    const occurrences = rrule
      ? expandRRule(start, duration, rrule, weekStart, weekEnd)
      : start < weekEnd && new Date(start.getTime() + duration) > weekStart
      ? [{ start, end: new Date(start.getTime() + duration) }]
      : [];

    for (const occ of occurrences) {
      eventCount++;
      markBusySlots(occ.start, occ.end, busy, eventTitles, summary);
    }
  }

  return { busySlots: busy, eventTitles, eventCount };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const [userId, setUserId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [eventTitles, setEventTitles] = useState<Map<string, string>>(new Map());
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getWeekDates = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const dateMap: { [key: string]: string } = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const monthDay = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      dateMap[days[i]] = monthDay;
    }
    return dateMap;
  };

  const weekDates = getWeekDates();

  useEffect(() => {
    async function getUserAndLoad() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const uid = data.user.id;
      setUserId(uid);

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const { data: rows, error } = await supabase
        .from("availability_slots")
        .select("start_time")
        .eq("user_id", uid)
        .gte("start_time", startOfWeek.toISOString())
        .lt("start_time", endOfWeek.toISOString());

      if (error) {
        console.log(error.message);
        return;
      }

      const set = new Set<string>();
      (rows ?? []).forEach((r: { start_time: string }) => {
        const d = new Date(r.start_time);
        set.add(toDayTimeKey(d));
      });

      setSelected(set);
    }

    getUserAndLoad();
  }, []);

  function toggleSlot(day: string, time: string) {
    const key = `${day}-${time}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleCalendarImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImportMessage(null);
    setImportError(null);

    try {
      const text = await file.text();

      if (!text.includes("BEGIN:VCALENDAR")) {
        setImportError("Invalid file — please upload a .ics calendar file.");
        return;
      }

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const { busySlots, eventTitles: parsedEventTitles, eventCount } = parseICSForWeek(text, weekStart, weekEnd);

      // Mark all 8am–10pm slots available except busy ones
      const newSelected = new Set<string>();
      days.forEach((day) => {
        times.forEach((time) => {
          const key = `${day}-${time}`;
          if (!busySlots.has(key)) newSelected.add(key);
        });
      });

      setSelected(newSelected);
      setEventTitles(parsedEventTitles);
      setImportMessage(
        `Imported! Found ${eventCount} event${eventCount !== 1 ? "s" : ""} this week. ` +
          `${newSelected.size} slots marked as available (${busySlots.size} busy slots hidden). ` +
          `Review and save when ready.`
      );
    } catch {
      setImportError("Failed to parse the calendar file. Please try again.");
    }
  }

  async function saveAvailability() {
    if (!userId) return;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const start = new Date(startOfWeek);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    await supabase
      .from("availability_slots")
      .delete()
      .eq("user_id", userId)
      .gte("start_time", start.toISOString())
      .lt("start_time", end.toISOString());

    const inserts: { user_id: string; start_time: string }[] = [];

    selected.forEach((slot) => {
      const [day, time] = slot.split("-");
      const dayIndex = days.indexOf(day);
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + dayIndex);
      const [hour, minute] = time.split(":");
      date.setHours(Number(hour), Number(minute), 0, 0);
      inserts.push({ user_id: userId, start_time: date.toISOString() });
    });

    const { error } = await supabase.from("availability_slots").insert(inserts);

    if (error) {
      alert(error.message);
    } else {
      setImportMessage(null);
      alert("Saved!");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          📅 Set Your Availability
        </h1>
        <p className="text-gray-600 mb-6">
          Select all the time slots this week when you&apos;re available to hang
          out. Your availability will be saved and used to match with friends.
        </p>

        {/* Status bar */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">
                Selected slots:{" "}
                <span className="text-purple-600 font-bold">{selected.size}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Click slots to select/deselect them
              </p>
            </div>

            {/* Apple Calendar import */}
            <div className="flex flex-col items-end gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".ics"
                className="hidden"
                onChange={handleCalendarImport}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-white border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700 font-semibold py-2 px-4 rounded-xl transition-all text-sm shadow-sm"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                Import from Apple Calendar
              </button>
              <p className="text-xs text-gray-400">
                Export your calendar as .ics and upload here
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-blue-500 rounded"></div>
              <span>Available (click to toggle)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-gray-300 rounded"></div>
              <span>Unavailable (click to make available)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-red-400 rounded"></div>
              <span>Busy (from calendar - shows event name)</span>
            </div>
          </div>
        </div>

        {/* Import feedback */}
        {importMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 mb-4 text-sm flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>{importMessage}</span>
            <button
              onClick={() => setImportMessage(null)}
              className="ml-auto text-green-400 hover:text-green-600 font-bold"
            >
              ×
            </button>
          </div>
        )}
        {importError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-4 text-sm flex items-start gap-2">
            <span className="text-red-500 mt-0.5">⚠</span>
            <span>{importError}</span>
            <button
              onClick={() => setImportError(null)}
              className="ml-auto text-red-400 hover:text-red-600 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* How to export instructions */}
        <details className="mb-4 bg-blue-50 border border-blue-100 rounded-lg">
          <summary className="px-4 py-3 text-sm font-semibold text-blue-700 cursor-pointer select-none">
            How to export from Apple Calendar
          </summary>
          <ol className="px-4 pb-4 pt-1 text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Open <strong>Calendar</strong> on your Mac</li>
            <li>
              In the menu bar, click <strong>File → Export → Export…</strong>
            </li>
            <li>Save the .ics file anywhere on your computer</li>
            <li>Click <strong>Import from Apple Calendar</strong> above and select that file</li>
          </ol>
        </details>

        <div className="overflow-auto border rounded-xl shadow-lg bg-white">
          <table className="border-collapse w-full text-center">
            <thead>
              <tr className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                <th className="sticky top-0 border p-3 text-left w-20 font-semibold">
                  Time
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className="sticky top-0 border p-3 font-semibold text-sm sm:text-base"
                  >
                    <div>{day}</div>
                    <div className="text-xs font-normal text-blue-100">
                      {weekDates[day]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {times.map((time) => (
                <tr key={time} className="hover:bg-blue-50 transition-colors">
                  <td className="border p-2 text-sm whitespace-nowrap font-semibold text-gray-700 bg-gray-50">
                    {time}
                  </td>

                  {days.map((day) => {
                    const key = `${day}-${time}`;
                    const isSelected = selected.has(key);
                    const eventTitle = eventTitles.get(key);

                    return (
                      <td key={key} className="border p-1">
                        <button
                          type="button"
                          onClick={() => toggleSlot(day, time)}
                          className={`w-full h-10 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center text-xs font-medium ${
                            isSelected
                              ? "bg-gradient-to-br from-purple-500 to-blue-500 shadow-md text-white"
                              : eventTitle
                              ? "bg-red-400 hover:bg-red-500 text-white cursor-not-allowed"
                              : "bg-white hover:bg-gray-100 border border-gray-300 text-gray-400"
                          }`}
                          disabled={!!eventTitle}
                          title={eventTitle || `${day} ${time}`}
                          aria-label={eventTitle ? `${eventTitle} (${day} ${time})` : `${day} ${time}`}
                        >
                          {eventTitle ? (
                            <span className="truncate px-1 max-w-full" title={eventTitle}>
                              {eventTitle.length > 8 ? `${eventTitle.substring(0, 8)}...` : eventTitle}
                            </span>
                          ) : isSelected ? (
                            "✓"
                          ) : (
                            ""
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={saveAvailability}
          className="mt-8 w-full sm:w-auto bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          ✨ Save Availability
        </button>
      </div>
    </main>
  );
}
