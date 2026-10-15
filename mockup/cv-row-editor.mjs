import { rowLayouts, moveRow } from "./cv-rows.mjs";

export function createRowEditor({
  rows,
  onChange,
  beforeEdit,
  attachPDF,
  isReadOnly,
}) {
  let active, undo, logoTarget;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const undoButton = document.getElementById("undo-row");
  const logoInput = document.getElementById("row-logo");
  const status = document.getElementById("resume-status");
  document.addEventListener("pointerdown", (event) => {
    document.querySelectorAll(".cv-row-options[open]").forEach((menu) => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
  const sections = Object.fromEntries(
    Object.keys(rowLayouts).map((field) => [
      field,
      document.querySelector(`[data-section="${field}"]`),
    ]),
  );
  const commit = () => onChange(rows);
  function checkpoint() {
    finish(true);
    undo = structuredClone(rows);
    undoButton.hidden = false;
  }
  function finish(keep = true) {
    if (!active) return;
    const editor = active;
    active = null;
    editor.controller.abort();
    if (!keep) {
      editor.row[editor.key] = editor.old;
      editor.value.textContent = editor.old;
    }
    editor.value.contentEditable = "false";
    editor.value.removeAttribute("role");
    editor.value.removeAttribute("aria-label");
    editor.value.removeAttribute("aria-multiline");
    editor.host.classList.remove("editing");
    editor.button.removeAttribute("aria-pressed");
    commit();
  }
  function edit(value, button, row, key) {
    if (isReadOnly()) return;
    beforeEdit();
    finish(true);
    const controller = new AbortController(),
      options = { signal: controller.signal };
    const host = value.parentElement;
    active = { value, button, row, key, host, controller, old: row[key] };
    value.contentEditable = "plaintext-only";
    value.setAttribute("role", "textbox");
    value.setAttribute("aria-label", button.getAttribute("aria-label"));
    value.setAttribute("aria-multiline", String(key === "body"));
    host.classList.add("editing");
    button.setAttribute("aria-pressed", "true");
    value.addEventListener(
      "input",
      () => {
        row[key] = value.innerText.replace(/\r/g, "").slice(0, 5000);
        commit();
      },
      options,
    );
    value.addEventListener("blur", () => finish(true), options);
    value.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" ||
          (event.key === "Enter" &&
            (key !== "body" || event.ctrlKey || event.metaKey))
        ) {
          event.preventDefault();
          event.stopPropagation();
          finish(event.key !== "Escape");
          button.focus({ preventScroll: true });
        }
      },
      options,
    );
    value.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(value);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }
  function field(host, row, key, label, placeholder = "") {
    const wrapper = node("div", "cv-cell cv-cell-" + key);
    const value = node(key === "title" ? "p" : "div", "cv-row-text", row[key]);
    value.dataset.rowText = key;
    value.dataset.placeholder = placeholder;
    const button = node("button", "edit cv-edit");
    button.setAttribute("aria-label", label);
    button.innerHTML = '<svg aria-hidden="true"><use href="#pencil"/></svg>';
    button.addEventListener("pointerdown", (event) => {
      if (active) event.preventDefault();
    });
    button.addEventListener("click", () => edit(value, button, row, key));
    wrapper.append(value, button);
    host.append(wrapper);
  }
  function action(menu, label, callback, disabled = false) {
    const button = node("button", "", label);
    button.disabled = disabled;
    button.addEventListener("click", () => {
      menu.parentElement.open = false;
      if (!isReadOnly()) callback();
    });
    menu.append(button);
  }
  function paint(fieldName) {
    const section = sections[fieldName],
      layout = rowLayouts[fieldName];
    section.querySelector(".section-copy")?.remove();
    let container = section.querySelector(".cv-rows");
    if (!container) {
      container = node("div", "cv-rows");
      section.append(container);
    }
    container.replaceChildren();
    for (const [index, row] of rows[fieldName].entries()) {
      const item = node("div", "cv-row cv-row-" + layout);
      item.dataset.rowId = row.id;
      const label = `${fieldName} row ${index + 1}`;
      if (layout === "timeline")
        field(item, row, "date", `Edit dates for ${label}`, "Dates");
      const content = node("div", "cv-row-content");
      field(
        content,
        row,
        "title",
        `Edit title for ${label}`,
        layout === "timeline" ? "Role or qualification" : "Add text",
      );
      if (layout === "timeline") {
        field(
          content,
          row,
          "detail",
          `Edit organisation for ${label}`,
          "Organisation",
        );
        if (row.body)
          field(content, row, "body", `Edit description for ${label}`);
      }
      if (layout === "language") {
        const level = node("select", "cv-language-level cv-owner");
        level.setAttribute("aria-label", `Language level for ${label}`);
        for (const [value, title] of [
          "No rating",
          "Beginner",
          "Elementary",
          "Intermediate",
          "Advanced",
          "Fluent / native",
        ].entries()) {
          const option = node("option", "", title);
          option.value = value;
          level.append(option);
        }
        level.value = row.level;
        const dots = node("span", "cv-language-dots");
        dots.setAttribute("aria-label", `${row.level} of 5`);
        for (let i = 1; i <= 5; i++)
          dots.append(node("i", i <= row.level ? "filled" : ""));
        dots.hidden = row.level === 0;
        level.addEventListener("change", () => {
          if (isReadOnly()) return;
          checkpoint();
          row.level = Number(level.value);
          paint(fieldName);
          commit();
        });
        content.append(dots, level);
      }
      item.append(content);
      if (row.logo) {
        const logo = node("img", "cv-row-logo");
        logo.src = row.logo;
        logo.alt = row.title ? `${row.title} logo` : "Organisation logo";
        item.append(logo);
      }
      const options = node("details", "cv-row-options cv-owner");
      const summary = node("summary", "");
      summary.setAttribute("aria-label", `Options for ${label}`);
      summary.innerHTML =
        '<svg aria-hidden="true"><use href="#more-icon"/></svg>';
      const menu = node("div", "cv-row-menu");
      action(
        menu,
        "Move up",
        () => {
          checkpoint();
          rows[fieldName] = moveRow(rows[fieldName], row.id, -1);
          paint(fieldName);
          commit();
        },
        index === 0,
      );
      action(
        menu,
        "Move down",
        () => {
          checkpoint();
          rows[fieldName] = moveRow(rows[fieldName], row.id, 1);
          paint(fieldName);
          commit();
        },
        index === rows[fieldName].length - 1,
      );
      if (layout === "timeline") {
        action(
          menu,
          "Add description",
          () => {
            checkpoint();
            row.body ||= "Describe your contribution";
            paint(fieldName);
            commit();
          },
          !!row.body,
        );
        action(menu, row.logo ? "Change logo" : "Add logo", () => {
          logoTarget = { fieldName, id: row.id };
          logoInput.click();
        });
        if (row.logo)
          action(menu, "Remove logo", () => {
            checkpoint();
            row.logo = "";
            paint(fieldName);
            commit();
          });
      }
      action(menu, "Attach PDF", () => attachPDF(fieldName, row.id));
      action(menu, "Duplicate row", () => {
        checkpoint();
        rows[fieldName].splice(index + 1, 0, {
          ...row,
          id: crypto.randomUUID(),
        });
        paint(fieldName);
        commit();
      });
      action(menu, "Remove row", () => {
        checkpoint();
        rows[fieldName].splice(index, 1);
        paint(fieldName);
        commit();
      });
      options.append(summary, menu);
      options.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && options.open) {
          event.preventDefault();
          event.stopPropagation();
          options.open = false;
          summary.focus({ preventScroll: true });
        }
      });
      item.append(options);
      container.append(item);
    }
    let add = section.querySelector(".cv-add-row");
    if (!add) {
      add = node(
        "button",
        "cv-add-row cv-owner",
        rowLayouts[fieldName] === "timeline" ? "Add row" : "Add item",
      );
      add.setAttribute(
        "aria-label",
        `Add ${rowLayouts[fieldName] === "timeline" ? "row" : "item"} to ${fieldName}`,
      );
      add.addEventListener("click", () => {
        if (isReadOnly()) return;
        beforeEdit();
        checkpoint();
        const row = {
          id: crypto.randomUUID(),
          date: "",
          title: "",
          detail: "",
          body: "",
          logo: "",
          level: 0,
        };
        rows[fieldName].push(row);
        paint(fieldName);
        commit();
        section
          .querySelector(`[data-row-id="${row.id}"] .cv-cell-title button`)
          .click();
      });
      section.append(add);
    }
    section.append(add);
  }
  undoButton.addEventListener("click", () => {
    if (!undo || isReadOnly()) return;
    beforeEdit();
    rows = undo;
    undo = null;
    undoButton.hidden = true;
    Object.keys(rowLayouts).forEach(paint);
    commit();
  });
  logoInput.addEventListener("change", async () => {
    const file = logoInput.files[0],
      target = logoTarget;
    logoInput.value = "";
    if (!file || !target || isReadOnly()) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      status.textContent = "Choose a PNG, JPEG or WebP logo smaller than 1 MB.";
      return;
    }
    try {
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const row = rows[target.fieldName].find((row) => row.id === target.id);
      if (!row || isReadOnly()) return;
      checkpoint();
      row.logo = url;
      paint(target.fieldName);
      commit();
    } catch {
      status.textContent = "Could not read this logo. Choose the file again.";
    }
  });
  Object.keys(rowLayouts).forEach(paint);
  return {
    finish,
    editFirst(fieldName) {
      sections[fieldName]?.querySelector(".cv-cell-title button")?.click();
    },
  };
}
