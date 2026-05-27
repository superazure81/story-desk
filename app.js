const STORAGE_KEY = "storyDeskState";
const SYNC_KEY = "storyDeskSync";
const EDITOR_PREFS_KEY = "storyDeskEditorPrefs";
const DRIVE_FILE_NAME = "story-desk-projects.json";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

const starterProject = () => ({
  id: crypto.randomUUID(),
  name: "Moje opowiadanie",
  goal: 25000,
  updatedAt: new Date().toISOString(),
  chapters: [
    {
      id: crypto.randomUUID(),
      title: "Rozdział 1",
      scenes: [
        {
          id: crypto.randomUUID(),
          title: "Pierwsza scena",
          text: "Zacznij tutaj. Jedna scena, jeden moment, jedna decyzja.",
          synopsis: "Krótki opis sceny.",
          notes: "Notatki warsztatowe, pytania, tropy do rozwinięcia."
        }
      ]
    }
  ],
  world: {
    characters: [{ id: crypto.randomUUID(), name: "Główna postać", body: "Cel, lęk, sekret." }],
    locations: [{ id: crypto.randomUUID(), name: "Ważne miejsce", body: "Atmosfera, funkcja w historii." }],
    ideas: [{ id: crypto.randomUUID(), name: "Motyw", body: "Obraz, zdanie albo konflikt do wykorzystania." }]
  },
  plot: {
    lines: [
      {
        id: crypto.randomUUID(),
        name: "Glowna linia fabularna",
        color: "blue",
        points: [
          {
            id: crypto.randomUUID(),
            title: "Punkt zwrotny",
            body: "Co zmienia sytuacje bohatera?",
            chapterId: "",
            sceneId: "",
            status: "plan"
          }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: "Relacje",
        color: "green",
        points: []
      }
    ]
  }
});

let state = loadState();
let activeProjectId = state.activeProjectId || state.projects[0].id;
let activeSceneId = state.activeSceneId || state.projects[0].chapters[0].scenes[0].id;
let activeView = "manuscript";
let activeDocumentTab = "manuscript";
let shouldFocusNotes = false;
const collapsedChapters = new Set();
let editorPrefs = loadEditorPrefs();
let saveTimer;

const el = {
  saveState: document.querySelector("#saveState"),
  sidebar: document.querySelector("#sidebar"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  projectSelect: document.querySelector("#projectSelect"),
  renameProjectBtn: document.querySelector("#renameProjectBtn"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  addChapterBtn: document.querySelector("#addChapterBtn"),
  chapterList: document.querySelector("#chapterList"),
  sheetList: document.querySelector("#sheetList"),
  sheetListTitle: document.querySelector("#sheetListTitle"),
  sheetGroupLabel: document.querySelector("#sheetGroupLabel"),
  sceneTitle: document.querySelector("#sceneTitle"),
  sceneText: document.querySelector("#sceneText"),
  sceneSynopsis: document.querySelector("#sceneSynopsis"),
  sceneNotes: document.querySelector("#sceneNotes"),
  editorFont: document.querySelector("#editorFont"),
  editorFontSize: document.querySelector("#editorFontSize"),
  deleteSceneBtn: document.querySelector("#deleteSceneBtn"),
  wordCount: document.querySelector("#wordCount"),
  chapterName: document.querySelector("#chapterName"),
  projectGoal: document.querySelector("#projectGoal"),
  goalProgress: document.querySelector("#goalProgress"),
  goalLabel: document.querySelector("#goalLabel"),
  boardGrid: document.querySelector("#boardGrid"),
  addSceneBtn: document.querySelector("#addSceneBtn"),
  addSceneBoardBtn: document.querySelector("#addSceneBoardBtn"),
  addPlotLineBtn: document.querySelector("#addPlotLineBtn"),
  addPlotPointBtn: document.querySelector("#addPlotPointBtn"),
  plotBoard: document.querySelector("#plotBoard"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  googleClientId: document.querySelector("#googleClientId"),
  saveSyncSettings: document.querySelector("#saveSyncSettings"),
  driveUploadBtn: document.querySelector("#driveUploadBtn"),
  driveDownloadBtn: document.querySelector("#driveDownloadBtn"),
  syncStatus: document.querySelector("#syncStatus"),
  dialog: document.querySelector("#textDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogInput: document.querySelector("#dialogInput")
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const project = starterProject();
    return { projects: [project], activeProjectId: project.id, activeSceneId: project.chapters[0].scenes[0].id };
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.projects) && parsed.projects.length) {
      parsed.projects.forEach(ensureProjectShape);
      return parsed;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  const project = starterProject();
  return { projects: [project], activeProjectId: project.id, activeSceneId: project.chapters[0].scenes[0].id };
}

function loadEditorPrefs() {
  try {
    return { font: "mono", size: 24, ...JSON.parse(localStorage.getItem(EDITOR_PREFS_KEY) || "{}") };
  } catch {
    return { font: "mono", size: 24 };
  }
}

function saveEditorPrefs() {
  localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(editorPrefs));
}

function applyEditorPrefs() {
  const families = {
    mono: 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace',
    serif: 'Georgia, "Times New Roman", serif',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
  };
  const family = families[editorPrefs.font] || families.mono;
  const size = Math.min(36, Math.max(14, Number(editorPrefs.size) || 24));
  el.editorFont.value = editorPrefs.font;
  el.editorFontSize.value = size;
  el.sceneText.style.fontFamily = family;
  el.sceneText.style.fontSize = `${size}px`;
  el.sceneTitle.style.fontFamily = family;
}

function ensureProjectShape(project) {
  project.world ||= { characters: [], locations: [], ideas: [] };
  project.world.characters ||= [];
  project.world.locations ||= [];
  project.world.ideas ||= [];
  project.plot ||= { lines: [] };
  project.plot.lines ||= [];
  if (!project.plot.lines.length) {
    project.plot.lines.push({
      id: crypto.randomUUID(),
      name: "Glowna linia fabularna",
      color: "blue",
      points: []
    });
  }
  project.plot.lines.forEach((line) => {
    line.id ||= crypto.randomUUID();
    line.name ||= "Linia fabularna";
    line.color ||= "blue";
    line.points ||= [];
    line.points.forEach((point) => {
      point.id ||= crypto.randomUUID();
      point.title ||= "Punkt fabularny";
      point.body ||= "";
      point.chapterId ||= "";
      point.sceneId ||= "";
      point.status ||= "plan";
    });
  });
}

function saveSoon() {
  clearTimeout(saveTimer);
  el.saveState.textContent = "Zapisywanie...";
  saveTimer = setTimeout(() => {
    const project = getProject();
    project.updatedAt = new Date().toISOString();
    state.activeProjectId = activeProjectId;
    state.activeSceneId = activeSceneId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    el.saveState.textContent = "Zapisano lokalnie";
  }, 180);
}

function getProject() {
  return state.projects.find((project) => project.id === activeProjectId) || state.projects[0];
}

function getScene() {
  const project = getProject();
  for (const chapter of project.chapters) {
    const scene = chapter.scenes.find((item) => item.id === activeSceneId);
    if (scene) return { project, chapter, scene };
  }
  const chapter = project.chapters[0];
  const scene = chapter.scenes[0];
  activeSceneId = scene.id;
  return { project, chapter, scene };
}

function countWords(text) {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function projectWordCount(project) {
  return project.chapters.reduce((sum, chapter) => {
    return sum + chapter.scenes.reduce((sceneSum, scene) => sceneSum + countWords(scene.text), 0);
  }, 0);
}

function render() {
  renderProjects();
  renderBinder();
  renderSheetList();
  renderEditor();
  renderBoard();
  renderPlot();
  renderWorld();
  renderSync();
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${activeView}View`).classList.add("active");
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === activeView));
  document.querySelectorAll(".document-tab[data-doc-view]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.docView === activeDocumentTab);
  });

  if (shouldFocusNotes) {
    shouldFocusNotes = false;
    requestAnimationFrame(() => {
      el.sceneNotes.focus();
      el.sceneNotes.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

function renderProjects() {
  el.projectSelect.innerHTML = "";
  state.projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    option.selected = project.id === activeProjectId;
    el.projectSelect.append(option);
  });
}

function renderBinder() {
  const project = getProject();
  el.chapterList.innerHTML = "";

  project.chapters.forEach((chapter) => {
    const chapterWrap = document.createElement("div");
    chapterWrap.className = "chapter";
    chapterWrap.dataset.chapterId = chapter.id;

    const chapterRow = document.createElement("div");
    chapterRow.className = "chapter-row";
    chapterRow.innerHTML = `
      <button class="chapter-toggle" type="button" aria-label="Zwin lub rozwin rozdzial"></button>
      <span class="row-title"></span>
      <button class="icon-button small chapter-add" type="button" aria-label="Dodaj scene" title="Dodaj scene">＋</button>
    `;
    chapterRow.querySelector(".chapter-toggle").textContent = collapsedChapters.has(chapter.id) ? "▸" : "▾";
    chapterRow.querySelector(".row-title").textContent = chapter.title;
    chapterRow.querySelector(".chapter-toggle").addEventListener("click", () => toggleChapter(chapter.id));
    chapterRow.querySelector(".row-title").addEventListener("click", () => toggleChapter(chapter.id));
    chapterRow.querySelector(".chapter-add").addEventListener("click", () => addScene(chapter.id));
    chapterWrap.append(chapterRow);

    const sceneList = document.createElement("div");
    sceneList.className = "binder-scenes";
    sceneList.hidden = collapsedChapters.has(chapter.id);
    sceneList.addEventListener("dragover", (event) => event.preventDefault());
    sceneList.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = readDragPayload(event);
      if (!payload || payload.type !== "scene") return;
      reorderScene(payload.chapterId, payload.sceneId, chapter.id, null);
    });

    chapter.scenes.forEach((scene, index) => {
      const sceneRow = document.createElement("div");
      sceneRow.className = `scene-row ${scene.id === activeSceneId ? "active" : ""}`;
      sceneRow.draggable = true;
      sceneRow.dataset.chapterId = chapter.id;
      sceneRow.dataset.sceneId = scene.id;
      sceneRow.innerHTML = `
        <span class="scene-drag-handle" title="Przeciagnij">☰</span>
        <span class="row-title"></span>
        <span class="scene-count">${countWords(scene.text)}</span>
        <span class="scene-move-buttons">
          <button class="icon-button small scene-up" type="button" aria-label="Przesun scene w gore" title="W gore">↑</button>
          <button class="icon-button small scene-down" type="button" aria-label="Przesun scene w dol" title="W dol">↓</button>
        </span>
      `;
      sceneRow.querySelector(".row-title").textContent = scene.title || "Bez tytulu";
      sceneRow.querySelector(".scene-up").disabled = index === 0;
      sceneRow.querySelector(".scene-down").disabled = index === chapter.scenes.length - 1;
      sceneRow.querySelector(".scene-up").addEventListener("click", (event) => {
        event.stopPropagation();
        moveScene(chapter.id, scene.id, -1);
      });
      sceneRow.querySelector(".scene-down").addEventListener("click", (event) => {
        event.stopPropagation();
        moveScene(chapter.id, scene.id, 1);
      });
      sceneRow.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", JSON.stringify({ type: "scene", chapterId: chapter.id, sceneId: scene.id }));
        sceneRow.classList.add("dragging");
      });
      sceneRow.addEventListener("dragend", () => sceneRow.classList.remove("dragging"));
      sceneRow.addEventListener("dragover", (event) => {
        event.preventDefault();
        sceneRow.classList.add("drag-over");
      });
      sceneRow.addEventListener("dragleave", () => sceneRow.classList.remove("drag-over"));
      sceneRow.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        sceneRow.classList.remove("drag-over");
        const payload = readDragPayload(event);
        if (!payload || payload.type !== "scene") return;
        reorderScene(payload.chapterId, payload.sceneId, chapter.id, scene.id);
      });
      sceneRow.addEventListener("click", () => {
        activeSceneId = scene.id;
        activeView = "manuscript";
        activeDocumentTab = "manuscript";
        el.sidebar.classList.remove("open");
        render();
        saveSoon();
      });
      sceneList.append(sceneRow);
    });

    chapterWrap.append(sceneList);
    el.chapterList.append(chapterWrap);
  });
}
function renderEditor() {
  const { project, chapter, scene } = getScene();
  const total = projectWordCount(project);
  const goal = Number(project.goal) || 0;
  el.sheetListTitle.textContent = chapter.title;
  el.sheetGroupLabel.textContent = project.name;
  el.sceneTitle.value = scene.title;
  el.sceneText.value = scene.text;
  el.sceneSynopsis.value = scene.synopsis;
  el.sceneNotes.value = scene.notes;
  el.wordCount.textContent = `${countWords(scene.text)} słów`;
  el.chapterName.textContent = chapter.title;
  el.projectGoal.value = goal;
  el.goalProgress.value = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  el.goalLabel.textContent = `${total} / ${goal || "bez celu"}`;
  applyEditorPrefs();
}

function renderSheetList() {
  const project = getProject();
  el.sheetList.innerHTML = "";
  project.chapters.flatMap((chapter) => chapter.scenes.map((scene) => ({ chapter, scene }))).forEach(({ chapter, scene }, index) => {
    const card = document.createElement("button");
    const synopsis = scene.synopsis || scene.text || chapter.title;
    card.className = `sheet-card ${scene.id === activeSceneId ? "active" : ""}`;
    card.innerHTML = `
      <h2></h2>
      <p></p>
      <div class="tag-row">
        <span class="tag orange">Scena ${index + 1}</span>
        <span class="tag green"></span>
        <span class="tag blue"></span>
      </div>
    `;
    card.querySelector("h2").textContent = scene.title || "Bez tytulu";
    card.querySelector("p").textContent = synopsis;
    card.querySelector(".tag.green").textContent = chapter.title;
    card.querySelector(".tag.blue").textContent = `${countWords(scene.text)} slow`;
    card.addEventListener("click", () => {
      activeSceneId = scene.id;
      activeView = "manuscript";
      activeDocumentTab = "manuscript";
      render();
      saveSoon();
    });
    el.sheetList.append(card);
  });
}

function renderBoard() {
  const project = getProject();
  el.boardGrid.innerHTML = "";
  project.chapters.flatMap((chapter) => chapter.scenes.map((scene) => ({ chapter, scene }))).forEach(({ chapter, scene }) => {
    const card = document.createElement("article");
    card.className = "scene-card";
    card.innerHTML = `<h2></h2><p></p><span class="count"></span>`;
    card.querySelector("h2").textContent = scene.title || "Bez tytułu";
    card.querySelector("p").textContent = scene.synopsis || chapter.title;
    card.querySelector(".count").textContent = `${countWords(scene.text)} słów`;
    card.addEventListener("click", () => {
      activeSceneId = scene.id;
      activeView = "manuscript";
      activeDocumentTab = "manuscript";
      render();
      saveSoon();
    });
    el.boardGrid.append(card);
  });
}

function renderPlot() {
  const project = getProject();
  ensureProjectShape(project);
  el.plotBoard.innerHTML = "";

  project.plot.lines.forEach((line) => {
    const article = document.createElement("article");
    article.className = "plot-line";
    article.innerHTML = `
      <header>
        <div>
          <h2></h2>
          <small></small>
        </div>
        <button class="icon-button small" type="button" aria-label="Dodaj punkt">＋</button>
      </header>
      <div class="plot-points"></div>
    `;
    article.querySelector("h2").textContent = line.name;
    article.querySelector("small").textContent = `${line.points.length} punktow`;
    article.querySelector("button").addEventListener("click", () => addPlotPoint(line.id));
    const list = article.querySelector(".plot-points");

    line.points.forEach((point, index) => {
      const chapter = project.chapters.find((item) => item.id === point.chapterId);
      const scene = project.chapters.flatMap((item) => item.scenes).find((item) => item.id === point.sceneId);
      const card = document.createElement("article");
      card.className = "plot-point";
      card.draggable = true;
      card.dataset.lineId = line.id;
      card.dataset.pointId = point.id;
      card.style.borderLeftColor = plotColor(line.color);
      card.innerHTML = `
          <div class="plot-point-top">
          <button class="plot-drag-handle" type="button" aria-label="Przeciagnij punkt" title="Przeciagnij">☰</button>
          <h3></h3>
          <div class="plot-move-buttons">
            <button class="icon-button small move-up" type="button" aria-label="Przesun punkt w gore" title="W gore">↑</button>
            <button class="icon-button small move-down" type="button" aria-label="Przesun punkt w dol" title="W dol">↓</button>
            <button class="icon-button small delete-plot-point" type="button" aria-label="Usun punkt" title="Usun">×</button>
          </div>
        </div>
        <p></p>
        <div class="plot-point-meta">
          <span class="plot-pill status"></span>
          <span class="plot-pill chapter"></span>
          <span class="plot-pill scene"></span>
        </div>
      `;
      card.querySelector("h3").textContent = point.title;
      card.querySelector("p").textContent = point.body || "Kliknij, aby opisac ten beat.";
      card.querySelector(".status").textContent = point.status;
      card.querySelector(".chapter").textContent = chapter ? chapter.title : "bez rozdzialu";
      card.querySelector(".scene").textContent = scene ? scene.title : "bez sceny";
      card.querySelector(".move-up").disabled = index === 0;
      card.querySelector(".move-down").disabled = index === line.points.length - 1;
      card.querySelector(".move-up").addEventListener("click", (event) => {
        event.stopPropagation();
        movePlotPoint(line.id, point.id, -1);
      });
      card.querySelector(".move-down").addEventListener("click", (event) => {
        event.stopPropagation();
        movePlotPoint(line.id, point.id, 1);
      });
      card.querySelector(".delete-plot-point").addEventListener("click", (event) => {
        event.stopPropagation();
        deletePlotPoint(line.id, point.id);
      });
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", JSON.stringify({ lineId: line.id, pointId: point.id }));
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        card.classList.add("drag-over");
      });
      card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        card.classList.remove("drag-over");
        const payload = readDragPayload(event);
        if (!payload) return;
        reorderPlotPoint(payload.lineId, payload.pointId, line.id, point.id);
      });
      card.addEventListener("click", () => editPlotPoint(line.id, point.id));
      list.append(card);
    });

    list.addEventListener("dragover", (event) => event.preventDefault());
    list.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = readDragPayload(event);
      if (!payload) return;
      reorderPlotPoint(payload.lineId, payload.pointId, line.id, null);
    });

    el.plotBoard.append(article);
  });
}

function readDragPayload(event) {
  try {
    return JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    return null;
  }
}

function toggleChapter(chapterId) {
  if (collapsedChapters.has(chapterId)) {
    collapsedChapters.delete(chapterId);
  } else {
    collapsedChapters.add(chapterId);
  }
  renderBinder();
}

function moveScene(chapterId, sceneId, direction) {
  const project = getProject();
  const chapter = project.chapters.find((item) => item.id === chapterId);
  if (!chapter) return;
  const index = chapter.scenes.findIndex((item) => item.id === sceneId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= chapter.scenes.length) return;
  const [scene] = chapter.scenes.splice(index, 1);
  chapter.scenes.splice(nextIndex, 0, scene);
  render();
  saveSoon();
}

function reorderScene(sourceChapterId, sceneId, targetChapterId, beforeSceneId) {
  if (sceneId === beforeSceneId) return;
  const project = getProject();
  const sourceChapter = project.chapters.find((item) => item.id === sourceChapterId);
  const targetChapter = project.chapters.find((item) => item.id === targetChapterId);
  if (!sourceChapter || !targetChapter) return;
  const sourceIndex = sourceChapter.scenes.findIndex((item) => item.id === sceneId);
  if (sourceIndex < 0) return;
  const [scene] = sourceChapter.scenes.splice(sourceIndex, 1);
  let targetIndex = beforeSceneId ? targetChapter.scenes.findIndex((item) => item.id === beforeSceneId) : targetChapter.scenes.length;
  if (targetIndex < 0) targetIndex = targetChapter.scenes.length;
  targetChapter.scenes.splice(targetIndex, 0, scene);
  collapsedChapters.delete(targetChapterId);
  render();
  saveSoon();
}

function movePlotPoint(lineId, pointId, direction) {
  const project = getProject();
  const line = project.plot.lines.find((item) => item.id === lineId);
  if (!line) return;
  const index = line.points.findIndex((item) => item.id === pointId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= line.points.length) return;
  const [point] = line.points.splice(index, 1);
  line.points.splice(nextIndex, 0, point);
  render();
  saveSoon();
}

function reorderPlotPoint(sourceLineId, pointId, targetLineId, beforePointId) {
  if (pointId === beforePointId) return;
  const project = getProject();
  const sourceLine = project.plot.lines.find((item) => item.id === sourceLineId);
  const targetLine = project.plot.lines.find((item) => item.id === targetLineId);
  if (!sourceLine || !targetLine) return;
  const sourceIndex = sourceLine.points.findIndex((item) => item.id === pointId);
  if (sourceIndex < 0) return;
  const [point] = sourceLine.points.splice(sourceIndex, 1);
  let targetIndex = beforePointId ? targetLine.points.findIndex((item) => item.id === beforePointId) : targetLine.points.length;
  if (targetIndex < 0) targetIndex = targetLine.points.length;
  targetLine.points.splice(targetIndex, 0, point);
  render();
  saveSoon();
}

function deletePlotPoint(lineId, pointId) {
  if (!confirm("Usunąć ten punkt fabularny?")) return;
  const project = getProject();
  const line = project.plot.lines.find((item) => item.id === lineId);
  if (!line) return;
  line.points = line.points.filter((item) => item.id !== pointId);
  render();
  saveSoon();
}

function plotColor(color) {
  return {
    blue: "#1685d9",
    green: "#20a83a",
    orange: "#ff8c1a",
    red: "#cf332a"
  }[color] || "#1685d9";
}

function renderWorld() {
  const world = getProject().world;
  renderWorldList("characters", world.characters);
  renderWorldList("locations", world.locations);
  renderWorldList("ideas", world.ideas);
}

function renderWorldList(type, items) {
  const list = document.querySelector(`#${type}List`);
  list.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "world-item";
    card.innerHTML = `<button class="icon-button small delete-world" type="button" aria-label="Usun" title="Usun">×</button><strong></strong><p></p>`;
    card.querySelector("strong").textContent = item.name;
    card.querySelector("p").textContent = item.body;
    card.querySelector(".delete-world").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteWorldItem(type, item.id);
    });
    card.addEventListener("click", async () => {
      const name = await askText("Nazwa", item.name);
      if (!name) return;
      const body = await askText("Opis", item.body);
      item.name = name;
      item.body = body || "";
      render();
      saveSoon();
    });
    list.append(card);
  });
}

