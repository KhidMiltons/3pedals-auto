/* 3 Pedals Auto KE — Content Publishing (Journal, Our Projects) & Website Settings */
(() => {
  "use strict";

  const A = window.ThreePedalsAdmin;
  if (!A) return;
  const {
    $,
    esc,
    safeUrl,
    fmtDate,
    state,
    showNotice,
    toast,
    confirm,
    recordAdminAudit,
    markDirty,
    sb,
  } = A;

  const JOURNAL_DRAFT_KEY = "3pedals:journal-draft";
  let existingArticleMedia = [];
  let selectedArticleFiles = [];
  let articlePreviewObjectUrls = [];
  let existingProjectMedia = [];
  let selectedProjectFiles = [];

  function mediaItemsOf(row) {
    if (Array.isArray(row?.media_gallery) && row.media_gallery.length) {
      return row.media_gallery.filter((m) => m && m.url);
    }
    if (row?.media_url) {
      return [
        {
          url: row.media_url,
          path: row.media_path || null,
          mime: row.media_mime || null,
          type: String(row.media_mime || "").startsWith("video/") ? "video" : "image",
        },
      ];
    }
    return [];
  }

  async function uploadProjectFile(file) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const uid = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${state.adminUserId}/${uid}.${ext}`;
    const { error } = await sb.storage.from("projects").upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });
    if (error) throw error;
    const { data } = sb.storage.from("projects").getPublicUrl(path);
    return {
      url: data.publicUrl,
      path,
      mime: file.type || null,
      type: file.type && file.type.startsWith("video/") ? "video" : "image",
      name: file.name,
    };
  }

  async function removeStorageItems(items) {
    const paths = [...new Set((items || []).map((x) => x && x.path).filter(Boolean))];
    if (paths.length) {
      const { error } = await sb.storage.from("projects").remove(paths);
      if (error) console.warn("Storage cleanup note:", error.message);
    }
  }

  /* =========================================================
     1. JOURNAL PUBLISHING (2–15 Photos, Cover Picker, Local Draft & Preview)
     ========================================================= */
  function revokeArticlePreviewUrls() {
    articlePreviewObjectUrls.forEach((u) => URL.revokeObjectURL(u));
    articlePreviewObjectUrls = [];
  }

  function saveJournalDraftLocally() {
    const id = $("articleId")?.value || "";
    if (id) return; // Auto-save drafts for new articles
    try {
      const draft = {
        title: $("articleTitle")?.value || "",
        category: $("articleCategory")?.value || "",
        description: $("articleDescription")?.value || "",
        body: $("articleBody")?.value || "",
        published: !!$("articlePublished")?.checked,
        savedAt: Date.now(),
      };
      if (draft.title || draft.body || draft.description) {
        localStorage.setItem(JOURNAL_DRAFT_KEY, JSON.stringify(draft));
      }
    } catch (_) {}
  }

  function clearJournalDraft() {
    try {
      localStorage.removeItem(JOURNAL_DRAFT_KEY);
    } catch (_) {}
  }

  function getActiveArticlePreviewSources() {
    if (selectedArticleFiles.length) {
      revokeArticlePreviewUrls();
      return selectedArticleFiles.map((f) => {
        const u = URL.createObjectURL(f);
        articlePreviewObjectUrls.push(u);
        return { url: u, name: f.name };
      });
    }
    return existingArticleMedia.map((m) => ({ url: safeUrl(m.url), name: m.name || "" })).filter((m) => m.url);
  }

  function renderArticlePhotoChoices() {
    const grid = $("articlePhotoChoices");
    const help = $("articlePhotoHelp");
    const coverInput = $("articleCoverIndex");
    if (!grid || !coverInput) return;

    const sources = getActiveArticlePreviewSources();
    let coverIdx = Number(coverInput.value || 0);
    if (coverIdx >= sources.length || coverIdx < 0) {
      coverIdx = 0;
      coverInput.value = "0";
    }

    if (help) {
      help.textContent = selectedArticleFiles.length
        ? `${selectedArticleFiles.length} new photo(s) staged (uploading replaces existing photos). Select the cover.`
        : existingArticleMedia.length
        ? `${existingArticleMedia.length} current photo(s). Choose a cover or upload 2–15 new photos to replace.`
        : "Upload 2–15 photos (max 12 MB each). Select one as cover.";
    }

    if (!sources.length) {
      grid.innerHTML = "";
      return;
    }

    grid.innerHTML = sources
      .map(
        (m, idx) => `
      <div class="article-photo-choice">
        <img src="${esc(m.url)}" alt="Article photo ${idx + 1}" loading="lazy" decoding="async">
        <label>
          <input type="radio" name="articleCoverPick" value="${idx}" ${idx === coverIdx ? "checked" : ""}>
          <span>Cover #${idx + 1}</span>
        </label>
        ${
          !selectedArticleFiles.length
            ? `<button type="button" class="media-remove" data-art-remove="${idx}" aria-label="Remove photo ${
                idx + 1
              }">×</button>`
            : ""
        }
      </div>`
      )
      .join("");
  }

  function renderArticlePreview() {
    const panel = $("articlePreviewPanel");
    if (!panel) return;
    const title = $("articleTitle")?.value.trim() || "Untitled article";
    const desc = $("articleDescription")?.value.trim() || "";
    const body = $("articleBody")?.value || "";
    const sources = getActiveArticlePreviewSources();
    const coverIdx = Math.min(Number($("articleCoverIndex")?.value || 0), Math.max(0, sources.length - 1));
    const ordered = sources.length
      ? [sources[coverIdx], ...sources.filter((_, i) => i !== coverIdx)].filter(Boolean)
      : [];

    $("articlePreviewTitle").textContent = title;
    $("articlePreviewDescription").textContent = desc;
    const coverImg = $("articlePreviewCover");
    if (coverImg) {
      if (ordered[0]?.url) {
        coverImg.src = ordered[0].url;
        coverImg.hidden = false;
      } else {
        coverImg.hidden = true;
      }
    }

    const lines = body.split(/\r?\n/);
    const html = lines
      .map((rawLine) => {
        const line = rawLine.trim();
        if (!line) return "";
        if (line.startsWith("## ")) {
          return `<h3>${esc(line.slice(3).trim())}</h3>`;
        }
        const photoMatch = line.match(/^\[\[photo:(\d+)\]\]$/i);
        if (photoMatch) {
          const photoNum = Number(photoMatch[1]);
          const pic = ordered[photoNum - 1];
          return pic?.url
            ? `<img src="${esc(pic.url)}" alt="Article figure ${photoNum}" loading="lazy" decoding="async">`
            : `<p class="meta">[Photo placeholder #${photoNum}]</p>`;
        }
        return `<p>${esc(line)}</p>`;
      })
      .join("");

    $("articlePreviewBody").innerHTML = html || '<p class="meta">Start writing above to preview…</p>';
    panel.classList.remove("section-hidden");
  }

  function openArticleForm(article = null) {
    $("articleId").value = article?.id || "";
    $("articleTitle").value = article?.title || "";
    $("articleCategory").value = article?.category || "";
    $("articleDescription").value = article?.description || "";
    $("articleBody").value = article?.body || "";
    $("articlePublished").checked = article ? article.published === true : false;
    $("articleCoverIndex").value = "0";
    if ($("articlePhotos")) $("articlePhotos").value = "";
    selectedArticleFiles = [];
    existingArticleMedia = article ? mediaItemsOf(article).filter((m) => m.type !== "video") : [];
    $("articleError")?.classList.add("hidden");
    $("articlePreviewPanel")?.classList.add("section-hidden");

    if (!article) {
      try {
        const raw = localStorage.getItem(JOURNAL_DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && (d.title || d.body || d.description)) {
            $("articleTitle").value = d.title || "";
            $("articleCategory").value = d.category || "";
            $("articleDescription").value = d.description || "";
            $("articleBody").value = d.body || "";
            $("articlePublished").checked = !!d.published;
            toast("Restored your unsaved journal draft.", "info");
          }
        }
      } catch (_) {}
    }

    renderArticlePhotoChoices();
    $("articleForm")?.classList.remove("section-hidden");
    $("articleTitle")?.focus();
  }

  function closeArticleForm() {
    $("articleForm")?.classList.add("section-hidden");
    $("articlePreviewPanel")?.classList.add("section-hidden");
    $("articleForm")?.reset();
    if ($("articleId")) $("articleId").value = "";
    existingArticleMedia = [];
    selectedArticleFiles = [];
    revokeArticlePreviewUrls();
    markDirty("journal", false);
  }

  function renderJournalList() {
    const box = $("journalList");
    if (!box) return;
    if (!state.journalItems.length) {
      box.innerHTML = '<div class="empty">No journal articles created yet.</div>';
      return;
    }

    box.innerHTML = state.journalItems
      .map((a) => {
        const media = mediaItemsOf(a);
        const cover = safeUrl(media[0]?.url || a.media_url);
        return `
        <article class="article-item">
          <div style="display:flex;gap:14px;align-items:flex-start;min-width:0;flex:1">
            ${
              cover
                ? `<img src="${esc(cover)}" alt="" class="listing-thumb" loading="lazy" decoding="async">`
                : `<div class="listing-thumb" style="display:grid;place-items:center;font-size:11px;color:var(--ad-mute)">No img</div>`
            }
            <div style="min-width:0;flex:1">
              <h3>${esc(a.title || "Untitled article")}</h3>
              <div class="meta-line">
                <span>${esc(a.category || "Uncategorised")}</span><span class="sep">·</span>
                <span>${media.length} photo${media.length === 1 ? "" : "s"}</span><span class="sep">·</span>
                <span>${esc(fmtDate(a.created_at))}</span><span class="sep">·</span>
                <span class="status ${a.published ? "published" : "pending"}">${
          a.published ? "Published" : "Draft"
        }</span>
              </div>
              ${a.description ? `<p class="meta" style="margin:6px 0 0">${esc(a.description)}</p>` : ""}
            </div>
          </div>
          <div class="actions">
            <button type="button" class="ghost" data-art-edit="${esc(a.id)}">Edit</button>
            <button type="button" class="ghost" data-art-toggle="${esc(a.id)}">${
          a.published ? "Unpublish" : "Publish"
        }</button>
            <button type="button" class="danger" data-art-delete="${esc(a.id)}">Delete</button>
          </div>
        </article>`;
      })
      .join("");
  }

  async function loadContent(opts = {}) {
    if (!sb) return;
    if (!opts.silent) {
      if ($("journalList")) $("journalList").innerHTML = '<div class="empty">Loading articles…</div>';
      if ($("projectList")) $("projectList").innerHTML = '<div class="empty">Loading projects…</div>';
    }
    const { data, error } = await sb
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      showNotice("Could not load content items: " + error.message, "err");
      return;
    }
    const rows = data || [];
    state.journalItems = rows.filter((r) => r.type === "article");
    state.projectItems = rows.filter((r) => ["photo", "video"].includes(r.type));
    renderJournalList();
    renderProjectsList();
  }

  $("newArticle")?.addEventListener("click", () => openArticleForm(null));
  $("cancelArticle")?.addEventListener("click", closeArticleForm);
  $("previewArticle")?.addEventListener("click", renderArticlePreview);
  $("closeArticlePreview")?.addEventListener("click", () =>
    $("articlePreviewPanel")?.classList.add("section-hidden")
  );

  $("articleForm")?.addEventListener("input", () => {
    markDirty("journal", true);
    saveJournalDraftLocally();
  });

  $("articlePhotos")?.addEventListener("change", () => {
    selectedArticleFiles = Array.from($("articlePhotos")?.files || []);
    $("articleCoverIndex").value = "0";
    renderArticlePhotoChoices();
  });

  $("articlePhotoChoices")?.addEventListener("change", (e) => {
    const radio = e.target.closest('input[name="articleCoverPick"]');
    if (radio) $("articleCoverIndex").value = radio.value;
  });

  $("articlePhotoChoices")?.addEventListener("click", (e) => {
    const rem = e.target.closest("[data-art-remove]");
    if (!rem) return;
    const idx = Number(rem.dataset.artRemove);
    existingArticleMedia.splice(idx, 1);
    markDirty("journal", true);
    renderArticlePhotoChoices();
  });

  $("articleForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("articleError");
    errEl?.classList.add("hidden");

    const id = $("articleId")?.value.trim() || "";
    const existing = id ? state.journalItems.find((x) => String(x.id) === id) : null;
    const title = $("articleTitle")?.value.trim() || "";
    const category = $("articleCategory")?.value.trim() || "";
    const description = $("articleDescription")?.value.trim() || "";
    const body = $("articleBody")?.value.trim() || "";
    const published = !!$("articlePublished")?.checked;

    if (!title || !body) {
      if (errEl) {
        errEl.textContent = "Article title and full text are required.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    const activeCount = selectedArticleFiles.length || existingArticleMedia.length;
    if (activeCount < 2 || activeCount > 15) {
      if (errEl) {
        errEl.textContent = "Journal articles require between 2 and 15 photos.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    for (const f of selectedArticleFiles) {
      if (!f.type.startsWith("image/")) {
        if (errEl) {
          errEl.textContent = "Journal articles accept image files only.";
          errEl.classList.remove("hidden");
        }
        return;
      }
      if (f.size > 12 * 1024 * 1024) {
        if (errEl) {
          errEl.textContent = `${f.name} exceeds the 12 MB photo limit.`;
          errEl.classList.remove("hidden");
        }
        return;
      }
    }

    const btn = $("saveArticle");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }

    try {
      const oldAll = existing ? mediaItemsOf(existing) : [];
      let media_gallery = existingArticleMedia.slice();
      if (selectedArticleFiles.length) {
        media_gallery = [];
        for (let i = 0; i < selectedArticleFiles.length; i++) {
          if (btn) btn.textContent = `Uploading ${i + 1} / ${selectedArticleFiles.length}…`;
          media_gallery.push(await uploadProjectFile(selectedArticleFiles[i]));
        }
        await removeStorageItems(oldAll);
      } else if (existing) {
        const keptPaths = new Set(media_gallery.map((m) => m.path).filter(Boolean));
        const removed = oldAll.filter((m) => m.path && !keptPaths.has(m.path));
        if (removed.length) await removeStorageItems(removed);
      }

      const coverIdx = Math.min(
        Math.max(0, Number($("articleCoverIndex")?.value || 0)),
        Math.max(0, media_gallery.length - 1)
      );
      if (coverIdx > 0 && media_gallery[coverIdx]) {
        const [picked] = media_gallery.splice(coverIdx, 1);
        media_gallery.unshift(picked);
      }

      const primary = media_gallery[0] || null;
      const payload = {
        title,
        type: "article",
        category: category || null,
        description: description || null,
        body,
        media_url: primary?.url || null,
        media_path: primary?.path || null,
        media_mime: primary?.mime || null,
        media_gallery,
        published,
      };

      const { data, error } = id
        ? await sb.from("projects").update(payload).eq("id", id).select("id").single()
        : await sb
            .from("projects")
            .insert({ ...payload, author_id: state.adminUserId })
            .select("id")
            .single();
      if (error) throw error;

      clearJournalDraft();
      await recordAdminAudit(
        id ? "update_journal_article" : "create_journal_article",
        "content",
        data?.id || id,
        `${id ? "Updated" : "Created"} journal article "${title}" (${published ? "published" : "draft"})`
      );
      closeArticleForm();
      toast("Journal article saved.", "ok");
      await loadContent({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "Could not save article.";
        errEl.classList.remove("hidden");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save article";
      }
    }
  });

  $("journalList")?.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-art-edit]");
    if (edit) {
      const a = state.journalItems.find((x) => String(x.id) === edit.dataset.artEdit);
      if (a) openArticleForm(a);
      return;
    }
    const tog = e.target.closest("[data-art-toggle]");
    if (tog) {
      const a = state.journalItems.find((x) => String(x.id) === tog.dataset.artToggle);
      if (!a) return;
      const next = !a.published;
      const { error } = await sb.from("projects").update({ published: next }).eq("id", a.id);
      if (error) {
        showNotice("Could not update publish state: " + error.message, "err");
        return;
      }
      await recordAdminAudit(
        next ? "publish_article" : "unpublish_article",
        "content",
        a.id,
        `${next ? "Published" : "Unpublished"} journal article "${a.title}"`
      );
      toast(`Article ${next ? "published" : "moved to drafts"}.`, "ok");
      await loadContent({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
      return;
    }
    const del = e.target.closest("[data-art-delete]");
    if (del) {
      const a = state.journalItems.find((x) => String(x.id) === del.dataset.artDelete);
      if (!a) return;
      const ok = await confirm({
        eyebrow: "JOURNAL · DELETE ARTICLE",
        title: `Delete "${a.title}"?`,
        message: "This permanently removes the article and its gallery media.",
        confirmText: "Delete permanently",
        danger: true,
      });
      if (!ok) return;
      const { error } = await sb.from("projects").delete().eq("id", a.id);
      if (error) {
        showNotice("Could not delete article: " + error.message, "err");
        return;
      }
      await removeStorageItems(mediaItemsOf(a));
      await recordAdminAudit("delete_article", "content", a.id, `Deleted article "${a.title}"`);
      toast("Article deleted.", "ok");
      await loadContent({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    }
  });

  /* =========================================================
     2. OUR PROJECTS (Photo & Video Showcases)
     ========================================================= */
  function renderProjectMediaPreview() {
    const box = $("projectCurrentMedia");
    const help = $("projectMediaHelp");
    if (!box) return;
    const count = selectedProjectFiles.length || existingProjectMedia.length;
    if (help) {
      help.textContent = selectedProjectFiles.length
        ? `${selectedProjectFiles.length} new file(s) staged (uploading replaces existing project media).`
        : existingProjectMedia.length
        ? `${existingProjectMedia.length} current media item(s). Remove items or upload new files to replace.`
        : "Up to 15 photos/videos (12 MB per photo, 100 MB per video).";
    }
    if (!count) {
      box.innerHTML = "";
      return;
    }
    if (selectedProjectFiles.length) {
      box.innerHTML = selectedProjectFiles
        .map(
          (f, i) => `
        <div class="article-photo-choice">
          <div style="padding:18px 8px;text-align:center;font-size:12px">
            <strong>${esc(f.type.startsWith("video/") ? "Video" : "Image")} #${i + 1}</strong>
            <div class="meta">${esc(f.name)}</div>
          </div>
        </div>`
        )
        .join("");
      return;
    }
    box.innerHTML = existingProjectMedia
      .map((m, idx) => {
        const isVid = m.type === "video" || String(m.mime || "").startsWith("video/");
        return `
        <div class="article-photo-choice">
          ${
            isVid
              ? `<video muted preload="none" src="${esc(safeUrl(m.url))}"></video>`
              : `<img src="${esc(safeUrl(m.url))}" alt="Project media ${idx + 1}" loading="lazy" decoding="async">`
          }
          <button type="button" class="media-remove" data-proj-remove="${idx}" aria-label="Remove item ${
          idx + 1
        }">×</button>
        </div>`;
      })
      .join("");
  }

  function openProjectForm(p = null) {
    $("projectId").value = p?.id || "";
    $("projectTitle").value = p?.title || "";
    $("projectCategory").value = p?.category || "";
    $("projectDescription").value = p?.description || "";
    $("projectPublished").checked = p ? p.published === true : true;
    if ($("projectMedia")) $("projectMedia").value = "";
    selectedProjectFiles = [];
    existingProjectMedia = p ? mediaItemsOf(p) : [];
    $("projectError")?.classList.add("hidden");
    if ($("projectProgress")) $("projectProgress").hidden = true;
    renderProjectMediaPreview();
    $("projectForm")?.classList.remove("section-hidden");
    $("projectTitle")?.focus();
  }

  function closeProjectForm() {
    $("projectForm")?.classList.add("section-hidden");
    $("projectForm")?.reset();
    if ($("projectId")) $("projectId").value = "";
    existingProjectMedia = [];
    selectedProjectFiles = [];
    if ($("projectProgress")) $("projectProgress").hidden = true;
    markDirty("project", false);
  }

  function renderProjectsList() {
    const box = $("projectList");
    if (!box) return;
    if (!state.projectItems.length) {
      box.innerHTML = '<div class="empty">No workshop projects created yet.</div>';
      return;
    }

    box.innerHTML = state.projectItems
      .map((p) => {
        const media = mediaItemsOf(p);
        return `
        <article class="project-item">
          <div style="min-width:0;flex:1">
            <h3>${esc(p.title || "Untitled project")}</h3>
            <div class="meta-line">
              <span>${esc(p.category || "Workshop project")}</span><span class="sep">·</span>
              <span>${media.length} media item${media.length === 1 ? "" : "s"}</span><span class="sep">·</span>
              <span class="status ${p.published ? "published" : "pending"}">${
          p.published ? "Published" : "Draft"
        }</span>
            </div>
            ${p.description ? `<p class="meta" style="margin:6px 0 0">${esc(p.description)}</p>` : ""}
            ${
              media.length
                ? `<div class="project-thumbs">${media
                    .slice(0, 4)
                    .map((m) =>
                      m.type === "video" || String(m.mime || "").startsWith("video/")
                        ? `<video muted preload="none" src="${esc(safeUrl(m.url))}"></video>`
                        : `<img src="${esc(safeUrl(m.url))}" alt="" loading="lazy" decoding="async">`
                    )
                    .join("")}</div>`
                : ""
            }
          </div>
          <div class="actions">
            <button type="button" class="ghost" data-proj-edit="${esc(p.id)}">Edit</button>
            <button type="button" class="danger" data-proj-delete="${esc(p.id)}">Delete</button>
          </div>
        </article>`;
      })
      .join("");
  }

  $("newProject")?.addEventListener("click", () => openProjectForm(null));
  $("cancelProject")?.addEventListener("click", closeProjectForm);
  $("projectForm")?.addEventListener("input", () => markDirty("project", true));

  $("projectMedia")?.addEventListener("change", () => {
    selectedProjectFiles = Array.from($("projectMedia")?.files || []);
    renderProjectMediaPreview();
  });

  $("projectCurrentMedia")?.addEventListener("click", (e) => {
    const rem = e.target.closest("[data-proj-remove]");
    if (!rem) return;
    existingProjectMedia.splice(Number(rem.dataset.projRemove), 1);
    markDirty("project", true);
    renderProjectMediaPreview();
  });

  $("projectForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("projectError");
    errEl?.classList.add("hidden");

    const id = $("projectId")?.value.trim() || "";
    const existing = id ? state.projectItems.find((x) => String(x.id) === id) : null;
    const title = $("projectTitle")?.value.trim() || "";
    const category = $("projectCategory")?.value.trim() || "";
    const description = $("projectDescription")?.value.trim() || "";
    const published = !!$("projectPublished")?.checked;

    if (!title) {
      if (errEl) {
        errEl.textContent = "Project title is required.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    const totalCount = selectedProjectFiles.length || existingProjectMedia.length;
    if (!totalCount || totalCount > 15) {
      if (errEl) {
        errEl.textContent = "Choose between 1 and 15 photos/videos for this project.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    for (const f of selectedProjectFiles) {
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
        if (errEl) {
          errEl.textContent = `${f.name}: only image and video files are allowed.`;
          errEl.classList.remove("hidden");
        }
        return;
      }
      const limitMb = f.type.startsWith("video/") ? 100 : 12;
      if (f.size > limitMb * 1024 * 1024) {
        if (errEl) {
          errEl.textContent = `${f.name} exceeds the ${limitMb} MB limit.`;
          errEl.classList.remove("hidden");
        }
        return;
      }
    }

    const btn = $("saveProject");
    const prog = $("projectProgress");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }
    if (prog && selectedProjectFiles.length) {
      prog.hidden = false;
      prog.value = 0;
    }

    try {
      const oldAll = existing ? mediaItemsOf(existing) : [];
      let media_gallery = existingProjectMedia.slice();
      if (selectedProjectFiles.length) {
        media_gallery = [];
        for (let i = 0; i < selectedProjectFiles.length; i++) {
          if (btn) btn.textContent = `Uploading ${i + 1} / ${selectedProjectFiles.length}…`;
          media_gallery.push(await uploadProjectFile(selectedProjectFiles[i]));
          if (prog) prog.value = Math.round(((i + 1) / selectedProjectFiles.length) * 100);
        }
        await removeStorageItems(oldAll);
      } else if (existing) {
        const keptPaths = new Set(media_gallery.map((m) => m.path).filter(Boolean));
        const removed = oldAll.filter((m) => m.path && !keptPaths.has(m.path));
        if (removed.length) await removeStorageItems(removed);
      }

      const primary = media_gallery[0] || null;
      const hasVideo = media_gallery.some(
        (m) => m.type === "video" || String(m.mime || "").startsWith("video/")
      );
      const payload = {
        title,
        type: hasVideo ? "video" : "photo",
        category: category || null,
        description: description || null,
        body: null,
        media_url: primary?.url || null,
        media_path: primary?.path || null,
        media_mime: primary?.mime || null,
        media_gallery,
        published,
      };

      const { data, error } = id
        ? await sb.from("projects").update(payload).eq("id", id).select("id").single()
        : await sb
            .from("projects")
            .insert({ ...payload, author_id: state.adminUserId })
            .select("id")
            .single();
      if (error) throw error;

      await recordAdminAudit(
        id ? "update_project" : "create_project",
        "content",
        data?.id || id,
        `${id ? "Updated" : "Created"} workshop project "${title}"`
      );
      closeProjectForm();
      toast("Workshop project saved.", "ok");
      await loadContent({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "Could not save project.";
        errEl.classList.remove("hidden");
      }
      if (prog) prog.hidden = true;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save project";
      }
    }
  });

  $("projectList")?.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-proj-edit]");
    if (edit) {
      const p = state.projectItems.find((x) => String(x.id) === edit.dataset.projEdit);
      if (p) openProjectForm(p);
      return;
    }
    const del = e.target.closest("[data-proj-delete]");
    if (del) {
      const p = state.projectItems.find((x) => String(x.id) === del.dataset.projDelete);
      if (!p) return;
      const ok = await confirm({
        eyebrow: "PROJECTS · DELETE",
        title: `Delete "${p.title}"?`,
        message: "This removes the project and its uploaded photos/videos permanently.",
        confirmText: "Delete permanently",
        danger: true,
      });
      if (!ok) return;
      const { error } = await sb.from("projects").delete().eq("id", p.id);
      if (error) {
        showNotice("Could not delete project: " + error.message, "err");
        return;
      }
      await removeStorageItems(mediaItemsOf(p));
      await recordAdminAudit("delete_project", "content", p.id, `Deleted project "${p.title}"`);
      toast("Workshop project deleted.", "ok");
      await loadContent({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    }
  });

  /* =========================================================
     3. WEBSITE CONTACT, FOOTER & ABOUT US SETTINGS
     ========================================================= */
  const CONTACT_FIELD_MAP = [
    ["contactEmail", "contact_email"],
    ["whatsappNumber", "whatsapp_number"],
    ["postalAddress", "postal_address"],
    ["garageEmail", "garage_email"],
    ["garageWhatsApp", "garage_whatsapp"],
    ["garagePhone", "garage_phone"],
    ["garageAddress", "garage_address"],
    ["garageHours", "garage_hours"],
    ["footerBrand", "footer_brand"],
    ["footerNote", "footer_note"],
    ["instagramUrl", "instagram_url"],
    ["facebookUrl", "facebook_url"],
    ["twitterUrl", "twitter_url"],
    ["tiktokUrl", "tiktok_url"],
  ];

  const ABOUT_FIELD_MAP = [
    ["aboutTitle", "about_title"],
    ["aboutIntro", "about_intro"],
    ["aboutWhatTitle", "about_what_title"],
    ["aboutWhatBody", "about_what_body"],
    ["aboutFocusBody", "about_focus_body"],
    ["aboutApproachTitle", "about_approach_title"],
    ["aboutTransparentTitle", "about_transparent_title"],
    ["aboutTransparentBody", "about_transparent_body"],
    ["aboutPracticalTitle", "about_practical_title"],
    ["aboutPracticalBody", "about_practical_body"],
    ["aboutConnectedTitle", "about_connected_title"],
    ["aboutConnectedBody", "about_connected_body"],
  ];

  async function loadSiteSettings() {
    if (!sb) return;
    const { data, error } = await sb
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      showNotice("Could not load website settings: " + error.message, "err");
      return;
    }
    const row = data || {};
    CONTACT_FIELD_MAP.forEach(([domId, col]) => {
      if ($(domId)) $(domId).value = row[col] || "";
    });
    ABOUT_FIELD_MAP.forEach(([domId, col]) => {
      if ($(domId)) $(domId).value = row[col] || "";
    });
    markDirty("siteSettings", false);
  }

  $("contactForm")?.addEventListener("input", () => markDirty("siteSettings", true));
  $("aboutForm")?.addEventListener("input", () => markDirty("siteSettings", true));

  $("contactForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("contactError");
    errEl?.classList.add("hidden");
    const btn = $("saveContact");
    if (btn) btn.disabled = true;

    const payload = { id: 1, updated_at: new Date().toISOString() };
    CONTACT_FIELD_MAP.forEach(([domId, col]) => {
      payload[col] = $(domId)?.value.trim() || null;
    });

    const { error } = await sb.from("site_settings").upsert(payload, { onConflict: "id" });
    if (btn) btn.disabled = false;

    if (error) {
      if (errEl) {
        errEl.textContent = "Could not save contact & footer settings: " + error.message;
        errEl.classList.remove("hidden");
      }
      return;
    }

    markDirty("siteSettings", false);
    await recordAdminAudit(
      "update_contact_footer",
      "site_settings",
      1,
      "Updated public contact, garage, social & footer settings"
    );
    toast("Contact & footer settings saved.", "ok");
  });

  $("aboutForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("aboutError");
    const okEl = $("aboutSaved");
    errEl?.classList.add("hidden");
    okEl?.classList.add("hidden");

    const payload = { id: 1, updated_at: new Date().toISOString() };
    for (const [domId, col] of ABOUT_FIELD_MAP) {
      const val = $(domId)?.value.trim() || "";
      if (!val) {
        if (errEl) {
          errEl.textContent = "Please fill in all About Us fields before saving.";
          errEl.classList.remove("hidden");
        }
        $(domId)?.focus();
        return;
      }
      payload[col] = val;
    }

    const btn = $("saveAbout");
    if (btn) btn.disabled = true;
    const { error } = await sb.from("site_settings").upsert(payload, { onConflict: "id" });
    if (btn) btn.disabled = false;

    if (error) {
      if (errEl) {
        errEl.textContent = "Could not save About Us copy: " + error.message;
        errEl.classList.remove("hidden");
      }
      return;
    }

    markDirty("siteSettings", false);
    okEl?.classList.remove("hidden");
    await recordAdminAudit(
      "update_about_us",
      "site_settings",
      1,
      "Updated public About Us editorial content"
    );
    toast("About Us page updated.", "ok");
  });

  A.registerLoader("journalPanel", loadContent);
  A.registerLoader("projectsPanel", loadContent);
  A.registerLoader("contactPanel", loadSiteSettings);

  window.ThreePedalsAdminContent = { loadContent, loadSiteSettings };
})();
