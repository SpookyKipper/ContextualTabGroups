// Groups tab: group-first rules editor. Built with createElement/textContent only;
// stored values are never parsed as HTML.
import { RULE_COLORS, isColor, listAll, saveGroup, deleteGroup, putDomain, deleteDomain } from "./db.js";

const t = (key, subs) => chrome.i18n.getMessage(key, subs);
// Swatch colors approximating the browser's dark-theme tab group colors
const SWATCH = { grey: "#dadce0", blue: "#8ab4f8", red: "#f28b82", yellow: "#fdd663", green: "#81c995", pink: "#ff8bcb", purple: "#d7aefb", cyan: "#78d9ec", orange: "#fcad70" };
const HOSTNAME_REGEX = /^[a-z0-9.\-]{1,100}$/;

let data = { groups: [], domains: [] };
let editing = null; // name of the group whose header is in edit mode
let flashName = null; // group to highlight after the next render

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const swatch = (color) => {
  const s = el("span", { className: isColor(color) ? "swatch" : "swatch none" });
  if (isColor(color)) s.style.setProperty("--swatch", SWATCH[color]);
  return s;
};

const colorSelect = (value, firstLabel) =>
  el(
    "select",
    {},
    el("option", { value: "", textContent: firstLabel }),
    ...RULE_COLORS.map((c) => el("option", { value: c, textContent: t(`color_${c}`), selected: c === value })),
  );

const iconButton = (icon, label, onClick) => {
  const b = el("button", { type: "button", className: "icon-btn", title: label, ariaLabel: label, onclick: onClick });
  b.append(el("img", { src: icon, alt: "" }));
  return b;
};

// Accepts "github.com", "GitHub.com" or a pasted URL like "https://github.com/x"
const normalizeHost = (value) => {
  let v = value.trim().toLowerCase();
  if (v.includes("://")) {
    try {
      v = new URL(v).hostname;
    } catch {
      return null;
    }
  }
  // Needs at least one dot: a bare "com" would match every .com site via suffix matching
  return HOSTNAME_REGEX.test(v) && v.includes(".") && !v.startsWith(".") && !v.endsWith(".") ? v : null;
};

const groupExists = (name) => data.groups.some((g) => g.groupname === name);

async function reload() {
  data = await listAll();
  render();
}

// Name + color form, used for new groups and for editing an existing one
function groupForm(initial, onSave, onCancel) {
  const name = el("input", { type: "text", value: initial.groupname, placeholder: t("groupNamePh"), ariaLabel: t("groupNamePh"), maxLength: 100 });
  const color = colorSelect(initial.color, t("colorNoneShort"));
  color.ariaLabel = t("colorLabel");
  const form = el(
    "form",
    { className: "group-form" },
    name,
    color,
    el("button", { type: "submit", textContent: t("save") }),
    el("button", { type: "button", className: "btn-ghost", textContent: t("cancel"), onclick: onCancel }),
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const groupname = name.value.trim();
    if (!groupname) return alert(t("errNameRequired"));
    if (groupname !== initial.groupname && groupExists(groupname)) return alert(t("errGroupExists", groupname));
    if (color.value && !isColor(color.value)) return alert(t("errInvalidColor"));
    onSave({ groupname, color: color.value });
  });
  setTimeout(() => name.focus());
  return form;
}

function domainRow(d) {
  const override = colorSelect(isColor(d.color) ? d.color : "", t("useGroupColor"));
  override.title = t("overrideHint");
  override.ariaLabel = `${d.hostname}: ${t("overrideHint")}`;
  override.addEventListener("change", async () => {
    const record = { hostname: d.hostname, groupname: d.groupname };
    if (override.value) record.color = override.value;
    await putDomain(record);
    await reload();
  });
  const overrideBox = el("div", { className: "domain-override" });
  if (isColor(d.color)) overrideBox.append(swatch(d.color));
  overrideBox.append(override);
  return el(
    "li",
    { className: "domain" },
    el("span", { className: "domain-host", textContent: d.hostname }),
    overrideBox,
    iconButton("trash.svg", t("deleteDomain", d.hostname), async () => {
      await deleteDomain(d.hostname);
      await reload();
    }),
  );
}

