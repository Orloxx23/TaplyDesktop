const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const fs = require("fs");
const path = require("path");
const https = require("https");
const fetch = require("node-fetch");
const WebSocket = require("ws");
const isEqual = require("lodash/isEqual");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PORT = process.env.PORT || 3000;

let lockData = null;

let token = null;
let entitlement = null;
let puuid = null;
let pid = null;
let region = null;
let shard = null;
let clientVersion = null;
let partyId = null;
let party = null;
let partyOld = null;
let gameModes = null;
let preGameId = null;
let pregame = null;
let pregameOld = null;
let currentMatch = null;
let playerContracts = null;

function stopServer() {
  server.close(() => {
    console.log("Servidor http detenido");
    io.close(() => {
      console.log("Servidor Socket.io detenido");
    });
  });
}

const localAgent = new https.Agent({
  rejectUnauthorized: false,
});

async function asyncTimeout(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

async function getLockfileData() {
  const lockfilePath = path.join(
    process.env["LOCALAPPDATA"],
    "Riot Games\\Riot Client\\Config\\lockfile"
  );
  const contents = await fs.promises.readFile(lockfilePath, "utf8");
  let d = {};
  [d.name, d.pid, d.port, d.password, d.protocol] = contents.split(":");
  return d;
}

async function waitForLockfile() {
  return new Promise(async (resolve, reject) => {
    const watcher = fs.watch(
      path.join(
        process.env["LOCALAPPDATA"],
        "Riot Games\\Riot Client\\Config\\"
      ),
      (eventType, fileName) => {
        if (eventType === "rename" && fileName === "lockfile") {
          watcher.close();
          resolve();
        }
      }
    );
  });
}

async function getSession(port, password) {
  return (
    await fetch(`https://127.0.0.1:${port}/chat/v1/session`, {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`riot:${password}`).toString("base64"),
      },
      agent: localAgent,
    })
  ).json();
}

async function getHelp(port, password) {
  return (
    await fetch(`https://127.0.0.1:${port}/help`, {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`riot:${password}`).toString("base64"),
      },
      agent: localAgent,
    })
  ).json();
}

async function getEntitlementsToken(port, password) {
  let url = `https://127.0.0.1:${port}/entitlements/v1/token`;
  const username = "riot";

  let options = {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(username + ":" + password).toString(
        "base64"
      )}`,
    },
  };

  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      entitlement = json.token;
      token = json.accessToken;
    })
    .catch((err) => console.error("error:" + err));
}

async function getPUUID(port, password) {
  console.log("getting puuid");

  let url = `https://127.0.0.1:${port}/chat/v1/session`;
  const username = "riot";

  let options = {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(username + ":" + password).toString(
        "base64"
      )}`,
    },
  };

  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      puuid = json.puuid;
      pid = json.pid;
      if (json.region.includes("la")) {
        region = "latam";
        shard = "na";
      } else if (json.region === "br") {
        region = json.region;
        shard = "na";
      } else {
        region = json.region;
        shard = json.region;
      }
    })
    .catch((err) => console.error("error:" + err));
}

async function getWallet() {
  let url = `https://pd.na.a.pvp.net/store/v1/wallet/${puuid}`;
  let wallet = null;

  let options = {
    method: "GET",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      console.log("✅ ~ file: index.js:149 ~ getWallet ~ url:", url);
      wallet = json;
    })
    .catch((err) => console.error("error:" + err));

  return wallet;
}

async function getVersion() {
  let url = "https://valorant-api.com/v1/version";

  let options = { method: "GET" };

  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      console.log("✅ ~ file: index.js:184 ~ getVersion ~ url:", url);
      clientVersion = json.data.riotClientVersion;
    })
    .catch((err) => console.error("error:" + err));
}

async function getPregame() {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/pregame/v1/players/${puuid}`;

  let options = {
    method: "GET",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      "X-Riot-ClientVersion": clientVersion,
      Authorization: "Bearer " + token,
    },
  };

  await fetch(url, options)
    .then((res) => res.json())
    .then(async (json) => {
      console.log("✅ ~ file: index.js:198 ~ getPreGameMatch ~ url:", url);
      preGameId = json.MatchID;
      await getPreGameMatch();
    })
    .catch((err) => console.error("error:" + err));
}

async function getPreGameMatch() {
  if (preGameId == null) return;
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/pregame/v1/matches/${preGameId}`;

  let options = {
    method: "GET",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      pregame = {
        map: json.MapID,
        team: json.AllyTeam.Players,
        queue: json.QueueID,
      };
      console.log("✅ ~ file: index.js:221 ~ getPreGameMatch ~ url:", url);
    })
    .catch((err) => console.error("error:" + err));
}