function deleteWorldItem(type, itemId) {
  const labels = { characters: "postać", locations: "miejsce", ideas: "pomysł" };
  if (!confirm(`Usunąć ${labels[type] || "element"}?`)) return;
  const project = getProject();
  project.world[type] = project.world[type].filter((item) => item.id !== itemId);
  render();
  saveSoon();
}

function renderSync() {
  const sync = JSON.parse(localStorage.getItem(SYNC_KEY) || "{}");
  el.googleClientId.value = sync.googleClientId || "";
}

async function addPlotLine() {
  const name = await askText("Nazwa linii fabularnej", "Nowa linia fabularna");
  if (!name) return;
  const colors = ["blue", "green", "orange", "red"];
  const project = getProject();
  ensureProjectShape(project);
  project.plot.lines.push({
    id: crypto.randomUUID(),
    name,
    color: colors[project.plot.lines.length % colors.length],
    points: []
  });
  activeView = "plot";
  activeDocumentTab = "plot";
  render();
  saveSoon();
}

async function addPlotPoint(lineId) {
  const project = getProject();
  ensureProjectShape(project);
  const line = project.plot.lines.find((item) => item.id === lineId) || project.plot.lines[0];
  const title = await askText("Nazwa punktu fabularnego", "Nowy punkt");
  if (!title) return;
  const body = await askText("Opis punktu", "");
  line.points.push({
    id: crypto.randomUUID(),
    title,
    body,
    chapterId: getScene().chapter.id,
    sceneId: activeSceneId,
    status: "plan"
  });
  activeView = "plot";
  activeDocumentTab = "plot";
  render();
  saveSoon();
}

