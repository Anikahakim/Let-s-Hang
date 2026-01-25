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
    <main className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 sm:p-8 lg:p-12">
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">👥 Friends</h1>

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 border-2 border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500 transition-colors"
            placeholder="Search username..."
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
          />
          <button onClick={searchUser} className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg">
            🔍 Search
          </button>
        </div>

        {foundProfile && (
          <div className="bg-gradient-to-br from-blue-100 to-purple-100 border-2 border-blue-300 p-4 rounded-lg">
            <p className="text-lg">
              Found: <b className="text-purple-600">@{foundProfile.username}</b>
              {foundProfile.full_name ? ` (${foundProfile.full_name})` : ""}
            </p>
            <button onClick={sendRequest} className="mt-3 w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg">
              ➕ Send friend request
            </button>
          </div>
        )}

        {errorMsg && <p className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded-lg font-semibold">{errorMsg}</p>}
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-pink-600">📬 Incoming Requests</h2>
        {incoming.length === 0 ? (
          <p className="text-gray-500 italic">No incoming requests</p>
        ) : (
          incoming.map((f: any) => (
            <div key={f.id} className="bg-white border-2 border-pink-200 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-shadow">
              <div>
                <p className="font-bold text-lg">@{f.otherUser?.username}</p>
                {f.otherUser?.full_name && (
                  <p className="text-sm text-gray-600">{f.otherUser.full_name}</p>
                )}
              </div>
              <button
                onClick={() => acceptRequest(f.id)}
                className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold px-6 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                ✅ Accept
              </button>
            </div>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-green-600">💚 Friends</h2>
        {accepted.length === 0 ? (
          <p className="text-gray-500 italic">No friends yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accepted.map((f: any) => (
              <div
                key={f.id}
                className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-4 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center text-white font-bold">👤</div>
                  <div>
                    <p className="font-bold text-lg">
                      @{f.otherUser?.username}
                    </p>
                    {f.otherUser?.full_name && (
                      <p className="text-sm text-gray-600">
                        {f.otherUser.full_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
    </main>
  );
}
