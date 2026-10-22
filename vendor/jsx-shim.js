// Minimal stand-in for "react" and "react/jsx-runtime", just enough to render
// @port-labs/anchor-icons components to SVG markup strings without React.
const KEEP_CAMEL = new Set([
  "viewBox", "gradientUnits", "gradientTransform", "maskUnits", "maskContentUnits", "filterUnits",
  "primitiveUnits", "patternUnits", "patternContentUnits", "patternTransform", "clipPathUnits",
  "stdDeviation", "preserveAspectRatio", "spreadMethod", "baseFrequency", "numOctaves",
]);
const RENAME = { className: "class", xlinkHref: "xlink:href", xmlnsXlink: "xmlns:xlink", xmlSpace: "xml:space" };

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

function attrName(name) {
  if (RENAME[name]) {
    return RENAME[name];
  }
  return KEEP_CAMEL.has(name) ? name : kebab(name);
}

function renderChildren(children) {
  if (children == null || children === false) {
    return "";
  }
  if (Array.isArray(children)) {
    return children.map(renderChildren).join("");
  }
  return typeof children === "string" ? esc(children) : String(children);
}

export function jsx(type, props) {
  const { children, ref, ...rest } = props || {};
  const attrs = Object.entries(rest)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => {
      if (k === "style" && typeof v === "object") {
        v = Object.entries(v).map(([sk, sv]) => `${kebab(sk)}:${sv}`).join(";");
      }
      return ` ${attrName(k)}="${esc(v)}"`;
    })
    .join("");
  return new String(`<${type}${attrs}>${renderChildren(children)}</${type}>`);
}

export const jsxs = jsx;

export function forwardRef(render) {
  return (props) => render(props || {}, null);
}