async function editPlotPoint(lineId, pointId) {
  const project = getProject();
  const line = project.plot.lines.find((item) => item.id === lineId);
  const point = line?.points.find((item) => item.id === pointId);
  if (!point) return;

  const title = await askText("Nazwa punktu fabularnego", point.title);
  if (!title) return;
  const body = await askText("Opis punktu", point.body);
  point.title = title;
  point.body = body || "";
  render();
  saveSoon();
}

function addChapter() {
  const project = getProject();
  const chapter = {
    id: crypto.randomUUID(),
    title: `Rozdział ${project.chapters.length + 1}`,
    scenes: []
  };
  project.chapters.push(chapter);
  addScene(chapter.id);
}

function addScene(chapterId) {
  const chapter = getProject().chapters.find((item) => item.id === chapterId);
  const scene = {
    id: crypto.randomUUID(),
    title: `Scena ${chapter.scenes.length + 1}`,
    text: "",
    synopsis: "",
    notes: ""
  };
  chapter.scenes.push(scene);
  activeSceneId = scene.id;
  activeView = "manuscript";
  activeDocumentTab = "manuscript";
  render();
  saveSoon();
}

function deleteCurrentScene() {
  const { project, chapter, scene } = getScene();
  if (project.chapters.reduce((sum, item) => sum + item.scenes.length, 0) <= 1) {
    alert("Nie można usunąć ostatniej sceny w projekcie.");
    return;
  }
  if (!confirm(`Usunąć scenę "${scene.title || "Bez tytułu"}"?`)) return;
  chapter.scenes = chapter.scenes.filter((item) => item.id !== scene.id);
  const nextScene = chapter.scenes[0] || project.chapters.flatMap((item) => item.scenes)[0];
  activeSceneId = nextScene.id;
  render();
  saveSoon();
}

