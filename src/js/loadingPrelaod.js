const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  const updateOnlineStatus = () => {
    if (navigator.onLine) {
      ipcRenderer.send("online", "online");
    } else {
      replaceText("load-message", "No connection, retrying...");
      ipcRenderer.send("offline", "offline");
    }
  };

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  setTimeout(() => {
    updateOnlineStatus();
  }, 2000);
});