async function getPartyPlayer() {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/players/${puuid}`;

  let options = {
    method: "GET",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      "X-Riot-ClientVersion": clientVersion,
      Authorization: "Bearer " + token,
    },
  };

  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      console.log("✅ ~ file: index.js:195 ~ getPartyPlayer ~ url:", url);
      partyId = json.CurrentPartyID;
    })
    .catch((err) => console.error("error:" + err));
}

async function getParty() {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/parties/${partyId}`;

  let options = {
    method: "GET",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      gameModes = json.EligibleQueues;
      party = json;
      console.log("✅ ~ file: index.js:225 ~ getParty ~ url:", url);
    })
    .catch((err) => console.error("error:" + err));
}

async function changeQueue(gamemode) {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/parties/${partyId}/queue`;

  let options = {
    method: "POST",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      "content-type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: `{"queueID":"${gamemode}"}}`,
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) =>
      console.log("✅ ~ file: index.js:240 ~ changeQueue ~ url:", url)
    )
    .catch((err) => console.error("error:" + err));
}

async function startQueue() {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/parties/${partyId}/matchmaking/join`;

  let options = {
    method: "POST",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      console.log("✅ ~ file: index.js:255 ~ startQueue ~ url:", url);
    })
    .catch((err) => console.error("error:" + err));
}

async function stopQueue() {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/parties/${partyId}/matchmaking/leave`;

  let options = {
    method: "POST",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      console.log("✅ ~ file: index.js:255 ~ stopQueue ~ url:", url);
    })
    .catch((err) => console.error("error:" + err));
}

async function partyAccessibility(access) {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/parties/${partyId}/accessibility`;

  let options = {
    method: "POST",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      "content-type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: `{"accessibility":"${access}"}}`,
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) =>
      console.log("✅ ~ file: index.js:309 ~ partyAccessibility ~ url:", url)
    )
    .catch((err) => console.error("error:" + err));
}

async function getCurrentMatch() {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/core-game/v1/players/${puuid}`;

  let options = {
    method: "GET",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      globalSocket?.emit("inGame", json.MatchID);
      currentMatch = json.MatchID;
    })
    .catch((err) => console.error("error:" + err));
}

async function getPlayerContracts() {
  let url = `https://pd.${shard}.a.pvp.net/contracts/v1/contracts/${puuid}`;

  let options = {
    method: "GET",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      "X-Riot-ClientVersion": clientVersion,
      Authorization: "Bearer " + token,
    },
  };

  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      playerContracts = json;
      console.log("✅ ~ file: index.js:391 ~ getPlayerContracts ~ url:", url);
    })
    .catch((err) => console.error("error:" + err));
}

async function selectAgent(agent) {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/pregame/v1/matches/${preGameId}/select/${agent}`;

  let options = {
    method: "POST",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      console.log("✅ ~ file: index.js:379 ~ selectAgent ~ url:", url);
    })
    .catch((err) => console.error("error:" + err));
}

async function lockAgent(agent) {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/pregame/v1/matches/${preGameId}/lock/${agent}`;

  let options = {
    method: "POST",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) =>
      console.log("✅ ~ file: index.js:387 ~ lockAgent ~ url:", url)
    )
    .catch((err) => console.error("error:" + err));
}

async function dodge() {
  let url = `https://glz-${region}-1.${shard}.a.pvp.net/pregame/v1/matches/${preGameId}/quit`;

  let options = {
    method: "POST",
    headers: {
      "X-Riot-Entitlements-JWT": entitlement,
      Authorization: "Bearer " + token,
    },
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => console.log(json))
    .catch((err) => console.error("error:" + err));
}

let state = "Loading...";
let globalSocket = null;

