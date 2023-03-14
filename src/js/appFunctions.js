const { ipcRenderer } = require("electron");

const closeBtn = document.getElementById("closeBtn");
closeBtn.addEventListener("click", () => {
  ipcRenderer.send("closeApp");
});

const minimizeBtn = document.getElementById("minimizeBtn");
minimizeBtn.addEventListener("click", () => {
  ipcRenderer.send("minimizeApp");
});

let url = "https://valorant-api.com/v1/agents";
let options = { method: "GET" };

(async () => {
  await fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      const img = document.getElementById("agent-img");
      const newImg = document.createElement("img");
      newImg.src = json.data[0].fullPortrait;
      newImg.alt = json.data[0].displayName;
      img?.replaceWith(newImg);
    })
    .catch((err) => console.error("error:" + err));
})();
