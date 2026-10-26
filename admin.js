
/*
  NAL FAN CHOICE FRIDAY
  ADMIN PANEL

  All scheduling fields use Eastern Time.
  Database timestamps remain in UTC.

  Time zone: America/New_York
*/

const API = window.FCF_API_URL;
const base = API.replace("/functions/v1/fcf-api", "");

const TIME_ZONE = "America/New_York";

let access = "";
let current = null;
let currentData = null;
let choicesLocked = false;

const el = (id) => document.getElementById(id);

/* -----------------------------------------
   EASTERN TIME HANDLING
----------------------------------------- */

const easternFormatter = new Intl.DateTimeFormat(
  "en-US",
  {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }
);

function easternParts(date) {
  const parts = easternFormatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return values;
}

/*
  Converts a saved UTC timestamp into
  the correct Eastern Time input value.

  Example:
  2026-10-19T23:00:00Z
  becomes
  2026-10-19T19:00
*/

function utcToEasternInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const p = easternParts(date);

  return (
    p.year + "-" +
    p.month + "-" +
    p.day + "T" +
    p.hour + ":" +
    p.minute
  );
}

/*
  Converts the Eastern Time entered by
  the administrator into UTC for storage.

  Automatically accounts for EST and EDT.
*/

function easternInputToUTC(value) {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) {
    throw new Error(
      "Invalid date/time. Enter a valid Eastern Time."
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const desiredUTC = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute
  );

  let timestamp = desiredUTC;

  // Resolve Eastern Time offset, including DST.
  for (let i = 0; i < 5; i++) {
    const p = easternParts(new Date(timestamp));

    const displayedUTC = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute)
    );

    const difference = desiredUTC - displayedUTC;

    if (difference === 0) {
      break;
    }

    timestamp += difference;
  }

  const result = new Date(timestamp);

  // Reject nonexistent local times during DST changes.
  if (utcToEasternInput(result.toISOString()) !== value) {
    throw new Error(
      "That Eastern Time does not exist due to a daylight saving time change. Please choose another time."
    );
  }

  return result.toISOString();
}

/* -----------------------------------------
   API REQUESTS
----------------------------------------- */

async function req(path, body, method = "GET") {
  const response = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + access
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Request failed"
    );
  }

  return data;
}

/* -----------------------------------------
   GAME CHOICE FIELDS
----------------------------------------- */

function addGame(game = {}) {
  const container = document.createElement("div");

  container.className = "game";

  container.style = `
    border:1px solid #476080;
    padding:12px;
    margin:12px 0;
  `;

  const fields = [
    ["Matchup", game.matchup],
    ["Game date YYYY-MM-DD", game.game_date],
    ["Thumbnail URL", game.thumbnail_url],
    ["Video preview URL", game.preview_url]
  ];

  for (const [label, value] of fields) {
    const input = document.createElement("input");

    input.disabled = choicesLocked;
    input.setAttribute("aria-label", label);
    input.placeholder = label;
    input.value = value || "";

    input.style = `
      width:100%;
      padding:10px;
      margin:5px 0;
    `;

    container.append(input);
  }

  const removeButton = document.createElement("button");

  removeButton.textContent = "REMOVE";
  removeButton.disabled = choicesLocked;

  removeButton.onclick = () => {
    container.remove();
  };

  container.append(removeButton);

  el("gameFields").append(container);
}

el("addGame").onclick = () => addGame();

/* -----------------------------------------
   ADMIN LOGIN
----------------------------------------- */

async function login() {
  const response = await fetch(
    base + "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": window.FCF_PUBLISHABLE_KEY
      },
      body: JSON.stringify({
        email: el("email").value,
        password: el("password").value
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description ||
      data.msg ||
      data.error ||
      "Login failed"
    );
  }

  access = data.access_token;

  await refresh();
}

el("signIn").onclick = () => {
  login().catch((error) => {
    el("loginMessage").textContent = error.message;
  });
};

el("signOut").onclick = () => {
  location.reload();
};

/* -----------------------------------------
   LOAD CURRENT POLL
----------------------------------------- */

async function refresh(id) {
  const data = await req("/admin/poll" + (id ? "?id=" + id : ""));
  currentData = data;
  choicesLocked = (data.results || []).some(r => r.votes > 0) || data.poll?.status === "active";

  current = data.poll;

  el("login").hidden = true;
  el("editor").hidden = false;

  el("title").value =
    current?.title || "Fan Choice Friday";

  el("questionInput").value =
    current?.question ||
    "Which NAL classic should we air this Friday?";

  el("status").value =
    current?.status || "draft";

  // Display saved UTC times as Eastern Time.
  el("opens").value = current?.opens_at
    ? utcToEasternInput(current.opens_at)
    : "";

  el("closes").value = current?.closes_at
    ? utcToEasternInput(current.closes_at)
    : "";

  el("gameFields").innerHTML = "";

  (data.options || []).forEach(addGame);

  el("results").textContent = JSON.stringify(
    data.results || [],
    null,
    2
  );

  el("pollHeading").textContent = current ? `Poll #${current.id}: ${current.title}` : "New poll";
  el("pollNotice").textContent = choicesLocked ? "Game choices are locked. Create a new poll for the next week. Results are preserved." : "Draft choices can be edited. Saving as active makes this poll public.";
  for (const id of ["addGame", "loadLibrary"]) el(id).disabled = choicesLocked;
  el("archivePoll").disabled = !current || current.status === "closed";
  el("exportPoll").disabled = !current;
  await loadHistory();
  // Show the time zone clearly.
  el("opens").title =
    "Eastern Time (America/New_York)";

  el("closes").title =
    "Eastern Time (America/New_York)";
}