async function askText(title, value = "") {
  el.dialogTitle.textContent = title;
  el.dialogInput.value = value;
  el.dialog.showModal();
  el.dialogInput.focus();
  el.dialogInput.select();
  const result = await new Promise((resolve) => {
    el.dialog.addEventListener("close", () => resolve(el.dialog.returnValue), { once: true });
  });
  return result === "ok" ? el.dialogInput.value.trim() : "";
}

function updateScene(field, value) {
  const { scene } = getScene();
  scene[field] = value;
  renderBinder();
  renderSheetList();
  renderBoard();
  renderEditorMetaOnly();
  saveSoon();
}

function renderEditorMetaOnly() {
  const { project, scene } = getScene();
  const total = projectWordCount(project);
  const goal = Number(project.goal) || 0;
  el.wordCount.textContent = `${countWords(scene.text)} słów`;
  el.goalProgress.value = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  el.goalLabel.textContent = `${total} / ${goal || "bez celu"}`;
}

function exportProject() {
  const project = getProject();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.replace(/[^\w-]+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importProject(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const project = JSON.parse(reader.result);
      if (!project.name || !Array.isArray(project.chapters)) throw new Error("Bad file");
      project.id ||= crypto.randomUUID();
      project.world ||= { characters: [], locations: [], ideas: [] };
      project.world.characters ||= [];
      project.world.locations ||= [];
      project.world.ideas ||= [];
      ensureProjectShape(project);
      state.projects.push(project);
      activeProjectId = project.id;
      activeSceneId = project.chapters[0]?.scenes[0]?.id;
      render();
      saveSoon();
    } catch {
      alert("Nie udało się wczytać projektu JSON.");
    }
  };
  reader.readAsText(file);
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-google-identity]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Nie udało się wczytać logowania Google."));
    document.head.append(script);
  });
}

