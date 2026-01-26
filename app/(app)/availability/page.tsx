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
  const [weekDates, setWeekDates] = useState<{ [key: string]: string }>({});

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

      // Build a map of day -> date string
      const dateMap: { [key: string]: string } = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dateMap[days[i]] = monthDay;
      }
      setWeekDates(dateMap);

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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">📅 Set Your Availability</h1>
        <p className="text-gray-600 mb-6">Select all the time slots this week when you're available to hang out. Your availability will be saved and used to match with friends.</p>
        
        <div className="bg-white rounded-lg p-4 mb-6 shadow-md">
          <p className="text-lg font-semibold">Selected slots: <span className="text-purple-600 font-bold">{selected.size}</span></p>
          <p className="text-sm text-gray-600 mt-1">Click slots to select/deselect them (they'll turn purple/blue when selected)</p>
        </div>

      <div className="overflow-auto border rounded-xl shadow-lg bg-white">
        <table className="border-collapse w-full text-center">
          <thead>
            <tr className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              <th className="sticky top-0 border p-3 text-left w-20 font-semibold">Time</th>
              {days.map((day) => (
                <th key={day} className="sticky top-0 border p-3 font-semibold text-sm sm:text-base">
                  <div>{day}</div>
                  <div className="text-xs font-normal text-blue-100">{weekDates[day]}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {times.map((time) => (
              <tr key={time} className="hover:bg-blue-50 transition-colors">
                <td className="border p-2 text-sm whitespace-nowrap font-semibold text-gray-700 bg-gray-50">{time}</td>

                {days.map((day) => {
                  const key = `${day}-${time}`;
                  const isSelected = selected.has(key);

                  return (
                    <td key={key} className="border p-1">
                      <button
                        type="button"
                        onClick={() => toggleSlot(day, time)}
                        className={`w-full h-10 rounded-lg transition-all transform hover:scale-105 ${
                          isSelected
                            ? 'bg-gradient-to-br from-purple-500 to-blue-500 shadow-md'
                            : 'bg-white hover:bg-gray-100 border border-gray-300'
                        }`}
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
        className="mt-8 w-full sm:w-auto bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
      >
        ✨ Save Availability
      </button>
      </div>
    </main>
  );
}
