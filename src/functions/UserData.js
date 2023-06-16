const fs = require("fs");
const path = require("path");
const https = require("https");
const fetch = require("node-fetch");

class UserData {
  lockData = null;
  helpData = null;
  sessionData = null;
  lastRetryMessage = 0;

  token = null;
  entitlement = null;
  puuid = null;
  pid = null;
  region = null;
  shard = null;
  clientVersion = null;
  partyId = null;
  party = null;
  partyOld = null;
  gameModes = null;
  preGameId = null;
  pregame = null;
  pregameOld = null;
  currentMatch = null;
  playerContracts = null;
  userIp = null;
  friends = null;

  constructor() {
    this.lockData = null;
    this.helpData = null;
    this.sessionData = null;
    this.lastRetryMessage = 0;
    this.token = null;
    this.entitlement = null;
    this.puuid = null;
    this.pid = null;
    this.region = null;
    this.shard = null;
    this.clientVersion = null;
    this.partyId = null;
    this.party = null;
    this.partyOld = null;
    this.gameModes = null;
    this.preGameId = null;
    this.pregame = null;
    this.pregameOld = null;
    this.currentMatch = null;
    this.playerContracts = null;
    this.userIp = null;
    this.friends = null;
  }

  resetVariables() {
    console.log("Resetting...");
    this.lockData = null;
    this.helpData = null;
    this.sessionData = null;
    this.lastRetryMessage = 0;

    this.token = null;
    this.entitlement = null;
    this.puuid = null;
    this.pid = null;
    this.region = null;
    this.shard = null;
    this.clientVersion = null;
    this.partyId = null;
    this.party = null;
    this.partyOld = null;
    this.gameModes = null;
    this.preGameId = null;
    this.pregame = null;
    this.pregameOld = null;
    this.currentMatch = null;
    this.playerContracts = null;
    this.userIp = null;
  }

  localAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  async asyncTimeout(delay) {
    return new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  async getLockfileData() {
    const lockfilePath = path.join(
      process.env["LOCALAPPDATA"],
      "Riot Games\\Riot Client\\Config\\lockfile"
    );
    const contents = await fs.promises.readFile(lockfilePath, "utf8");
    let d = {};
    [d.name, d.pid, d.port, d.password, d.protocol] = contents.split(":");
    return d;
  }

  async waitForLockfile() {
    return new Promise((resolve, reject) => {
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

  async getSession(port, password) {
    return (
      await fetch(`https://127.0.0.1:${port}/chat/v1/session`, {
        headers: {
          Authorization:
            "Basic " + Buffer.from(`riot:${password}`).toString("base64"),
        },
        agent: this.localAgent,
      })
    ).json();
  }

  async getHelp(port, password) {
    return (
      await fetch(`https://127.0.0.1:${port}/help`, {
        headers: {
          Authorization:
            "Basic " + Buffer.from(`riot:${password}`).toString("base64"),
        },
        agent: this.localAgent,
      })
    ).json();
  }

  async getEntitlementsToken(port, password) {
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
        this.entitlement = json.token;
        this.token = json.accessToken;
      })
      .catch((err) => console.error("error:" + err));
  }

  async getRegionAndShard(port, password) {
    let url = `https://127.0.0.1:${port}/product-session/v1/external-sessions`;
    const username = "riot";

    let options = {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(username + ":" + password).toString(
          "base64"
        )}`,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        let first = Object.keys(json)[0];
        if (first === "host_app") {
          first = Object.keys(json)[1];
        }

        const tmpRegion =
          json[first].launchConfiguration.arguments[4].split("=")[1];
        this.region = tmpRegion;
        if (tmpRegion.includes("la")) {
          this.region = "latam";
          this.shard = "na";
        } else if (tmpRegion.includes("br")) {
          this.region = "br";
          this.shard = "na";
        } else {
          this.region = tmpRegion;
          this.shard = tmpRegion;
        }
      })
      .catch((err) => console.error("error:" + err));
  }

  async getPresence(port = this.lockData.port, password = this.lockData.password) {
    console.log("\n\tgetting presence");
    let url = `https://127.0.0.1:${port}/chat/v4/presences`;
    const username = "riot";

    let options = {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(username + ":" + password).toString(
          "base64"
        )}`,
      },
    };

    let userPrivate = null;

    await fetch(url, options).then((res) => res.json().then((json) => {
      console.log("\n")
      const userPresence = json.presences.find((p) => p.puuid === this.puuid);
      userPrivate = JSON.parse(atob(userPresence.private))
    }));

    return userPrivate;
  }

  async getPUUID(port, password) {
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
        this.puuid = json.puuid;
        this.pid = json.pid;
        /*if (json.region.includes("la")) {
          region = "latam";
          shard = "na";
        } else if (json.region.includes("br")) {
          region = "br";
          shard = "na";
        } else {
          region = json.region;
          shard = json.region;
        }*/
      })
      .catch((err) => console.error("error:" + err));
  }

  async getVersion() {
    let url = "https://valorant-api.com/v1/version";

    let options = { method: "GET" };

    await fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ ~ file: index.js:184 ~ getVersion ~ url:", url);
        this.clientVersion = json.data.riotClientVersion;
      })
      .catch((err) => console.error("error:" + err));
  }

  async getPregame() {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/pregame/v1/players/${this.puuid}`;

    let options = {
      method: "GET",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        "X-Riot-ClientVersion": this.clientVersion,
        Authorization: "Bearer " + this.token,
      },
    };

    await fetch(url, options)
      .then((res) => res.json())
      .then(async (json) => {
        console.log("✅ ~ file: index.js:198 ~ getPreGameMatch ~ url:", url);
        this.preGameId = json.MatchID;
        await this.getPreGameMatch();
      })
      .catch((err) => console.error("error:" + err));
  }

  async getPreGameMatch() {
    if (this.preGameId == null) return;
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/pregame/v1/matches/${this.preGameId}`;

    let options = {
      method: "GET",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    await fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        this.pregame = {
          map: json.MapID,
          team: json.AllyTeam.Players,
          queue: json.QueueID,
        };
        console.log("✅ ~ file: index.js:221 ~ getPreGameMatch ~ url:", url);
      })
      .catch((err) => console.error("error:" + err));
  }

  async getPartyPlayer() {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/parties/v1/players/${this.puuid}`;

    let options = {
      method: "GET",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        "X-Riot-ClientVersion": this.clientVersion,
        Authorization: "Bearer " + this.token,
      },
    };

    await fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ ~ file: index.js:195 ~ getPartyPlayer ~ url:", url);
        this.partyId = json.CurrentPartyID;
      })
      .catch((err) => console.error("error:" + err));
  }

  async getParty() {
    if (
      !this.partyId ||
      this.partyId == null ||
      this.partyId == undefined ||
      this.partyId == "undefined"
    ) {
      await this.getPartyPlayer();
      return;
    }
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/parties/v1/parties/${this.partyId}`;

    let options = {
      method: "GET",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    await fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        this.gameModes = json.EligibleQueues;
        this.party = json;
        console.log("✅ ~ file: index.js:225 ~ getParty ~ url:", url);
      })
      .catch((err) => console.error("error:" + err));
  }

  async leaveParty() {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/parties/v1/players/${this.puuid}`;

    let options = {
      method: "DELETE",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ ~ file: index.js:488 ~ getParty ~ url:", url);
      })
      .catch((err) => console.error("error:" + err));
  }

  async changeQueue(gamemode) {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/parties/v1/parties/${this.partyId}/queue`;

    let options = {
      method: "POST",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        "content-type": "application/json",
        Authorization: "Bearer " + this.token,
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

  async startQueue() {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/parties/v1/parties/${this.partyId}/matchmaking/join`;

    let options = {
      method: "POST",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ ~ file: index.js:255 ~ startQueue ~ url:", url);
      })
      .catch((err) => console.error("error:" + err));
  }

  async stopQueue() {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/parties/v1/parties/${this.partyId}/matchmaking/leave`;

    let options = {
      method: "POST",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ ~ file: index.js:255 ~ stopQueue ~ url:", url);
      })
      .catch((err) => console.error("error:" + err));
  }

  async partyAccessibility(access) {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/parties/v1/parties/${this.partyId}/accessibility`;

    let options = {
      method: "POST",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        "content-type": "application/json",
        Authorization: "Bearer " + this.token,
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

  async getCurrentMatch(globalSocket) {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/core-game/v1/players/${this.puuid}`;

    let options = {
      method: "GET",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        globalSocket?.emit("inGame", json.MatchID);
        this.currentMatch = json.MatchID;
      })
      .catch((err) => console.error("error:" + err));
  }

  async getPlayerContracts() {
    let url = `https://pd.${this.shard}.a.pvp.net/contracts/v1/contracts/${this.puuid}`;

    let options = {
      method: "GET",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        "X-Riot-ClientVersion": this.clientVersion,
        Authorization: "Bearer " + this.token,
      },
    };

    await fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        this.playerContracts = json;
        console.log("✅ ~ file: index.js:391 ~ getPlayerContracts ~ url:", url);
      })
      .catch((err) => console.error("error:" + err));
  }

  async selectAgent(agent) {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/pregame/v1/matches/${this.preGameId}/select/${agent}`;

    let options = {
      method: "POST",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ ~ file: index.js:379 ~ selectAgent ~ url:", url);
      })
      .catch((err) => console.error("error:" + err));
  }

  async lockAgent(agent) {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/pregame/v1/matches/${this.preGameId}/lock/${agent}`;

    let options = {
      method: "POST",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) =>
        console.log("✅ ~ file: index.js:387 ~ lockAgent ~ url:", url)
      )
      .catch((err) => console.error("error:" + err));
  }

  async dodge() {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/pregame/v1/matches/${this.preGameId}/quit`;

    let options = {
      method: "POST",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        Authorization: "Bearer " + this.token,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => console.log(json))
      .catch((err) => console.error("error:" + err));
  }

  async getFriends(globalSocket) {
    let url = `https://127.0.0.1:${this.lockData.port}/chat/v4/presences`;
    const username = "riot";

    let options = {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(
          username + ":" + this.lockData.password
        ).toString("base64")}`,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        const tempFirends = json.presences;
        this.friends = tempFirends
          .filter((friend) => friend.product === "valorant")
          .filter((friend) => friend.puuid !== this.puuid);
        globalSocket?.emit("friends", friends);
      })
      .catch((err) => console.error("error:" + err));
  }

  async inviteFriend(name, tag) {
    let url = `https://glz-${this.region}-1.${this.shard}.a.pvp.net/parties/v1/parties/${this.partyId}/invites/name/${name}/tag/${tag}`;

    let options = {
      method: "POST",
      headers: {
        "X-Riot-Entitlements-JWT": this.entitlement,
        "X-Riot-ClientVersion": this.clientVersion,
        Authorization: "Bearer " + this.token,
      },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ ~ file: index.js:709 ~ inviteFriend ~ url:", url);
      })
      .catch((err) => console.error("error:" + err));
  }
}

function getInstance() {
  return new UserData();
}

module.exports = getInstance;