async function getDriveToken() {
  const sync = JSON.parse(localStorage.getItem(SYNC_KEY) || "{}");
  const clientId = sync.googleClientId || el.googleClientId.value.trim();
  if (!clientId) throw new Error("Najpierw wpisz Google OAuth Client ID i zapisz ustawienia.");
  await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.access_token);
      }
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function driveRequest(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Drive API error ${response.status}`);
  }
  return response;
}

async function findDriveStateFile(accessToken) {
  const query = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)&pageSize=1`;
  const response = await driveRequest(accessToken, url);
  const data = await response.json();
  return data.files?.[0] || null;
}

function buildMultipartBody(metadata, content) {
  const boundary = `story_desk_${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    content,
    `--${boundary}--`
  ].join("\r\n");
  return { boundary, body };
}

async function uploadStateToDrive() {
  try {
    saveSoon();
    el.syncStatus.textContent = "Logowanie do Google...";
    const accessToken = await getDriveToken();
    el.syncStatus.textContent = "Szukanie pliku synchronizacji w Drive...";
    const existing = await findDriveStateFile(accessToken);
    const content = JSON.stringify({ ...state, syncedAt: new Date().toISOString() }, null, 2);
    const metadata = existing ? { name: DRIVE_FILE_NAME } : { name: DRIVE_FILE_NAME, parents: ["appDataFolder"] };
    const multipart = buildMultipartBody(metadata, content);
    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    await driveRequest(accessToken, url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${multipart.boundary}` },
      body: multipart.body
    });
    el.syncStatus.textContent = "Wysłano do Google Drive.";
  } catch (error) {
    el.syncStatus.textContent = `Nie udało się wysłać do Drive: ${error.message}`;
  }
}

