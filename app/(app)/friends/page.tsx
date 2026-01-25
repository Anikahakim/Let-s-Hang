"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Profile = { id: string; username: string; full_name: string | null };

type Friendship = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

export default function FriendsPage() {
  const [me, setMe] = useState<string>("");
  const [searchUsername, setSearchUsername] = useState("");
  const [foundProfile, setFoundProfile] = useState<Profile | null>(null);
  const [incoming, setIncoming] = useState<Friendship[]>([]);
  const [accepted, setAccepted] = useState<Friendship[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setMe(data.user.id);
      await refreshLists(data.user.id);
    }
    init();
  }, []);

  async function refreshLists(myId: string) {
    // Incoming requests: where I'm the addressee and status pending
    const inc = await supabase
      .from("friendships")
      .select("*")
      .eq("addressee_id", myId)
      .eq("status", "pending");

    const incomingRows = (inc.data ?? []) as Friendship[];

    // Get profile info for incoming requests
    const requesterIds = incomingRows.map((f) => f.requester_id);
    const { data: requesterProfiles } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", requesterIds);

    const requesterIdToProfile = new Map(
      (requesterProfiles ?? []).map((p: any) => [p.id, p])
    );

    // Accepted friendships: where I'm requester OR addressee and status accepted
    const acc = await supabase
      .from("friendships")
      .select("*")
      .eq("status", "accepted")
      .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);

    const acceptedRows = (acc.data ?? []) as Friendship[];

    const friendIds = acceptedRows.map((f) =>
      f.requester_id === myId ? f.addressee_id : f.requester_id
    );

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", friendIds);

    const idToProfile = new Map(
      (profileRows ?? []).map((p: any) => [p.id, p])
    );

    setIncoming(
      incomingRows.map((f) => ({
        ...f,
        otherUser: requesterIdToProfile.get(f.requester_id),
      }))
    );

    setAccepted(
      acceptedRows.map((f) => {
        const otherId =
          f.requester_id === myId ? f.addressee_id : f.requester_id;

        return {
          ...f,
          otherUser: idToProfile.get(otherId),
        };
      })
    );
  }

  async function searchUser() {
    setErrorMsg("");
    setFoundProfile(null);

    const uname = searchUsername.trim().toLowerCase();
    if (!uname) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .eq("username", uname)
      .maybeSingle();

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    if (!data) {
      setErrorMsg("No user found with that username.");
      return;
    }
    if (data.id === me) {
      setErrorMsg("That’s you.");
      return;
    }

    setFoundProfile(data as Profile);
  }

  async function sendRequest() {
    if (!foundProfile) return;

    const { error } = await supabase.from("friendships").insert({
      requester_id: me,
      addressee_id: foundProfile.id,
      status: "pending",
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setFoundProfile(null);
    setSearchUsername("");
    await refreshLists(me);
  }

  async function acceptRequest(friendshipId: number) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    await refreshLists(me);
  }

  return (
    <main className="p-10 space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Friends</h1>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="border p-2 flex-1"
            placeholder="Search username"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
          />
          <button onClick={searchUser} className="bg-black text-white px-4 py-2 rounded">
            Search
          </button>
        </div>

        {foundProfile && (
          <div className="border p-3 rounded">
            <p>
              Found: <b>@{foundProfile.username}</b>
              {foundProfile.full_name ? ` (${foundProfile.full_name})` : ""}
            </p>
            <button onClick={sendRequest} className="mt-2 bg-black text-white px-4 py-2 rounded">
              Send friend request
            </button>
          </div>
        )}

        {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      </div>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Incoming requests</h2>
        {incoming.length === 0 ? (
          <p className="text-gray-600">None</p>
        ) : (
          incoming.map((f: any) => (
            <div key={f.id} className="border p-3 rounded flex items-center justify-between">
              <div>
                <p className="font-medium">@{f.otherUser?.username}</p>
                {f.otherUser?.full_name && (
                  <p className="text-sm text-gray-600">{f.otherUser.full_name}</p>
                )}
              </div>
              <button
                onClick={() => acceptRequest(f.id)}
                className="bg-black text-white px-4 py-2 rounded"
              >
                Accept
              </button>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
      <h2 className="text-xl font-semibold">Accepted friends</h2>

      {accepted.length === 0 ? (
        <p className="text-gray-600">None</p>
      ) : (
        accepted.map((f: any) => (
          <div
            key={f.id}
            className="border p-3 rounded flex items-center justify-between"
          >
            <div>
              <p className="font-medium">
                @{f.otherUser?.username}
              </p>
              {f.otherUser?.full_name && (
                <p className="text-sm text-gray-600">
                  {f.otherUser.full_name}
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </section>
    </main>
  );
}
