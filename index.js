const express = require("express");
const appServer = express();
let server = require("http").Server(appServer);
let io = require("socket.io")(server);
const path = require("path");
const WebSocket = require("ws");
const isEqual = require("lodash/isEqual");
require("update-electron-app")();

const ip = require("ip");

const osIp = require("os");

const { app, BrowserWindow, Tray, Notification, screen } = require("electron");
const { ipcMain } = require("electron");
const { Menu } = require("electron");
const getInstance = require("./src/functions/UserData");
const constants = require("./src/utils/constants");
const userdata = getInstance();

require("dotenv").config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// We will use port 7000 for our server
const PORT = 7000;

// Show notification when closing window
let showNotificationBackground = true;

/* Electron */
let win = null;
let loadingWin = null;

// To avoid opening multiple windows when installing.
if (require("electron-squirrel-startup")) app.quit();

// We set the name to our app
app.setName("Taply");

// We check that the application is not open to start it
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  // If there is already an instance running, close the current one
  app.quit();
  return;
} else {
  // Create the main window
  const createWindow = () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    win = new BrowserWindow({
      width: 600,
      height: 300,
      x: 100,
      y: 100,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: true,
        contextIsolation: false,
        devTools: false,
      },
      titleBarStyle: "hidden",
      resizable: false,
      fullscreenable: false,
      hasShadow: true,
      icon: path.join(__dirname, "logo.png"),
    });

    const [windowWidth, windowHeight] = win.getSize();
    win.setPosition(width - 5 - windowWidth, height - 5 - windowHeight);
    win.loadFile("index.html");
  };

  // Create the loading window
  const createLoadingWindow = () => {
    loadingWin = new BrowserWindow({
      width: 300,
      height: 300,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        preload: path.join(__dirname, "src/js/loadingPrelaod.js"),
        devTools: false,
      },
      titleBarStyle: "hidden",
      resizable: false,
      fullscreenable: false,
      hasShadow: true,
      icon: path.join(__dirname, "logo.png"),
    });
    loadingWin.loadFile("loading.html");
  };

  let tray = null;
  app.whenReady().then(() => {
    // When the app is ready we create the loading window
    createLoadingWindow();

    // We create the tray icon
    tray = new Tray(path.join(__dirname, "logo.png"));

    // Background app menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Taply",
        enabled: false,
        icon: path.join(__dirname, "logo3.png"),
      },
      {
        label: "Open",
        click: () => {
          win.show();
        },
      },
      {
        label: "Close",
        click: () => {
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // When it receives the "closeApp" order we hide the window and show the notification
    ipcMain.on("closeApp", (event, arg) => {
      win.hide();

      const notification = new Notification({
        title: "Background app",
        body: "The app continues to run in the background.",
        icon: path.join(__dirname, "logo.png"),
        silent: true,
      });

      if (showNotificationBackground) {
        notification.show();
        showNotificationBackground = false;
      }
    });

    // When it receives the "minimizeApp" order we minimize the window
    ipcMain.on("minimizeApp", (event, arg) => {
      win.minimize();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // If there is an internet connection, it stops loading and goes to the main window and starts the "run()" process.
  ipcMain.on("online", (event, arg) => {
    if (loadingWin) {
      if (!win) {
        loadingWin.close();
        loadingWin = null;
        createWindow();
        run();
      }
    }
  });

  // If there is no internet, the loading window will be displayed
  ipcMain.on("offline", (event, arg) => {
    if (win) {
      if (!loadingWin) {
        createLoadingWindow();
        win.hide();
        win = null;
      }
    }
  });
}

/* ----- */

// Convert an IP address to hexadecimal and generate the code
function ipToHex(ipAddress) {
  let hex = "";
  const octetos = ipAddress.split(".");
  for (let i = 0; i < octetos.length; i++) {
    let octetoHex = parseInt(octetos[i]).toString(16);
    if (octetoHex.length === 1) {
      octetoHex = "0" + octetoHex;
    }
    hex += octetoHex;
  }

  const code = hex.slice(4);
  return code;
}

// We get the user's IP
function getUserIp() {
  const ethernetIp = osIp.networkInterfaces()["Ethernet"];
  const wifiIp = osIp.networkInterfaces()["Wi-Fi"];

  const ethernetIpv4 =
    ethernetIp && ethernetIp.find((ip) => ip.family === "IPv4");
  const wifiIpv4 = wifiIp && wifiIp.find((ip) => ip.family === "IPv4");

  if (wifiIpv4 && ip.isPrivate(wifiIpv4.address)) {
    userIp = wifiIpv4.address;
  }

  if (ethernetIpv4 && ip.isPrivate(ethernetIpv4.address)) {
    userIp = ethernetIpv4.address;
  }

  if (!userIp) {
    // If the user is not connected to the internet, show the error message
  }
}

// Send the code to the main window
ipcMain.on("getCode", (event, arg) => {
  event.reply("code", ipToHex(userIp));
});

// We reset the variables and start the "run()" process again
function reset() {
  userdata.resetVariables();
  run();
}

let state = "Loading...";
let globalSocket = null;

async function run() {
  userdata.lockData = null;
  win.webContents.send("message", "Waiting for the game to start...");
  do {
    try {
      userdata.lockData = await userdata.getLockfileData();
    } catch (e) {
      state = "Waiting for lockfile...";
      globalSocket?.emit("console", state);
      console.log("Waiting for lockfile...");
      await userdata.waitForLockfile();
      win.webContents.send("message", "Waiting for the game to start...");
    }
  } while (userdata.lockData === null);

  state = "Got lock data...";
  globalSocket?.emit("console", state);
  console.log("Got lock data...");

  userdata.sessionData = null;
  userdata.lastRetryMessage = 0;
  console.log(
    "🚀 ~ file: index.js:787 ~ run ~ lastRetryMessage:",
    userdata.lastRetryMessage
  );
  do {
    try {
      userdata.sessionData = await userdata.getSession(
        userdata.lockData.port,
        userdata.lockData.password
      );
      if (userdata.sessionData.loaded === false) {
        await userdata.asyncTimeout(1500);
        userdata.sessionData = null;
      }
    } catch (e) {
      const currentTime = new Date().getTime();
      // console.error(e);
      if (currentTime - userdata.lastRetryMessage > 1000) {
        state = "Unable to get session data, retrying...";
        globalSocket?.emit("console", state);
        console.log("Unable to get session data, retrying...");
        userdata.lastRetryMessage = currentTime;
      }
    }
  } while (userdata.sessionData === null);

  userdata.helpData = null;
  do {
    userdata.helpData = await userdata.getHelp(
      userdata.lockData.port,
      userdata.lockData.password
    );
    if (
      !userdata.helpData.events.hasOwnProperty(
        "OnJsonApiEvent_chat_v4_presences"
      )
    ) {
      state = "Retrying help data events...";
      globalSocket?.emit("console", state);
      console.log("Retrying help data events...");
      userdata.helpData = null;
      await asyncTimeout(1500);
    }
  } while (userdata.helpData === null);

  state = "Got PUUID...";
  globalSocket?.emit("console", state);
  console.log("Got PUUID...");

  // try {
  //   await fs.promises.mkdir("./logs");
  // } catch (ignored) {}
  // const logPath = `./logs/${new Date().getTime()}.txt`;
  // console.log(`Writing to ${logPath}`);

  // const logStream = fs.createWriteStream(logPath);
  // logStream.write(JSON.stringify(userdata.lockData) + "\n");
  // logStream.write(JSON.stringify(sessionData) + "\n");
  // logStream.write(JSON.stringify(userdata.helpData) + "\n\n");

  const ws = new WebSocket(
    `wss://riot:${userdata.lockData.password}@127.0.0.1:${userdata.lockData.port}`,
    {
      rejectUnauthorized: false,
    }
  );

  ws.on("open", async () => {
    Object.entries(userdata.helpData.events).forEach(([name, desc]) => {
      if (name === "OnJsonApiEvent") return;
      ws.send(JSON.stringify([5, name]));
    });
    state = "Connected to websocket!";
    globalSocket?.emit("console", state);
    console.log("Connected to websocket!");
    globalSocket?.emit("connected");

    await userdata.getVersion();
    await userdata.getEntitlementsToken(
      userdata.lockData.port,
      userdata.lockData.password
    );
    await userdata.getRegionAndShard(
      userdata.lockData.port,
      userdata.lockData.password
    );
    await userdata.getPUUID(userdata.lockData.port, userdata.lockData.password);
    await userdata.getPartyPlayer();
    await userdata.getPlayerContracts();

    // To do...
    if (userdata.partyId) {
      await userdata.getParty();
    } else {
      await userdata.getPartyPlayer();
      await userdata.getParty();
    }

    win.webContents.send("message", "Available.");
  });

  ws.on("message", async (data) => {
    // logStream.write(new Date().getTime() + " " + data + "\n");

    const dataString =
      data.toString().length > 0 ? JSON.parse(data?.toString()) : null;
    if (dataString === null) return;

    // const eventType = dataString[0];
    const eventName = dataString[1];
    const event = dataString[2];

    // console.log(eventName, event);
    /* Pregame events */
    if (eventName === constants.gameEvent) {
      if (event.data.service === "pregame") {
        if (
          event.uri.includes(
            "/riot-messaging-service/v1/message/ares-pregame/pregame/v1/matches/"
          )
        ) {
          await userdata.getPregame();
          console.info("userdata.preGameId", userdata.preGameId);
          /*if (userdata.preGameId === null || userdata.preGameId === undefined) {
            globalSocket?.emit("preGameEvent", {
              preGameId: "undefined",
              pregame: "undefined",
            });
          }*/
          if (isEqual(userdata.pregame?.team, userdata.pregameOld?.team))
            return;
          userdata.pregameOld = userdata.pregame;
          globalSocket?.emit("preGameEvent", {
            preGameId: userdata.preGameId,
            pregame: userdata.pregame,
          });
        }
      }
    }

    /* Match events */
    /*if (eventName === constants.gameEvent) {
      if (event.data.service === "core-game") {
        if (
          event.uri.includes(
            "/riot-messaging-service/v1/message/ares-core-game/core-game/v1/matches/"
          )
        ) {
          await userdata.getCurrentMatch(globalSocket);
          // console.log("currentMatch", currentMatch);
          globalSocket?.emit("inGame", userdata.currentMatch);
        }
      }
    }*/

    /* Party, and chat events */
    if (eventName === constants.chatState) {
      if (event.data.presences[0].puuid !== userdata.puuid) return;
      // console.log("chatState", eventName, event.data.presences[0].private);

      await userdata.getPartyPlayer();
      await userdata.getParty();

      const presences = JSON.parse(atob(event.data.presences[0].private));
      // console.log("presences", presences);

      if (presences.sessionLoopState === "MENUS") {
        console.log("\n\tMENUS\n");
        globalSocket?.emit("goHome");
      }

      if (presences.sessionLoopState === "PREGAME") {
        console.log("\n\tPREGAME\n");
        await userdata.getPregame();
        console.info("userdata.preGameId", userdata.preGameId);
        /*if (userdata.preGameId === null || userdata.preGameId === undefined) {
          globalSocket?.emit("preGameEvent", {
            preGameId: "undefined",
            pregame: "undefined",
          });
        }*/
        if (isEqual(userdata.pregame?.team, userdata.pregameOld?.team)) return;
        userdata.pregameOld = userdata.pregame;
        globalSocket?.emit("preGameEvent", {
          preGameId: userdata.preGameId,
          pregame: userdata.pregame,
        });
      }

      if (presences.sessionLoopState === "INGAME") {
        console.log("\n\tINGAME\n");
        await userdata.getCurrentMatch(globalSocket);
        globalSocket?.emit("inGame", userdata.currentMatch);
        globalSocket?.emit("goInGame");
        globalSocket?.emit("inGameData", presences);
      }
    }

    /*if (eventName === "OnJsonApiEvent_chat_v5_messages") {
      globalSocket?.emit("chat", event);
    }*/
  });

  ws.on("close", () => {
    state = "Websocket closed!";
    globalSocket?.emit("console", state);
    console.log("Websocket closed!");
    globalSocket?.emit("disconnected");
    win.webContents.send("message", "Game closed.");
    globalSocket?.disconnect();
    reset();
  });
}

getUserIp();

// We update some variables every 20 minutes (it's just a test since from time to time the connection is lost)
setInterval(async () => {
  if (!userdata.lockData || userdata.lockData === null) return;
  await userdata.getEntitlementsToken(
    userdata.lockData.port,
    userdata.lockData.password
  );
  await userdata.getRegionAndShard(
    userdata.lockData.port,
    userdata.lockData.password
  );
  await userdata.getPUUID(userdata.lockData.port, userdata.lockData.password);
  await userdata.getPartyPlayer();
  await userdata.getParty();
}, 20 * 60000);

// Connection with mobile app through websocket (socket.io)
io.on("connection", async (socket) => {
  globalSocket = socket; // we make the socket accessible from anywhere in the code

  console.log("Usuario conectado");
  socket.emit("connected");

  // We check if the server has the necessary data to connect with the user
  if (
    !userdata.lockData ||
    userdata.lockAgent === null ||
    userdata.helpData === null ||
    userdata.puuid === null
  ) {
    socket.emit("noLockData");
    socket.emit("disconnected");
    socket.disconnect();
    return;
  }

  // get the current party of the user
  await userdata.getPartyPlayer();
  await userdata.getParty();

  socket.emit("console", state);

  // We send the data to the mobile app
  userdata.puuid && socket.emit("puuid", userdata.puuid);
  userdata.gameModes && socket.emit("gamemodes", userdata.gameModes);
  userdata.party && socket.emit("party", userdata.party);
  userdata.playerContracts &&
    socket.emit("playerContracts", userdata.playerContracts);

  const userPresence = await userdata.getPresence();
  console.log("🚀 ~ file: index.js:520 ~ io.on ~ userPresence:", userPresence)

  if (userPresence?.sessionLoopState === "INGAME") {
    await userdata.getCurrentMatch(socket);
    socket.emit("inGame", userdata.currentMatch);
    socket.emit("goInGame");
    globalSocket?.emit("inGameData", userPresence);
  }

  // here orders are received from the mobile app
  socket.on("updateData", () => {
    userdata.puuid && socket.emit("puuid", userdata.puuid);
    userdata.gameModes && socket.emit("gamemodes", userdata.gameModes);
    userdata.party && socket.emit("party", userdata.party);
    userdata.playerContracts &&
      socket.emit("playerContracts", userdata.playerContracts);
  });

  socket.on("setGamemode", async (data) => {
    console.log("setGamemode");
    await userdata.changeQueue(data);
  });

  socket.on("startQueue", async () => {
    console.log("startQueue");
    await userdata.startQueue();
  });

  socket.on("stopQueue", async () => {
    console.log("stopQueue");
    await userdata.stopQueue();
  });

  socket.on("partyAccess", async (data) => {
    console.log("partyAccess");
    await userdata.partyAccessibility(data);
  });

  socket.on("selectAgent", async (data) => {
    console.log("selectAgent");
    await userdata.selectAgent(data);
  });

  socket.on("lockAgent", async (data) => {
    console.log("lockAgent");
    await userdata.lockAgent(data);
  });

  socket.on("isInGame", async () => {
    console.log("isInGame?");
    await userdata.getCurrentMatch(globalSocket);
  });

  socket.on("dodge", async () => {
    console.log("dodge");
    await userdata.dodge();
  });

  socket.on("leaveParty", async () => {
    console.log("leaveParty");
    await userdata.leaveParty();
  });

  socket.on("getFriends", async () => {
    console.log("getFriends");
    await userdata.getFriends(globalSocket);
  });

  socket.on("invite", async (data) => {
    console.log("invite");
    await userdata.inviteFriend(data.name, data.tag);
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

// We start the server
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