function addDomainForm(groupname) {
  const input = el("input", { type: "text", placeholder: t("domainPh"), ariaLabel: t("domainPh") });
  const form = el("form", { className: "add-domain" }, input, el("button", { type: "submit", textContent: t("add") }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hostname = normalizeHost(input.value);
    if (!hostname) return alert(t("errInvalidHostname"));
    const existing = data.domains.find((d) => d.hostname === hostname);
    if (existing && existing.groupname === groupname) return;
    if (existing && !confirm(t("confirmMoveDomain", [hostname, existing.groupname]))) return;
    await putDomain({ hostname, groupname });
    flashName = groupname;
    await reload();
    document.querySelector(`[data-group="${CSS.escape(groupname)}"] .add-domain input`)?.focus();
  });
  return form;
}

function groupCard(group, domains) {
  const card = el("section", { className: "group" });
  card.dataset.group = group.groupname;
  if (isColor(group.color)) card.style.setProperty("--swatch", SWATCH[group.color]);
  if (flashName === group.groupname) card.classList.add("flash");

  const head = el("div", { className: "group-head" });
  if (editing === group.groupname) {
    head.append(
      groupForm(
        group,
        async (next) => {
          await saveGroup(group.groupname, next);
          editing = null;
          flashName = next.groupname;
          await reload();
        },
        () => {
          editing = null;
          render();
        },
      ),
    );
  } else {
    head.append(
      swatch(group.color),
      el("span", { className: "group-name", textContent: group.groupname || "—" }),
      el("span", { className: "group-color", textContent: isColor(group.color) ? t(`color_${group.color}`) : t("colorNoneShort") }),
      el(
        "div",
        { className: "group-actions" },
        el("button", {
          type: "button",
          className: "btn-ghost",
          textContent: t("edit"),
          onclick: () => {
            editing = group.groupname;
            render();
          },
        }),
        iconButton("trash.svg", t("deleteGroup"), async () => {
          if (!confirm(t("confirmDeleteGroup", [group.groupname, String(domains.length)]))) return;
          await deleteGroup(group.groupname);
          await reload();
        }),
      ),
    );
  }

  const list = el("ul", { className: "domains" });
  if (domains.length) list.append(...domains.map(domainRow));
  else list.append(el("li", { className: "domain-empty", textContent: t("emptyDomains") }));

  card.append(head, list, addDomainForm(group.groupname));
  return card;
}

function render() {
  // Domains whose group record is missing still show up, as a colorless group
  const names = new Set([...data.groups.map((g) => g.groupname), ...data.domains.map((d) => d.groupname)]);
  const groups = [...names]
    .map((name) => data.groups.find((g) => g.groupname === name) || { groupname: name, color: "" })
    .sort((a, b) => a.groupname.localeCompare(b.groupname));

  const list = document.getElementById("group-list");
  if (!groups.length) {
    list.replaceChildren(el("p", { className: "empty", textContent: t("emptyGroups") }));
  } else {
    list.replaceChildren(
      ...groups.map((g) =>
        groupCard(
          g,
          data.domains.filter((d) => d.groupname === g.groupname).sort((a, b) => a.hostname.localeCompare(b.hostname)),
        ),
      ),
    );
  }
  flashName = null;
}

document.getElementById("new-group").addEventListener("click", () => {
  const slot = document.getElementById("new-group-slot");
  const close = () => slot.replaceChildren();
  slot.replaceChildren(
    el(
      "section",
      { className: "group is-new" },
      groupForm(
        { groupname: "", color: "blue" },
        async (group) => {
          await saveGroup(null, group);
          close();
          flashName = group.groupname;
          await reload();
        },
        close,
      ),
    ),
  );
});

reload();
