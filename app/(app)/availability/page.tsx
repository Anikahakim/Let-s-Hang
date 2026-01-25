"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Generate half-hour times from 8am to 10pm
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
  // d is in local time here
  const jsDay = d.getDay(); // 0 Sun ... 6 Sat
  const map = [6, 0, 1, 2, 3, 4, 5]; // convert JS day to our days[] index (Mon=0)
  const dayIndex = map[jsDay];
  const day = days[dayIndex];

  const hh = d.getHours();
  const mm = d.getMinutes();
  const time = `${hh}:${mm === 0 ? "00" : "30"}`;

  return `${day}-${time}`;
}

export default function AvailabilityPage() {
  const [userId, setUserId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function getUserAndLoad() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const uid = data.user.id;
      setUserId(uid);

      // compute this week range (Mon -> next Mon)
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
      (rows ?? []).forEach((r: any) => {
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

  async function saveAvailability() {
    if (!userId) return;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    // delete existing slots for this user in this week
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

    const inserts: any[] = [];

    selected.forEach((slot) => {
      const [day, time] = slot.split("-");
      const dayIndex = days.indexOf(day);

      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + dayIndex);

      const [hour, minute] = time.split(":");
      date.setHours(Number(hour), Number(minute), 0, 0);

      inserts.push({
        user_id: userId,
        start_time: date.toISOString(),
      });
    });

    const { error } = await supabase
      .from("availability_slots")
      .insert(inserts);

    if (error) {
      alert(error.message);
    } else {
      alert("Saved!");
    }
  }

    return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Set Availability</h1>
      <p className="text-sm text-gray-600 mb-4">
        Selected slots: {selected.size}
      </p>

      <div className="overflow-auto border rounded">
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky top-0 bg-white border p-2 text-left w-20"></th>
              {days.map((day) => (
                <th key={day} className="sticky top-0 bg-white border p-2">
                  {day}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {times.map((time) => (
              <tr key={time}>
                <td className="border p-2 text-sm whitespace-nowrap">{time}</td>

                {days.map((day) => {
                  const key = `${day}-${time}`;
                  const isSelected = selected.has(key);

                  return (
                    <td key={key} className="border p-0">
                      <button
                        type="button"
                        onClick={() => toggleSlot(day, time)}
                        className="w-full h-8 border cursor-pointer hover:opacity-80"
                        style={{backgroundColor: isSelected ? "#111827" : "#f3f4f6", 
                          transition: "background-color 0.15s ease",
                        }}
                        aria-label={`${day} ${time}`}
                      />
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
        className="mt-6 bg-black text-white px-4 py-2 rounded"
      >
        Save Availability
      </button>
    </main>
  );
}