async function downloadStateFromDrive() {
  try {
    el.syncStatus.textContent = "Logowanie do Google...";
    const accessToken = await getDriveToken();
    const existing = await findDriveStateFile(accessToken);
    if (!existing) {
      el.syncStatus.textContent = "Nie znaleziono jeszcze pliku Story Desk w Google Drive. Najpierw wyślij dane z jednego urządzenia.";
      return;
    }
    el.syncStatus.textContent = "Pobieranie projektu z Drive...";
    const response = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`);
    const downloaded = await response.json();
    if (!Array.isArray(downloaded.projects) || !downloaded.projects.length) throw new Error("Plik Drive nie wygląda jak projekt Story Desk.");
    downloaded.projects.forEach(ensureProjectShape);
    state = downloaded;
    activeProjectId = state.activeProjectId || state.projects[0].id;
    activeSceneId = state.activeSceneId || state.projects[0].chapters[0]?.scenes[0]?.id;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    el.syncStatus.textContent = "Pobrano z Google Drive.";
  } catch (error) {
    el.syncStatus.textContent = `Nie udało się pobrać z Drive: ${error.message}`;
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    activeView = tab.dataset.view;
    activeDocumentTab = activeView;
    render();
  });
});

document.querySelectorAll(".document-tab[data-doc-view]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.docView;
    if (target === "new-scene") {
      addScene(getScene().chapter.id);
      return;
    }

    activeDocumentTab = target;
    if (target === "notes") {
      activeView = "manuscript";
      shouldFocusNotes = true;
    } else {
      activeView = target;
    }
    render();
  });
});

el.sidebarToggle.addEventListener("click", () => el.sidebar.classList.toggle("open"));
el.projectSelect.addEventListener("change", () => {
  activeProjectId = el.projectSelect.value;
  activeSceneId = getProject().chapters[0]?.scenes[0]?.id;
  render();
  saveSoon();
});
el.newProjectBtn.addEventListener("click", async () => {
  const name = await askText("Nazwa projektu", "Nowe opowiadanie");
  if (!name) return;
  const project = starterProject();
  project.name = name;
  state.projects.push(project);
  activeProjectId = project.id;
  activeSceneId = project.chapters[0].scenes[0].id;
  render();
  saveSoon();
});
el.renameProjectBtn.addEventListener("click", async () => {
  const project = getProject();
  const name = await askText("Nazwa projektu", project.name);
  if (!name) return;
  project.name = name;
  render();
  saveSoon();
});
el.addChapterBtn.addEventListener("click", addChapter);
el.addSceneBtn.addEventListener("click", () => addScene(getScene().chapter.id));
el.addSceneBoardBtn.addEventListener("click", () => addScene(getScene().chapter.id));
el.addPlotLineBtn.addEventListener("click", addPlotLine);
el.addPlotPointBtn.addEventListener("click", () => {
  const project = getProject();
  ensureProjectShape(project);
  addPlotPoint(project.plot.lines[0].id);
});
el.editorFont.addEventListener("change", (event) => {
  editorPrefs.font = event.target.value;
  saveEditorPrefs();
  applyEditorPrefs();
});
el.editorFontSize.addEventListener("input", (event) => {
  editorPrefs.size = event.target.value;
  saveEditorPrefs();
  applyEditorPrefs();
});
el.deleteSceneBtn.addEventListener("click", deleteCurrentScene);
el.sceneTitle.addEventListener("input", (event) => updateScene("title", event.target.value));
el.sceneText.addEventListener("input", (event) => updateScene("text", event.target.value));
el.sceneSynopsis.addEventListener("input", (event) => updateScene("synopsis", event.target.value));
el.sceneNotes.addEventListener("input", (event) => updateScene("notes", event.target.value));
el.projectGoal.addEventListener("input", (event) => {
  getProject().goal = Number(event.target.value) || 0;
  renderEditorMetaOnly();
  saveSoon();
});
el.exportBtn.addEventListener("click", exportProject);
el.importInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importProject(file);
  event.target.value = "";
});
document.querySelectorAll("[data-add-world]").forEach((button) => {
  button.addEventListener("click", async () => {
    const type = button.dataset.addWorld;
    const name = await askText("Nazwa", "");
    if (!name) return;
    const body = await askText("Opis", "");
    getProject().world[type].push({ id: crypto.randomUUID(), name, body });
    render();
    saveSoon();
  });
});
el.saveSyncSettings.addEventListener("click", () => {
  localStorage.setItem(SYNC_KEY, JSON.stringify({ googleClientId: el.googleClientId.value.trim() }));
  el.syncStatus.textContent = "Ustawienia zapisane. Możesz użyć przycisków Google Drive po skonfigurowaniu OAuth w Google Cloud.";
});
el.driveUploadBtn.addEventListener("click", uploadStateToDrive);
el.driveDownloadBtn.addEventListener("click", downloadStateFromDrive);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
saveSoon();