/* -----------------------------------------
   LOAD APPROVED MONDAY.COM GAMES
----------------------------------------- */

el("loadLibrary").onclick = async () => {
  el("libraryMessage").textContent =
    "Loading approved games…";

  el("libraryGames").replaceChildren();

  try {
    const data = await req("/admin/library");

    el("libraryMessage").textContent =
      data.games.length
        ? `${data.games.length} approved games found.`
        : "No approved games yet. Check the game approval statuses in Monday.com.";

    for (const game of data.games) {
      const card = document.createElement("div");

      card.style = `
        border:1px solid #476080;
        padding:12px;
        margin:10px 0;
      `;

      const title = document.createElement("strong");

      title.textContent = game.matchup;

      const description = document.createElement("p");

      description.textContent = [
        game.game_date,
        game.description
      ].filter(Boolean).join(" — ");

      const button = document.createElement("button");

      button.textContent = "ADD TO POLL";

      button.onclick = () => {
        if (el("gameFields").children.length >= 4) {
          el("libraryMessage").textContent =
            "Maximum four games";
          return;
        }

        addGame(game);

        button.disabled = true;
        button.textContent = "ADDED";
      };

      card.append(title, description, button);

      el("libraryGames").append(card);
    }

  } catch (error) {
    el("libraryMessage").textContent =
      error.message;
  }
};

/* -----------------------------------------
   SAVE POLL
----------------------------------------- */

el("save").onclick = async () => {
  const saveButton = el("save");

  try {
    saveButton.disabled = true;

    el("adminMessage").textContent =
      "Saving poll…";

    const games = [
      ...document.querySelectorAll(".game")
    ].map((container, index) => {
      const inputs = container.querySelectorAll("input");

      return {
        matchup: inputs[0].value,
        game_date: inputs[1].value || null,
        thumbnail_url: inputs[2].value || null,
        preview_url: inputs[3].value || null,
        display_order: index
      };
    });

    // Convert entered Eastern times into UTC.
    const opensAt = easternInputToUTC(
      el("opens").value
    );

    const closesAt = easternInputToUTC(
      el("closes").value
    );

    if (
      opensAt &&
      closesAt &&
      new Date(closesAt) <= new Date(opensAt)
    ) {
      throw new Error(
        "Closing time must be after opening time."
      );
    }

    const saved = await req(
      "/admin/poll",
      {
        id: current?.id,
        title: el("title").value,
        question: el("questionInput").value,
        status: el("status").value,
        opens_at: opensAt,
        closes_at: closesAt,
        games
      },
      "POST"
    );

    await refresh(saved.id);

    el("adminMessage").textContent =
      "Saved successfully. Times are displayed in Eastern Time.";

  } catch (error) {
    el("adminMessage").textContent =
      error.message;

  } finally {
    saveButton.disabled = false;
  }
};


// Weekly polls retain their own choices and votes. No delete/reset actions.
async function loadHistory() {
  const data = await req("/admin/polls");
  el("pollHistory").replaceChildren();
  for (const p of data.polls || []) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `#${p.id} · ${p.title} · ${p.status} · ${p.closes_at ? utcToEasternInput(p.closes_at).replace("T", " ") + " ET" : "No close date"}`;
    el("pollHistory").append(o);
  }
  if(current) el("pollHistory").value = current.id;
}
el("openPoll").onclick = async () => {
  try { await refresh(Number(el("pollHistory").value)); el("adminMessage").textContent = "Saved poll loaded."; }
  catch(e) { el("adminMessage").textContent = e.message; }
};
el("archivePoll").onclick = async () => {
  if(!current) return;
  const id = current.id;
  el("archivePoll").disabled = true;
  try {
    await req("/admin/archive", {id}, "POST");
    await refresh(id);
    el("adminMessage").textContent = "Poll archived. Matchups and votes are preserved. Choose CREATE NEW POLL for next week.";
  } catch(e) { el("archivePoll").disabled = false; el("adminMessage").textContent = e.message; }
};
el("newPoll").onclick = () => {
  current = null; currentData = null; choicesLocked = false;
  el("pollHeading").textContent = "New poll — unsaved draft";
  el("pollNotice").textContent = "This is a separate poll with zero votes. Archive the previous poll using Saved polls if you have not already done so.";
  el("title").value = "Fan Choice Friday";
  el("questionInput").value = "Which NAL game should we air this Friday for Fan Choice Friday?";
  el("opens").value = ""; el("closes").value = "";
  el("status").value = "draft";
  el("gameFields").replaceChildren(); el("libraryGames").replaceChildren();
  el("libraryMessage").textContent = "";
  el("results").textContent = "No votes — new poll.";
  for(const id of ["addGame","loadLibrary"]) el(id).disabled = false;
  for(const id of ["archivePoll","exportPoll"]) el(id).disabled = true;
  el("pollHistory").selectedIndex = -1;
  el("adminMessage").textContent = "Add 2–4 games, set the Eastern voting dates, and SAVE POLL. Video preview links are optional.";
};
el("exportPoll").onclick = () => {
  if(!currentData?.poll) return;
  const blob = new Blob([JSON.stringify(currentData,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `fan-choice-friday-poll-${current.id}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
};