async function run() {
  lockData = null;
  do {
    try {
      lockData = await getLockfileData();
    } catch (e) {
      state = "Waiting for lockfile...";
      globalSocket?.emit("console", state);
      console.log("Waiting for lockfile...");
      await waitForLockfile();
    }
  } while (lockData === null);

  state = "Got lock data...";
  globalSocket?.emit("console", state);
  console.log("Got lock data...");

  let sessionData = null;
  let lastRetryMessage = 0;
  do {
    try {
      sessionData = await getSession(lockData.port, lockData.password);
      if (sessionData.loaded === false) {
        await asyncTimeout(1500);
        sessionData = null;
      }
    } catch (e) {
      const currentTime = new Date().getTime();
      if (currentTime - lastRetryMessage > 1000) {
        state = "Unable to get session data, retrying...";
        globalSocket?.emit("console", state);
        console.log("Unable to get session data, retrying...");
        lastRetryMessage = currentTime;
      }
    }
  } while (sessionData === null);

  let helpData = null;
  do {
    helpData = await getHelp(lockData.port, lockData.password);
    if (!helpData.events.hasOwnProperty("OnJsonApiEvent_chat_v4_presences")) {
      state = "Retrying help data events...";
      globalSocket?.emit("console", state);
      console.log("Retrying help data events...");
      helpData = null;
      await asyncTimeout(1500);
    }
  } while (helpData === null);

  state = "Got PUUID...";
  globalSocket?.emit("console", state);
  console.log("Got PUUID...");

  try {
    await fs.promises.mkdir("./logs");
  } catch (ignored) {}
  // const logPath = `./logs/${new Date().getTime()}.txt`;
  // console.log(`Writing to ${logPath}`);

  // const logStream = fs.createWriteStream(logPath);
  // logStream.write(JSON.stringify(lockData) + "\n");
  // logStream.write(JSON.stringify(sessionData) + "\n");
  // logStream.write(JSON.stringify(helpData) + "\n\n");

  const ws = new WebSocket(
    `wss://riot:${lockData.password}@127.0.0.1:${lockData.port}`,
    {
      rejectUnauthorized: false,
    }
  );

  ws.on("open", async () => {
    Object.entries(helpData.events).forEach(([name, desc]) => {
      if (name === "OnJsonApiEvent") return;
      ws.send(JSON.stringify([5, name]));
    });
    state = "Connected to websocket!";
    globalSocket?.emit("console", state);
    console.log("Connected to websocket!");
    globalSocket?.emit("connected");

    await getVersion();
    await getEntitlementsToken(lockData.port, lockData.password);
    await getPUUID(lockData.port, lockData.password);
    await getPartyPlayer();
    await getPlayerContracts();

    // To do...
    if (partyId) {
      await getParty();
    } else {
      await getPartyPlayer();
      await getParty();
    }
  });

  ws.on("message", async (data) => {
    // logStream.write(new Date().getTime() + " " + data + "\n");

    const dataString =
      data.toString().length > 0 ? JSON.parse(data?.toString()) : null;
    if (dataString === null) return;

    const eventType = dataString[0];
    const eventName = dataString[1];
    const event = dataString[2];

    // console.log(eventName, event);

    if (eventName === "OnJsonApiEvent_riot-messaging-service_v1_message") {
      if (event.data.service === "pregame") {
        if (
          event.uri.includes(
            "/riot-messaging-service/v1/message/ares-pregame/pregame/v1/matches/"
          )
        ) {
          await getPregame();
          console.info("preGameId", preGameId);
          if (preGameId === null || preGameId === undefined) {
            globalSocket?.emit("preGameEvent", {
              preGameId: "undefined",
              pregame: "undefined",
            });
          }
          if (isEqual(pregame?.team, pregameOld?.team)) return;
          pregameOld = pregame;
          globalSocket?.emit("preGameEvent", {
            preGameId: preGameId,
            pregame: pregame,
          });
        }
      }
    }

    if (eventName === "OnJsonApiEvent_chat_v4_presences") {
      await getParty();
      if (isEqual(party, partyOld)) return;
      partyOld = party;
      globalSocket?.emit("updateData");
    }
  });

  ws.on("close", () => {
    state = "Websocket closed!";
    globalSocket?.emit("console", state);
    console.log("Websocket closed!");
    globalSocket?.emit("disconnected");
    // logStream.end();
    stopServer();
  });
}

run();

io.on("connection", async (socket) => {
  globalSocket = socket;
  console.log("Usuario conectado");
  socket.emit("connected");

  socket.emit("console", state);

  puuid && socket.emit("puuid", puuid);

  gameModes && socket.emit("gamemodes", gameModes);

  party && socket.emit("party", party);

  playerContracts && socket.emit("playerContracts", playerContracts);

  socket.on("updateData", () => {
    puuid && socket.emit("puuid", puuid);
    gameModes && socket.emit("gamemodes", gameModes);
    party && socket.emit("party", party);
    playerContracts && socket.emit("playerContracts", playerContracts);
  });

  socket.on("setGamemode", async (data) => {
    console.log("setGamemode");
    await changeQueue(data);
  });

  socket.on("startQueue", async () => {
    console.log("startQueue");
    await startQueue();
  });

  socket.on("stopQueue", async () => {
    console.log("stopQueue");
    await stopQueue();
  });

  socket.on("partyAccess", async (data) => {
    console.log("partyAccess");
    await partyAccessibility(data);
  });

  socket.on("selectAgent", async (data) => {
    console.log("selectAgent");
    await selectAgent(data);
  });

  socket.on("lockAgent", async (data) => {
    console.log("lockAgent");
    await lockAgent(data);
  });

  socket.on("isInGame", async () => {
    console.log("isInGame?");
    await getCurrentMatch();
  });

  socket.on("dodge", async () => {
    console.log("dodge");
    await dodge();
  });

  socket.on("disconnect", () => {
    socket.emit("console", "Disconnected");
    console.log("Usuario desconectado");
  });

  socket.on("error", (err) => {
    socket.emit("console", "Error");
    console.log("Error", err);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
