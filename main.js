const { app, BrowserWindow, shell, Menu, nativeTheme, session } = require("electron");
const path = require("path");

const APP_URL = "https://promtforge.tech";
const STRIPE_URL = "https://checkout.stripe.com";
const SUPABASE_URL = "https://qbrowclzsxgareynymas.supabase.co";

let mainWindow;

function createWindow() {
  nativeTheme.themeSource = "dark";

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 920,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#09090f",
    icon: path.join(__dirname, "build", process.platform === "win32" ? "icon.ico" : process.platform === "darwin" ? "icon.icns" : "icon.png"),
    title: "PromptForge AI",
    show: false,
    autoHideMenuBar: process.platform !== "darwin",
  });

  // Show when ready to avoid white flash
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.loadURL(APP_URL);

  // Open external links in system browser, but keep Stripe in app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL) || url.startsWith(STRIPE_URL)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Handle Stripe redirect back after payment
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith(STRIPE_URL) && !url.startsWith(SUPABASE_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ]}] : []),
    { label: "File", submenu: [
      { label: "New Project", accelerator: "CmdOrCtrl+N", click: () => mainWindow?.loadURL(APP_URL + "/new") },
      { type: "separator" },
      { label: "Dashboard", accelerator: "CmdOrCtrl+D", click: () => mainWindow?.loadURL(APP_URL) },
      { type: "separator" },
      isMac ? { role: "close" } : { role: "quit" },
    ]},
    { label: "Edit", submenu: [
      { role: "undo" }, { role: "redo" }, { type: "separator" },
      { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
    ]},
    { label: "View", submenu: [
      { role: "reload" }, { role: "forceReload" },
      { type: "separator" },
      { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ]},
    { label: "Window", submenu: [
      { role: "minimize" },
      ...(isMac ? [{ role: "zoom" }, { type: "separator" }, { role: "front" }] : [{ role: "close" }]),
    ]},
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
