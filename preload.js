const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  ipcRenderer.send("getCode", "Give the code");

  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  ipcRenderer.on("code", (event, arg) => {
    replaceText("client-code", arg);
  });

  ipcRenderer.on("message", (event, arg) => {
    replaceText("message", arg);
  });

  ipcRenderer.on("loadOffline", (event, arg) => {
    replaceText("load-message", arg);
  });
});

const updateOnlineStatus = () => {
  if (navigator.onLine) {
    ipcRenderer.send("online", "online");
  } else {
    ipcRenderer.send("offline", "offline");
  }
};

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

updateOnlineStatus();
