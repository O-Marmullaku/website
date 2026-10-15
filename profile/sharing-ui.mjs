import {
  findCompanies,
  companySections,
  visibleProfiles,
  summarizeActivity,
} from "./sharing-model.mjs?v=accounts-2";

const storageKey = "marmullaku-sharing-mockup-v1";
const siblings = ["Diellza", "Drilona", "Drenusha", "Dredhza", "Ali"];
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
const $ = (id) => document.getElementById(id);
const stamp = (at) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(at));

export function createSharingUI({ name, onOpenCV, beforePreview }) {
  let state = { companies: [], links: [], family: [] },
    chosen = null,
    suggestions = [],
    active = -1,
    current = null,
    preview = false;
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || typeof saved !== "object") return;
      state.companies = Array.isArray(saved.companies)
        ? saved.companies
            .filter((c) => typeof c?.name === "string")
            .slice(0, 100)
            .map((c) => ({
              name: c.name.slice(0, 120),
              domain:
                typeof c.domain === "string" ? c.domain.slice(0, 120) : "",
            }))
        : [];
      state.family = Array.isArray(saved.family)
        ? saved.family.filter((member) => siblings.includes(member))
        : [];
      state.links = Array.isArray(saved.links)
        ? saved.links
            .filter(
              (link) =>
                /^[a-f0-9-]{36}$/i.test(link?.id || "") &&
                typeof link.company === "string" &&
                Number.isFinite(Date.parse(link.created)),
            )
            .slice(0, 100)
            .map((link) => ({
              id: link.id,
              company: link.company.slice(0, 120),
              created: link.created,
              disabled: !!link.disabled,
              events: Array.isArray(link.events)
                ? link.events
                    .filter(
                      (event) =>
                        [
                          "visit",
                          "cv",
                          "document",
                          "picture",
                          "link",
                          "button",
                        ].includes(event?.type) &&
                        Number.isFinite(Date.parse(event.at)),
                    )
                    .slice(-1000)
                    .map((event) => ({
                      type: event.type,
                      at: event.at,
                      label:
                        typeof event.label === "string"
                          ? event.label.slice(0, 220)
                          : "",
                    }))
                : [],
            }))
        : [];
    } catch {}
  }
  function save(message) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      if (message) $("settings-status").textContent = message;
    } catch {
      $("settings-status").textContent =
        "Browser storage is full. This change could not be saved.";
    }
  }
  read();
  const profile = { id: "osman", name, shareWith: state.family };
  // shortcut: this mockup has one editable account; load other owners' grants and CVs from the server during account integration.
  const profiles = [profile];
  const included = () => visibleProfiles(profiles, profile.id);
  const input = $("company-name"),
    list = $("company-suggestions");
  function closeSuggestions() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  function choose(company) {
    chosen = company;
    input.value = company.name;
    closeSuggestions();
  }
  function renderSuggestions() {
    const query = input.value.trim();
    suggestions = findCompanies(query, state.companies);
    if (
      query &&
      !suggestions.some(
        (company) => company.name.toLowerCase() === query.toLowerCase(),
      )
    )
      suggestions.push({ name: query, domain: "", custom: true });
    list.replaceChildren();
    active = -1;
    for (const [index, company] of suggestions.entries()) {
      const option = node("div", undefined, "company-option");
      option.id = `company-option-${index}`;
      option.role = "option";
      option.setAttribute("aria-selected", "false");
      option.append(
        node("strong", company.custom ? `Add “${company.name}”` : company.name),
      );
      if (company.domain) option.append(node("small", company.domain));
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => choose(company));
      list.append(option);
    }
    list.hidden = !suggestions.length;
    input.setAttribute("aria-expanded", String(!!suggestions.length));
  }
  input.addEventListener("input", () => {
    chosen = null;
    renderSuggestions();
  });
  input.addEventListener("focus", renderSuggestions);
  input.addEventListener("blur", closeSuggestions);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeSuggestions();
    } else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (list.hidden) renderSuggestions();
      if (!suggestions.length) return;
      active =
        (active + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) %
        suggestions.length;
      [...list.children].forEach((option, index) =>
        option.setAttribute("aria-selected", String(index === active)),
      );
      input.setAttribute("aria-activedescendant", `company-option-${active}`);
    } else if (event.key === "Enter" && !list.hidden && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    }
  });
  for (const sibling of siblings) {
    const label = node("label", undefined, "family-share");
    const check = node("input");
    check.type = "checkbox";
    check.checked = state.family.includes(sibling);
    check.setAttribute("aria-label", `Let ${sibling} view and share my CV`);
    label.append(node("span", `${sibling} Marmullaku`), check);
    check.addEventListener("change", () => {
      state.family = state.family.filter((member) => member !== sibling);
      if (check.checked) state.family.push(sibling);
      profile.shareWith = state.family;
      save(
        `${sibling} ${check.checked ? "can now view and share your CV" : "can no longer view or share your CV"} in this preview.`,
      );
    });
    $("sibling-permissions").append(label);
  }
  function url(link) {
    const result = new URL(location.pathname, location.origin);
    result.searchParams.set("company-link", link.id);
    return result.href;
  }
  function renderLinks() {
    const host = $("company-links");
    const expanded = new Set(
      [...host.querySelectorAll(".link-activity[open]")].map(
        (el) => el.closest(".shared-link").dataset.linkId,
      ),
    );
    host.replaceChildren();
    if (!state.links.length) {
      host.append(node("p", "No links yet.", "links-empty"));
      return;
    }
    for (const link of state.links) {
      const item = node("article", undefined, "shared-link");
      item.dataset.linkId = link.id;
      const head = node("div", undefined, "shared-link-heading");
      head.append(
        node("h4", link.company),
        node("span", link.disabled ? "Off" : "Active", "link-state"),
      );
      const summary = summarizeActivity(link.events);
      item.append(
        head,
        node("p", `Created ${stamp(link.created)}`, "link-meta"),
        node(
          "p",
          summary.opens
            ? `${summary.opens} ${summary.opens === 1 ? "open" : "opens"} · Last opened ${stamp(summary.lastOpened)}`
            : "Not opened yet",
          "link-counts",
        ),
      );
      const actions = node("div", undefined, "link-actions");
      const copy = node("button", "Copy link", "text-button");
      copy.disabled = link.disabled;
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(url(link));
          $("settings-status").textContent =
            "Link copied. It works in this browser for now.";
        } catch {
          $("settings-status").textContent =
            "Could not copy the link. Use Open link and copy its address.";
        }
      });
      const open = node("a", "Open link", "text-button");
      open.href = url(link);
      open.target = "_blank";
      open.rel = "noopener";
      const toggle = node(
        "button",
        link.disabled ? "Turn on" : "Turn off",
        "text-button",
      );
      toggle.addEventListener("click", () => {
        link.disabled = !link.disabled;
        save(`Link ${link.disabled ? "turned off" : "turned on"}.`);
        renderLinks();
      });
      actions.append(copy, open, toggle);
      item.append(actions);
      const activity = node("details", undefined, "link-activity");
      activity.open = expanded.has(link.id);
      activity.append(
        node(
          "summary",
          `Activity${summary.clicks ? ` · ${summary.clicks} clicks` : ""}`,
        ),
      );
      const events = node("ol");
      for (const event of [...link.events].reverse()) {
        const row = node("li");
        row.append(node("span", event.label || "Opened link"));
        const time = node("time", stamp(event.at));
        time.dateTime = event.at;
        row.append(time);
        events.append(row);
      }
      activity.append(events);
      if (!link.events.length) activity.append(node("p", "No activity yet."));
      item.append(activity);
      host.append(item);
    }
  }
  renderLinks();
  $("create-link").addEventListener("click", () => {
    const company = chosen || { name: input.value.trim(), domain: "" };
    if (!company.name) {
      input.focus();
      $("settings-status").textContent = "Enter a company name.";
      return;
    }
    const match = state.links.find(
      (link) =>
        link.company.toLowerCase() === company.name.toLowerCase() &&
        !link.disabled,
    );
    if (match) {
      $("settings-status").textContent =
        "This company already has an active link. You can copy it below.";
      return;
    }
    state.companies = [
      { name: company.name, domain: company.domain },
      ...state.companies.filter(
        (item) => item.name.toLowerCase() !== company.name.toLowerCase(),
      ),
    ];
    state.links.unshift({
      id: crypto.randomUUID(),
      company: company.name,
      created: new Date().toISOString(),
      disabled: false,
      events: [],
    });
    closeSuggestions();
    save("Link created. Copy it below. This preview works in this browser.");
    renderLinks();
  });
  function track(type, label) {
    if (!current || preview) return;
    read();
    const link = state.links.find((link) => link.id === current.id);
    if (!link || link.disabled) return;
    link.events.push({ type, label, at: new Date().toISOString() });
    link.events = link.events.slice(-1000);
    save();
  }
  function showCompany(link, isPreview = false) {
    beforePreview();
    current = link;
    preview = isPreview;
    $("settings-panel").close();
    $("family-home").hidden = true;
    $("company-view").hidden = false;
    $("company-preview-bar").hidden = !preview;
    document.body.classList.add("company-guest");
    $("company-profiles").replaceChildren();
    if (!link || link.disabled) {
      $("company-welcome").textContent = "Link unavailable";
      $("company-message").textContent =
        "Ask the person who sent it for a new link.";
      return;
    }
    $("company-welcome").textContent = link.company
      ? `Welcome, ${link.company}`
      : "Welcome";
    $("company-message").textContent = "Choose a CV.";
    for (const person of included()) {
      const card = node("article", undefined, "profile-card");
      const portrait = node("div", undefined, "portrait");
      const photo = node("img");
      photo.src = "../main/pictures/portraits/osman.webp";
      photo.alt = "";
      portrait.append(photo);
      const content = node("div", undefined, "card-content");
      content.append(node("h2", person.name));
      const button = node("button", "View CV", "resume-button");
      button.addEventListener("click", () => {
        if (!preview) {
          read();
          const fresh = state.links.find((saved) => saved.id === link.id);
          if (!fresh || fresh.disabled) {
            showCompany(fresh);
            return;
          }
        }
        track("cv", `Opened ${person.name}’s CV`);
        onOpenCV(companySections, link.company);
      });
      content.append(button);
      card.append(portrait, content);
      $("company-profiles").append(card);
    }
    track("visit", "Opened link");
  }
  $("preview-company").addEventListener("click", () =>
    showCompany({ company: input.value.trim() }, true),
  );
  $("back-to-settings").addEventListener("click", () => {
    current = null;
    preview = false;
    document.body.classList.remove("company-guest");
    $("company-view").hidden = true;
    $("family-home").hidden = false;
    $("settings-panel").showModal();
    renderLinks();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey) return;
    read();
    renderLinks();
    if (current && !preview) {
      const link = state.links.find((link) => link.id === current.id);
      if (!link || link.disabled) {
        document.getElementById("resume").close();
        showCompany(link);
      } else if ($("resume").open) {
        onOpenCV(companySections, link.company);
      }
    }
  });
  for (const [tab, panel, other, otherPanel] of [
    ["companies-tab", "companies", "family-tab", "family-panel"],
    ["family-tab", "family-panel", "companies-tab", "companies"],
  ]) {
    $(tab).addEventListener("click", () => {
      $(tab).setAttribute("aria-selected", "true");
      $(other).setAttribute("aria-selected", "false");
      $(panel).hidden = false;
      $(otherPanel).hidden = true;
    });
    $(tab).addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        $(other).click();
        $(other).focus();
      }
    });
  }
  const requested = new URL(location.href).searchParams.get("company-link");
  if (requested) showCompany(state.links.find((link) => link.id === requested));
  return {
    get isGuest() {
      return !!current || !!requested;
    },
    track,
    refresh() {
      read();
      renderLinks();
    },
  };
}
