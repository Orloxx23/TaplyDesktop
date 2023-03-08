const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("https");
const fetch = require("node-fetch");
const WebSocket = require("ws");

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PORT = process.env.PORT || 3000;

let token = null;
let entitlement = null;
let puuid = null;
let pid = null;

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

async function getEntitlementsToken(port) {
  let url = `https://127.0.0.1:${port}/entitlements/v1/token`;

  let options = {
    method: "GET",
    headers: { Authorization: "Basic cmlvdDo5VDRzZ202dEZHVGxfUHJNQTk1RXlR" },
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      entitlement = json.token;
      token = json.accessToken;
    })
    .catch((err) => console.error("error:" + err));
}

async function getPUUID(port) {
  let url = `https://127.0.0.1:${port}/chat/v1/session`;

  let options = {
    method: "GET",
    headers: { Authorization: "Basic cmlvdDo5VDRzZ202dEZHVGxfUHJNQTk1RXlR" },
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      puuid = json.puuid;
      pid = json.pid;
    })
    .catch((err) => console.error("error:" + err));
}

async function authCookies() {
  let url = "https://auth.riotgames.com/api/v1/authorization";

  let options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie:
        "__cf_bm=m768G2u1g0LA5ZTW7Gf938PzaQXhEah8JgIUINk503k-1678240756-0-AeRSuqMxeP6zCdziSO3Xdud23c5ebpiIQc2%2FGeF0L8bWynNcx8pswaLXseNk7p3q5Qd9GN9c3BBDcXYj9NBC4rQ%3D; tdid=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE1N2JkM2MyLTYzZTgtNGIyNC1iYzgzLTk0N2U3ZDJmYjU2NiIsIm5vbmNlIjoiWEtqU2FuU0FxbDg9IiwiaWF0IjoxNjc4MjQwODk0fQ.jA6anM-Dx0aZXv7rddbiiO96tl1JXdkdhEHcWLCdFBk; asid=GgwXlHTjgHZaC4tf-FqbiUw7KFBgPJjehQQzq_puzd8.3XSHjMMtamQ%253D; clid=ue1; ",
      accept: "*/*",
    },
    body: '{"client_id":"play-valorant-web-prod","nonce":"1","redirect_uri":"https://playvalorant.com/opt_in","response_type":"token id_token"}',
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => console.log(json))
    .catch((err) => console.error("error:" + err));
}

async function authRequest() {
  let url = "https://auth.riotgames.com/api/v1/authorization";

  let options = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie:
        "tdid=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE1N2JkM2MyLTYzZTgtNGIyNC1iYzgzLTk0N2U3ZDJmYjU2NiIsIm5vbmNlIjoiWEtqU2FuU0FxbDg9IiwiaWF0IjoxNjc1NjE5NjY3fQ.DzK5ROhq4zrpx2pP1o1jVYZYDd9azOe-r71WZBV99vs; ",
    },
    body: '{"type":"auth","username":"killjoy2305","password":"zarzal1169","remember":true,"language":"en_US"}',
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => {})
    .catch((err) => console.error("error:" + err));
}

let state = "Loading...";
let globalSocket = null;

async function run() {
  let lockData = null;
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
      console.log(e);
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
  const logPath = `./logs/${new Date().getTime()}.txt`;
  console.log(`Writing to ${logPath}`);

  const logStream = fs.createWriteStream(logPath);
  logStream.write(JSON.stringify(lockData) + "\n");
  logStream.write(JSON.stringify(sessionData) + "\n");
  logStream.write(JSON.stringify(helpData) + "\n\n");

  const ws = new WebSocket(
    `wss://riot:${lockData.password}@127.0.0.1:${lockData.port}`,
    {
      rejectUnauthorized: false,
    }
  );

  ws.on("open", () => {
    Object.entries(helpData.events).forEach(([name, desc]) => {
      if (name === "OnJsonApiEvent") return;
      ws.send(JSON.stringify([5, name]));
    });
    state = "Connected to websocket!";
    globalSocket?.emit("console", state);
    console.log("Connected to websocket!");
  });

  ws.on("message", (data) => {
    logStream.write(new Date().getTime() + " " + data + "\n");
    globalSocket?.emit("message", data);
  });

  ws.on("close", () => {
    state = "Websocket closed!";
    globalSocket?.emit("console", state);
    console.log("Websocket closed!");
    logStream.end();
  });

  // getEntitlementsToken(lockData.port);
}

// run();
authCookies();

io.on("connection", (socket) => {
  globalSocket = socket;

  console.log("Usuario conectado");

  socket.emit("console", state);

  socket.on("mensaje", (data) => {
    console.log(`Mensaje recibido: ${data}`);
    io.emit("mensaje", data);
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado");
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
