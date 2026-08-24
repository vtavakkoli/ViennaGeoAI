(() => {
  "use strict";

  const VIENNA_CENTER = [48.2082, 16.3738];
  const state = {
    selectedPoint: null,
    selectionLayer: null,
    resultLayer: null,
    activeCollections: new Set(),
    collections: [],
    history: [],
    busy: false,
  };

  const map = L.map("map", { zoomControl: true, preferCanvas: true }).setView(VIENNA_CENTER, 12);

  const viennaBase = L.tileLayer(
    "https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png",
    {
      maxZoom: 19,
      attribution: "© basemap.at · Stadt Wien",
    },
  );
  const osmBase = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  });
  viennaBase.addTo(map);
  L.control.layers({ "Vienna basemap": viennaBase, OpenStreetMap: osmBase }, null, {
    position: "bottomleft",
  }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  const $ = (id) => document.getElementById(id);
  const messages = $("messages");
  const input = $("chat-input");
  const sendButton = $("send-button");

  function bboxArray() {
    const bounds = map.getBounds();
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
      .map((value) => Number(value.toFixed(6)));
  }

  function mapContext() {
    return {
      bbox: bboxArray(),
      zoom: map.getZoom(),
      visible_collections: [...state.activeCollections],
      selected_point: state.selectedPoint
        ? [Number(state.selectedPoint.lng.toFixed(6)), Number(state.selectedPoint.lat.toFixed(6))]
        : null,
    };
  }

  function updateContextLabel() {
    const bounds = map.getBounds();
    const pointText = state.selectedPoint
      ? ` · point ${state.selectedPoint.lat.toFixed(4)}, ${state.selectedPoint.lng.toFixed(4)}`
      : "";
    $("context-label").textContent = `Zoom ${map.getZoom()} · ${bounds.getCenter().lat.toFixed(3)}, ${bounds.getCenter().lng.toFixed(3)}${pointText}`;
  }

  function selectPoint(latlng, label = "Selected point") {
    state.selectedPoint = latlng;
    if (state.selectionLayer) map.removeLayer(state.selectionLayer);
    state.selectionLayer = L.circleMarker(latlng, {
      radius: 9,
      weight: 3,
      color: "#ffffff",
      fillColor: "#b7193f",
      fillOpacity: 1,
    }).addTo(map);
    state.selectionLayer.bindTooltip(label, { direction: "top", offset: [0, -6] }).openTooltip();
    $("selection-label").textContent = `${label}: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    updateContextLabel();
  }

  map.on("click", (event) => selectPoint(event.latlng));
  map.on("moveend zoomend", updateContextLabel);
  updateContextLabel();

  function addMessage(role, text, toolExecutions = []) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : "ViennaGeoAI";

    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = text;

    wrapper.append(label, body);
    if (toolExecutions.length) {
      const tools = document.createElement("div");
      tools.className = "tool-summary";
      tools.textContent = toolExecutions.map((item) => item.summary).join(" · ");
      wrapper.appendChild(tools);
    }
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
    return wrapper;
  }

  function addError(text) {
    const node = addMessage("assistant", text);
    node.classList.add("error-message");
  }

  function setBusy(value) {
    state.busy = value;
    sendButton.disabled = value;
    input.disabled = value;
    sendButton.textContent = value ? "Working…" : "Ask ViennaGeoAI →";
  }

  function featureTitle(feature) {
    const props = feature.properties || {};
    return props.NAME
      || props.TYP_DETAIL
      || props.ART_TXT
      || props.BASIS_TYP_TXT
      || props.STANDORT
      || props.ADRESSE
      || String(feature.id || "Vienna feature");
  }

  function popupContent(feature) {
    const props = feature.properties || {};
    const container = document.createElement("div");
    const title = document.createElement("div");
    title.className = "popup-title";
    title.textContent = featureTitle(feature);
    container.appendChild(title);

    Object.entries(props)
      .filter(([key, value]) => value !== null && value !== "" && key !== "NAME")
      .slice(0, 8)
      .forEach(([key, value]) => {
        const row = document.createElement("div");
        row.className = "popup-row";
        row.textContent = `${key}: ${String(value)}`;
        container.appendChild(row);
      });
    return container;
  }

  function renderFeatures(featureCollection, { fit = true } = {}) {
    if (state.resultLayer) map.removeLayer(state.resultLayer);
    const features = featureCollection?.features || [];
    if (!features.length) {
      state.resultLayer = null;
      $("result-count").textContent = "0 mapped features";
      return;
    }

    state.resultLayer = L.geoJSON(featureCollection, {
      pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
        radius: 6,
        weight: 2,
        color: "#ffffff",
        fillColor: "#1f6f8b",
        fillOpacity: 0.9,
      }),
      style: {
        color: "#1f6f8b",
        weight: 3,
        fillColor: "#1f6f8b",
        fillOpacity: 0.16,
      },
      onEachFeature: (feature, layer) => layer.bindPopup(popupContent(feature)),
    }).addTo(map);

    $("result-count").textContent = `${features.length} mapped feature${features.length === 1 ? "" : "s"}`;
    const bounds = state.resultLayer.getBounds();
    if (fit && bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
  }

  function clearMapResults() {
    if (state.resultLayer) map.removeLayer(state.resultLayer);
    if (state.selectionLayer) map.removeLayer(state.selectionLayer);
    state.resultLayer = null;
    state.selectionLayer = null;
    state.selectedPoint = null;
    state.activeCollections.clear();
    document.querySelectorAll(".layer-button").forEach((node) => node.classList.remove("active"));
    $("selection-label").textContent = "No point selected";
    $("result-count").textContent = "0 mapped features";
    updateContextLabel();
  }

  async function loadCollections() {
    const list = $("layer-list");
    list.innerHTML = '<span class="muted">Loading layers…</span>';
    try {
      const response = await fetch("/collections");
      if (!response.ok) throw new Error(`Collections request failed (${response.status})`);
      const data = await response.json();
      state.collections = data.collections || [];
      list.replaceChildren();
      state.collections.forEach((collection) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "layer-button";
        button.dataset.collectionId = collection.id;
        button.textContent = collection.title;
        button.title = collection.description || collection.id;
        button.addEventListener("click", () => loadLayer(collection.id, button));
        list.appendChild(button);
      });
      if (!state.collections.length) list.innerHTML = '<span class="muted">No configured collections.</span>';
    } catch (error) {
      list.innerHTML = `<span class="muted">${error.message}</span>`;
    }
  }

  async function loadLayer(collectionId, button) {
    button.disabled = true;
    try {
      const bbox = bboxArray().join(",");
      const response = await fetch(`/collections/${encodeURIComponent(collectionId)}/items?bbox=${encodeURIComponent(bbox)}&limit=500`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `Layer request failed (${response.status})`);
      state.activeCollections.clear();
      state.activeCollections.add(collectionId);
      document.querySelectorAll(".layer-button").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      renderFeatures(data, { fit: false });
    } catch (error) {
      addError(`Could not load this layer: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  async function checkStatus() {
    try {
      const health = await fetch("/health");
      $("api-dot").classList.toggle("ok", health.ok);
    } catch (_error) {
      $("api-dot").classList.remove("ok");
    }

    try {
      const response = await fetch("/api/ai/status");
      const status = await response.json();
      $("ai-dot").classList.toggle("ok", Boolean(status.available));
      $("ai-dot").classList.toggle("warn", !status.available);
      $("model-label").textContent = status.model || "Ollama";
    } catch (_error) {
      $("ai-dot").classList.add("warn");
      $("model-label").textContent = "Ollama unavailable";
    }
  }

  async function ask(message) {
    const text = message.trim();
    if (!text || state.busy) return;

    addMessage("user", text);
    const priorHistory = state.history.slice(-16);
    setBusy(true);
    const typing = addMessage("assistant", "Querying the map and geospatial tools…");
    typing.classList.add("typing");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: priorHistory,
          map_context: mapContext(),
        }),
      });
      const data = await response.json();
      typing.remove();
      if (!response.ok) throw new Error(data.detail || `AI request failed (${response.status})`);

      addMessage("assistant", data.answer, data.tool_executions || []);
      state.history.push({ role: "user", content: text }, { role: "assistant", content: data.answer });
      state.history = state.history.slice(-20);
      if (data.feature_collection) renderFeatures(data.feature_collection);
    } catch (error) {
      typing.remove();
      addError(`${error.message}. Check that local Ollama is running and that gemma4:31b-cloud is available to your Ollama account.`);
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  $("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value;
    input.value = "";
    ask(text);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("chat-form").requestSubmit();
    }
  });

  $("quick-prompts").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-prompt]");
    if (!button) return;
    if (button.dataset.prompt.includes("selected point") && !state.selectedPoint) {
      selectPoint(map.getCenter(), "Map center");
    }
    ask(button.dataset.prompt);
  });

  $("clear-button").addEventListener("click", clearMapResults);
  $("refresh-layers").addEventListener("click", loadCollections);
  $("locate-button").addEventListener("click", () => {
    if (!navigator.geolocation) {
      addError("Browser geolocation is not available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
        map.setView(latlng, 15);
        selectPoint(latlng, "Your location");
      },
      (error) => addError(`Could not use your location: ${error.message}`),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });

  Promise.all([loadCollections(), checkStatus()]);
})();
