// Port's blueprint icons, hotlinked from the public @port-labs/anchor-icons npm package on jsDelivr.
// The package ships React components; the import map in index.html points "react" and
// "react/jsx-runtime" at vendor/jsx-shim.js, which renders them to SVG strings without React.
const ICONS_URL = "https://cdn.jsdelivr.net/npm/@port-labs/anchor-icons@0.0.2/dist/index.mjs";

let iconsModule = null;

async function loadIcons() {
  if (!iconsModule) {
    iconsModule = import(ICONS_URL).catch((e) => {
      log("Could not load Port icons from jsDelivr: " + e.message, "err");
      return {};
    });
  }
  return iconsModule;
}

// Returns an element with the named icon, or a letter badge when the icon is unknown.
async function iconEl(name, fallbackText) {
  const mod = await loadIcons();
  const span = document.createElement("span");
  span.className = "icon";
  const Icon = name && mod[name];
  if (name && /^(https?:|data:image\/)/.test(name)) {
    span.append(Object.assign(document.createElement("img"), { src: name, alt: "" }));
  } else if (typeof Icon === "function") {
    span.innerHTML = String(Icon({})); // markup comes from the icon package, not from API data
  } else {
    span.classList.add("icon-fallback");
    span.textContent = (fallbackText || name || "?").replace(/^_/, "").charAt(0).toUpperCase();
  }
  return span;
}
