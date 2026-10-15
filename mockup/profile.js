(() => {
  const key = "marmullaku-profile-mockup-v1",
    $ = (id) => document.getElementById(id);
  const sections = [
    ["contact", "Contact"],
    ["skills", "Skills"],
    ["languages", "Languages"],
    ["profile", "Profile"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["certificates", "Certificates"],
    ["interests", "Interests"],
  ];
  const initial = {
    name: "Osman Marmullaku",
    role: "Your professional title",
    contact: "Email address\nPortfolio website",
    skills: "Interface design\nWeb development\nCreative technology",
    languages: "Add your languages",
    profile:
      "Introduce yourself in a few sentences. What do you enjoy building, what are you good at, and what would you like to do next?",
    experience:
      "Your latest role or project\nCompany or organisation · Dates\n\nDescribe what you built, your contribution, and the difference it made. Keep it specific and in your own words.",
    education: "Qualification or programme\nInstitution · Dates",
    certificates: "Add a relevant certification",
    interests: "What keeps you curious outside work?",
  };
  let data = { ...initial },
    activeEditor = null,
    previewing = false;
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && typeof stored === "object")
      for (const field of Object.keys(initial))
        if (typeof stored[field] === "string") data[field] = stored[field];
  } catch {}
  const pencil = '<svg aria-hidden="true"><use href="#pencil"/></svg>';
  function node(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function sync(field) {
    document
      .querySelectorAll(`[data-value="${field}"]`)
      .forEach((el) => (el.textContent = data[field]));
  }
  function save() {
    let message = "Saved in this browser";
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      message = "Updated for this preview · browser storage unavailable";
    }
    $("save-status").textContent = message;
    $("resume-status").textContent = message;
  }
  const sidebar = node("div", undefined, "resume-column"),
    mainColumn = node("div", undefined, "resume-column");
  $("resume-sections").append(sidebar, mainColumn);
  for (const [field, label] of sections) {
    const block = node("section", undefined, "resume-section");
    block.dataset.section = field;
    block.dataset.field = field;
    const heading = node("div", undefined, "section-heading");
    heading.append(node("h3", label));
    const edit = node("button", undefined, "edit");
    edit.dataset.edit = field;
    edit.setAttribute("aria-label", `Edit ${label.toLowerCase()}`);
    edit.innerHTML = pencil;
    heading.append(edit);
    const value = node("p", undefined, "section-copy");
    value.dataset.value = field;
    block.append(heading, value);
    (["contact", "skills", "languages", "interests"].includes(field)
      ? sidebar
      : mainColumn
    ).append(block);
  }
  Object.keys(initial).forEach(sync);
  function finish(keep) {
    if (!activeEditor) return;
    const { field, old, host, value, button, editor } = activeEditor;
    if (!keep) {
      data[field] = old;
      sync(field);
    } else save();
    editor.remove();
    value.hidden = false;
    button.hidden = false;
    host.classList.remove("editing");
    activeEditor = null;
    button.focus();
  }
  function start(button) {
    if (previewing) return;
    finish(true);
    const field = button.dataset.edit,
      host = button.closest("[data-field]"),
      value = host.querySelector(`[data-value="${field}"]`),
      old = data[field],
      editor = node("div", undefined, "inline-editor"),
      input = document.createElement(
        ["name", "role"].includes(field) ? "input" : "textarea",
      );
    input.value = old;
    input.maxLength = ["name", "role"].includes(field) ? 120 : 5000;
    input.setAttribute("aria-label", `Edit ${field}`);
    const actions = node("div", undefined, "inline-actions"),
      done = node("button", "Save"),
      cancel = node("button", "Cancel");
    done.type = cancel.type = "button";
    actions.append(done, cancel);
    editor.append(input, actions);
    value.hidden = true;
    button.hidden = true;
    if (host.classList.contains("resume-section")) host.append(editor);
    else host.prepend(editor);
    host.classList.add("editing");
    activeEditor = { field, old, host, value, button, editor };
    input.addEventListener("input", () => {
      data[field] = input.value;
      sync(field);
      $("save-status").textContent = "Editing…";
      $("resume-status").textContent = "Editing…";
    });
    done.addEventListener("click", () => finish(true));
    cancel.addEventListener("click", () => {
      finish(false);
      $("save-status").textContent = "Changes cancelled";
      $("resume-status").textContent = "Changes cancelled";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      } else if (
        e.key === "Enter" &&
        (input.tagName === "INPUT" || e.ctrlKey || e.metaKey)
      ) {
        e.preventDefault();
        finish(true);
      }
    });
    input.focus();
    input.select();
  }
  document.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    if (edit) start(edit);
  });
  function openResume(allowed = null, company = "") {
    finish(true);
    previewing = !!allowed;
    $("resume").classList.toggle("preview-view", previewing);
    $("resume-mode").textContent = previewing
      ? `${company || "Company"}’s view`
      : "Your résumé";
    $("resume-status").textContent = previewing
      ? "Only selected sections are shown"
      : "Edit a section with its pencil";
    $("exit-preview").hidden = !previewing;
    document
      .querySelectorAll("[data-section]")
      .forEach(
        (el) =>
          (el.hidden = !!allowed && !allowed.includes(el.dataset.section)),
      );
    if (!$("resume").open) $("resume").showModal();
  }
  $("resume-open").addEventListener("click", () => openResume());
  $("exit-preview").addEventListener("click", () => openResume());
  $("settings-open").addEventListener("click", () => {
    finish(true);
    $("settings-panel").showModal();
  });
  document.querySelectorAll("[data-close]").forEach((button) =>
    button.addEventListener("click", () => {
      finish(true);
      $(button.dataset.close).close();
    }),
  );
  for (const id of ["resume", "settings-panel"]) {
    $(id).addEventListener("click", (e) => {
      if (e.target === $(id)) {
        finish(true);
        $(id).close();
      }
    });
    $(id).addEventListener("cancel", () => finish(true));
  }
  const defaults = [
    "profile",
    "experience",
    "education",
    "skills",
    "languages",
    "certificates",
  ];
  function permissions(host, selected, prefix) {
    for (const [field, title] of sections) {
      const label = node("label", title),
        check = document.createElement("input");
      check.type = "checkbox";
      check.value = field;
      check.checked = selected.includes(field);
      check.setAttribute("aria-label", `${prefix}: ${title}`);
      label.append(check);
      host.append(label);
    }
  }
  permissions($("company-sections"), defaults, "Company access");
  $("standard").addEventListener("click", () => {
    $("company-sections")
      .querySelectorAll("input")
      .forEach((input) => (input.checked = defaults.includes(input.value)));
  });
  const selected = () =>
    [...$("company-sections").querySelectorAll("input:checked")].map(
      (el) => el.value,
    );
  $("preview-company").addEventListener("click", () => {
    $("settings-panel").close();
    openResume(selected(), $("company-name").value.trim());
  });
  $("create-link").addEventListener("click", () => {
    const company = $("company-name").value.trim();
    if (!company) {
      $("company-name").focus();
      $("settings-status").textContent = "Enter a company name first.";
      return;
    }
    const row = node("div", undefined, "link-row"),
      info = node("div");
    info.append(
      node("strong", company),
      node("small", `${selected().length} sections · ${$("expiry").value}`),
    );
    const revoke = node("button", "Revoke", "text-button");
    revoke.addEventListener("click", () => {
      row.remove();
      $("settings-status").textContent = `Demo access for ${company} revoked.`;
    });
    row.append(info, revoke);
    $("company-links").prepend(row);
    $("settings-status").textContent =
      "Demo link created. No real link or access has been issued.";
  });
  for (const name of ["Diellza", "Drilona", "Drenusha", "Dredhza", "Ali"]) {
    const row = node("div", undefined, "sibling-access"),
      line = node("div"),
      select = document.createElement("select");
    select.setAttribute("aria-label", `${name}’s access`);
    for (const choice of ["No access", "Can view", "Can edit"]) {
      const option = node("option", choice);
      select.append(option);
    }
    line.append(node("span", name + " Marmullaku"), select);
    const details = node("details");
    details.hidden = true;
    details.append(node("summary", "Choose sections"));
    const list = node("div", undefined, "permission-list");
    permissions(list, defaults, `${name} access`);
    details.append(list);
    select.addEventListener("change", () => {
      details.hidden = select.selectedIndex === 0;
      $("settings-status").textContent =
        `${name}: ${select.value.toLowerCase()} · mockup only`;
    });
    row.append(line, details);
    $("sibling-permissions").append(row);
  }
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
    $(tab).addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        $(other).click();
        $(other).focus();
      }
    });
  }
  $("reset").addEventListener("click", () => {
    finish(false);
    data = { ...initial };
    Object.keys(initial).forEach(sync);
    save();
    $("save-status").textContent = "Sample content reset";
  });
})();
