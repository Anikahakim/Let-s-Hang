"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Profile = { id: string; username: string; full_name: string | null };

type Friendship = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

type SlotRow = { user_id: string; start_time: string };

type Range = {
  start: string; // ISO
  end: string;   // ISO (exclusive end)
  count: number; // how many people free
};

function initials(p: Profile) {
  const base = (p.full_name || p.username || "").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (base[0] || "?").toUpperCase();
}

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const day = start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return `${day} • ${startTime} – ${endTime}`;
}

// Return true if local time-of-day falls within [minHour, maxHour)
function withinHours(iso: string, minHour: number, maxHour: number) {
  const d = new Date(iso);
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= minHour && h < maxHour;
}

// Merge consecutive half-hour times into ranges, per count bucket
function mergeConsecutiveTimes(times: string[], count: number): Range[] {
  if (times.length === 0) return [];

  const sorted = [...times].sort((a, b) => a.localeCompare(b));

  const out: Range[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  const add30 = (iso: string) => {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + 30);
    return d.toISOString();
  };

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const expected = add30(prev);

    if (cur === expected) {
      prev = cur;
    } else {
      // close the previous range: end = prev + 30
      out.push({ start, end: add30(prev), count });
      start = cur;
      prev = cur;
    }
  }

  out.push({ start, end: add30(prev), count });
  return out;
}

export default function MatchPage() {
  const [me, setMe] = useState<string>("");
  const [friends, setFriends] = useState<Profile[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());

  // date range: next 7 days by default
  const [start, setStart] = useState<string>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });

  // “reasonable hours”
  const [minHour, setMinHour] = useState(8);   // 8am
  const [maxHour, setMaxHour] = useState(23);  // 11pm

  const [ranges, setRanges] = useState<Range[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const myId = data.user.id;
      setMe(myId);

      // accepted friendships involving me
      const { data: frRows, error: frErr } = await supabase
        .from("friendships")
        .select("*")
        .eq("status", "accepted")
        .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);

      if (frErr) {
        setErrorMsg(frErr.message);
        return;
      }

      const friendships = (frRows ?? []) as Friendship[];
      const friendIds = friendships.map((f) => (f.requester_id === myId ? f.addressee_id : f.requester_id));

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      // profiles for UI
      const { data: profRows, error: profErr } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", friendIds);

      if (profErr) {
        setErrorMsg(profErr.message);
        return;
      }

      const sorted = ((profRows ?? []) as Profile[]).sort((a, b) => a.username.localeCompare(b.username));
      setFriends(sorted);
    }

    init();
  }, []);

  const groupIds = useMemo(() => [me, ...Array.from(selectedFriendIds)].filter(Boolean), [me, selectedFriendIds]);
  const groupSize = groupIds.length;

  function toggleFriend(id: string) {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function copyTopResults() {
    if (ranges.length === 0) return;

    const text = ranges
      .slice(0, 10)
      .map((r) => `${formatRange(r.start, r.end)} (${r.count}/${groupSize} free)`)
      .join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function findTimes() {
    setErrorMsg("");
    setRanges([]);

    if (!me) return;
    if (selectedFriendIds.size === 0) {
      setErrorMsg("Select at least one friend.");
      return;
    }

    const startIso = new Date(start + "T00:00:00").toISOString();
    const endIso = new Date(end + "T00:00:00").toISOString();

    // Fetch slots for all group members
    const { data: slotRows, error } = await supabase
      .from("availability_slots")
      .select("user_id, start_time")
      .in("user_id", groupIds)
      .gte("start_time", startIso)
      .lt("start_time", endIso);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    const slots = (slotRows ?? []) as SlotRow[];

    // Count unique users per time
    const timeToUsers = new Map<string, Set<string>>();
    for (const row of slots) {
      // filter to reasonable hours in LOCAL time
      if (!withinHours(row.start_time, minHour, maxHour)) continue;

      if (!timeToUsers.has(row.start_time)) timeToUsers.set(row.start_time, new Set());
      timeToUsers.get(row.start_time)!.add(row.user_id);
    }

    // Bucket times by how many people are free
    const countToTimes = new Map<number, string[]>();
    for (const [time, users] of timeToUsers.entries()) {
      const c = users.size;
      if (!countToTimes.has(c)) countToTimes.set(c, []);
      countToTimes.get(c)!.push(time);
    }

    // Merge consecutive times inside each bucket
    const allRanges: Range[] = [];
    const countsDesc = Array.from(countToTimes.keys()).sort((a, b) => b - a);

    for (const c of countsDesc) {
      const merged = mergeConsecutiveTimes(countToTimes.get(c)!, c);
      allRanges.push(...merged);
    }

    // Sort so higher count first, then earlier times
    allRanges.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.start.localeCompare(b.start);
    });

    setRanges(allRanges.slice(0, 50)); // show top 50 ranges
  }

  return (
    <main className="p-10 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Find a time</h1>
        <button
          onClick={copyTopResults}
          disabled={ranges.length === 0}
          className="border px-3 py-2 rounded disabled:opacity-50"
        >
          {copied ? "Copied!" : "Copy top 10"}
        </button>
      </div>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Pick friends</h2>

        {friends.length === 0 ? (
          <p className="text-gray-600">No accepted friends yet. Add/accept friends first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const on = selectedFriendIds.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFriend(f.id)}
                  className={`flex items-center gap-2 border rounded-full px-3 py-2 ${
                    on ? "bg-black text-white" : ""
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full grid place-items-center text-sm ${on ? "bg-white text-black" : "bg-black text-white"}`}>
                    {initials(f)}
                  </span>
                  <span>@{f.username}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Date range</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600">Start</label>
            <input className="border p-2" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-gray-600">End</label>
            <input className="border p-2" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-gray-600">Earliest hour</label>
            <input
              className="border p-2 w-24"
              type="number"
              min={0}
              max={23}
              value={minHour}
              onChange={(e) => setMinHour(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600">Latest hour</label>
            <input
              className="border p-2 w-24"
              type="number"
              min={1}
              max={24}
              value={maxHour}
              onChange={(e) => setMaxHour(Number(e.target.value))}
            />
          </div>

          <button onClick={findTimes} className="bg-black text-white px-4 py-2 rounded">
            Find best times
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Results</h2>

        {ranges.length === 0 ? (
          <p className="text-gray-600">No results yet (or click “Find best times”).</p>
        ) : (
          <div className="space-y-2">
            {ranges.map((r) => {
              const perfect = r.count === groupSize;
              return (
                <div key={`${r.start}-${r.count}`} className="border rounded p-3 flex items-center justify-between transition transform hover:scale-[1.02]">
                  <div>
                    <div className="font-medium">{formatRange(r.start, r.end)}</div>
                    <div className="text-sm text-gray-600">
                      {perfect ? (
                        <span className="text-green-500 font-semibold">🔥 Perfect match</span>
                      ) : (
                        <span className="text-yellow-500">⚠️ Partial match</span>
                      )} • {r.count}/{groupSize} free
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm ${perfect ? "bg-black text-white" : "border"}`}>
                    {r.count}/{groupSize}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}