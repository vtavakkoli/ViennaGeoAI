(() => {
  "use strict";

  const VIENNA_CENTER = [48.2082, 16.3738];
  const LAYER_META = {
    playgrounds: {
      color: "#e11d48",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V9m14 11V9M4 9h16M8 9V5h8v4M9 13l-3 7m9-7 3 7M8 16h8"/></svg>',
    },
    schools: {
      color: "#7c3aed",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12.5V17c3 2.2 7 2.2 10 0v-4.5M21 9v6"/></svg>',
    },
    bicycle_parking: {
      color: "#059669",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="m6 16 4-7h4l4 7M9 9l3 7m-4-9h3"/></svg>',
    },
    drinking_fountains: {
      color: "#2563eb",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s5 6.1 5 10a5 5 0 1 1-10 0c0-3.9 5-10 5-10Z"/><path d="M9.5 14.2c.6 1.5 1.6 2.2 3.1 2.2"/></svg>',
    },
    swimming_pools: {
      color: "#0891b2",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 2-2M3 13c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 2-2M3 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 2-2"/></svg>',
    },
  };

  const state = {
    selectedPoint: null,
    selectionLayer: null,
    resultLayer: null,
    resultFeatureCount: 0,
    layerLayers: new Map(),
    layerFeatureCounts: new Map(),
    activeCollections: new Set(),
    collections: [],
    history: [],
    busy: false,
  };

  const $ = (id) => document.getElementById(id);
  const messages = $("messages");
  const input = $("chat-input");
  const sendButton = $("send-button");

  const map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
    attributionControl: true,
  }).setView(VIENNA_CENTER, 12);

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

  function updateMapContextUi() {
    const center = map.getCenter();
    const pointText = state.selectedPoint
      ? ` · point ${state.selectedPoint.lat.toFixed(4)}, ${state.selectedPoint.lng.toFixed(4)}`
      : "";
    $("context-label").textContent = `Zoom ${map.getZoom()} · ${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}${pointText}`;
    $("map-position").textContent = `Zoom ${map.getZoom()} · ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;

    const pill = $("point-context-pill");
    if (state.selectedPoint) {
      pill.classList.add("ready");
      pill.lastChild.textContent = ` ${state.selectedPoint.lat.toFixed(4)}, ${state.selectedPoint.lng.toFixed(4)}`;
    } else {
      pill.classList.remove("ready");
      pill.lastChild.textContent = " No point selected";
    }
  }

  function updateMappedCount() {
    const officialCount = [...state.layerFeatureCounts.values()].reduce((sum, value) => sum + value, 0);
    const total = officialCount + state.resultFeatureCount;
    const details = [];
    if (officialCount) details.push(`${officialCount} layer`);
    if (state.resultFeatureCount) details.push(`${state.resultFeatureCount} AI result`);
    $("result-count").textContent = total
      ? `${total} features${details.length ? ` · ${details.join(" + ")}` : ""}`
      : "0 features";
    const layerCount = state.activeCollections.size;
    $("active-layer-count").textContent = `${layerCount} active layer${layerCount === 1 ? "" : "s"}`;
  }

  function selectPoint(latlng, label = "Selected point") {
    state.selectedPoint = latlng;
    if (state.selectionLayer) map.removeLayer(state.selectionLayer);
    state.selectionLayer = L.circleMarker(latlng, {
      radius: 9,
      weight: 3,
      color: "#ffffff",
      fillColor: "#be123c",
      fillOpacity: 1,
    }).addTo(map);
    state.selectionLayer.bindTooltip(label, {
      direction: "top",
      offset: [0, -6],
      opacity: 0.95,
    }).openTooltip();
    $("selection-label").textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    updateMapContextUi();
  }

  map.on("click", (event) => selectPoint(event.latlng));
  map.on("moveend zoomend", updateMapContextUi);
  updateMapContextUi();

  function addMessage(role, text, toolExecutions = []) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;

    if (role !== "user") {
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      const image = document.createElement("img");
      image.src = "/static/assets/favicon.svg";
      image.alt = "";
      avatar.appendChild(image);
      wrapper.appendChild(avatar);
    }

    const content = document.createElement("div");
    content.className = "message-content";
    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : "ViennaGeoAI";
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = text;
    content.append(label, body);

    if (toolExecutions.length) {
      const tools = document.createElement("div");
      tools.className = "tool-summary";
      tools.textContent = toolExecutions
        .map((item) => item.summary || item.tool || "geospatial tool")
        .join(" · ");
      content.appendChild(tools);
    }

    wrapper.appendChild(content);
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
    $("chat-form").setAttribute("aria-busy", String(value));
    sendButton.title = value ? "Querying Vienna data…" : "Ask ViennaGeoAI";
  }

  async function readApiResponse(response) {
    const text = await response.text();
    if (!text) return {};
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      try {
        return JSON.parse(text);
      } catch (_error) {
        throw new Error(`Server returned malformed JSON (${response.status})`);
      }
    }
    if (!response.ok) return { detail: text.trim() || `Request failed (${response.status})` };
    try {
      return JSON.parse(text);
    } catch (_error) {
      return { detail: text.trim() };
    }
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

  function styleForCollection(collectionId) {
    return LAYER_META[collectionId]?.color || "#475569";
  }

  function makeGeoJsonLayer(featureCollection, collectionId, { aiResult = false } = {}) {
    const color = aiResult ? "#be123c" : styleForCollection(collectionId);
    return L.geoJSON(featureCollection, {
      pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
        radius: aiResult ? 7 : 5.5,
        weight: 2,
        color: "#ffffff",
        fillColor: color,
        fillOpacity: 0.92,
      }),
      style: {
        color,
        weight: aiResult ? 3 : 2,
        fillColor: color,
        fillOpacity: aiResult ? 0.16 : 0.10,
      },
      onEachFeature: (feature, layer) => layer.bindPopup(popupContent(feature)),
    });
  }

  function renderAiFeatures(featureCollection, { fit = true } = {}) {
    if (state.resultLayer) map.removeLayer(state.resultLayer);
    const features = featureCollection?.features || [];
    state.resultFeatureCount = features.length;
    if (!features.length) {
      state.resultLayer = null;
      updateMappedCount();
      return;
    }

    state.resultLayer = makeGeoJsonLayer(featureCollection, "ai", { aiResult: true }).addTo(map);
    updateMappedCount();
    const bounds = state.resultLayer.getBounds();
    if (fit && bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
  }

  function removeOfficialLayers() {
    state.layerLayers.forEach((layer) => map.removeLayer(layer));
    state.layerLayers.clear();
    state.layerFeatureCounts.clear();
    state.activeCollections.clear();
    document.querySelectorAll(".layer-button").forEach((node) => node.classList.remove("active"));
  }

  function clearMapResults() {
    if (state.resultLayer) map.removeLayer(state.resultLayer);
    if (state.selectionLayer) map.removeLayer(state.selectionLayer);
    removeOfficialLayers();
    state.resultLayer = null;
    state.resultFeatureCount = 0;
    state.selectionLayer = null;
    state.selectedPoint = null;
    $("selection-label").textContent = "None";
    updateMappedCount();
    updateMapContextUi();
  }

  function collectionSubtitle(collection) {
    const provider = String(collection.provider || "wfs").toUpperCase();
    return `${provider} · official Vienna source`;
  }

  function renderLayerButtons(filter = "") {
    const list = $("layer-list");
    const query = filter.trim().toLowerCase();
    const collections = state.collections.filter((collection) => {
      const haystack = `${collection.title || ""} ${collection.description || ""} ${collection.id}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    list.replaceChildren();
    collections.forEach((collection) => {
      const meta = LAYER_META[collection.id] || {
        color: "#475569",
        icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 4l8 3.5L12 11 4 7.5Zm0 4.5 8 3.5 8-3.5M4 16.5l8 3.5 8-3.5"/></svg>',
      };
      const button = document.createElement("button");
      button.type = "button";
      button.className = "layer-button";
      button.dataset.collectionId = collection.id;
      button.style.setProperty("--layer-color", meta.color);
      button.title = collection.description || collection.id;
      button.setAttribute("aria-pressed", state.activeCollections.has(collection.id) ? "true" : "false");
      if (state.activeCollections.has(collection.id)) button.classList.add("active");

      const icon = document.createElement("span");
      icon.className = "layer-icon";
      icon.innerHTML = meta.icon;
      const copy = document.createElement("span");
      copy.className = "layer-copy";
      const title = document.createElement("strong");
      title.textContent = collection.title;
      const subtitle = document.createElement("span");
      subtitle.textContent = collectionSubtitle(collection);
      copy.append(title, subtitle);
      const toggle = document.createElement("span");
      toggle.className = "layer-toggle";
      toggle.setAttribute("aria-hidden", "true");
      button.append(icon, copy, toggle);
      button.addEventListener("click", () => toggleLayer(collection.id, button));
      list.appendChild(button);
    });

    if (!collections.length) {
      const empty = document.createElement("span");
      empty.className = "muted";
      empty.textContent = query ? "No matching Vienna layers." : "No configured collections.";
      list.appendChild(empty);
    }
  }

  async function loadCollections() {
    const list = $("layer-list");
    list.innerHTML = '<span class="muted">Loading Vienna layers…</span>';
    try {
      const response = await fetch("/collections");
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || `Collections request failed (${response.status})`);
      state.collections = data.collections || [];
      renderLayerButtons($("layer-search").value);
    } catch (error) {
      list.replaceChildren();
      const message = document.createElement("span");
      message.className = "muted";
      message.textContent = error.message;
      list.appendChild(message);
    }
  }

  async function toggleLayer(collectionId, button) {
    if (state.activeCollections.has(collectionId)) {
      const layer = state.layerLayers.get(collectionId);
      if (layer) map.removeLayer(layer);
      state.layerLayers.delete(collectionId);
      state.layerFeatureCounts.delete(collectionId);
      state.activeCollections.delete(collectionId);
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
      updateMappedCount();
      return;
    }

    button.disabled = true;
    try {
      const bbox = bboxArray().join(",");
      const response = await fetch(
        `/collections/${encodeURIComponent(collectionId)}/items?bbox=${encodeURIComponent(bbox)}&limit=500`,
      );
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.detail || `Layer request failed (${response.status})`);

      const existing = state.layerLayers.get(collectionId);
      if (existing) map.removeLayer(existing);
      const layer = makeGeoJsonLayer(data, collectionId).addTo(map);
      const count = data?.features?.length || 0;
      state.layerLayers.set(collectionId, layer);
      state.layerFeatureCounts.set(collectionId, count);
      state.activeCollections.add(collectionId);
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      updateMappedCount();
    } catch (error) {
      addError(`Vienna data layer could not be loaded: ${error.message}`);
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
      const status = await readApiResponse(response);
      const healthy = Boolean(response.ok && status.available);
      $("ai-dot").classList.toggle("ok", healthy);
      $("ai-dot").classList.toggle("warn", !healthy);
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
    const typing = addMessage("assistant", "Querying the current Vienna map context and official geospatial tools…");
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
      const data = await readApiResponse(response);
      typing.remove();
      if (!response.ok) throw new Error(data.detail || `ViennaGeoAI request failed (${response.status})`);

      addMessage("assistant", data.answer, data.tool_executions || []);
      state.history.push(
        { role: "user", content: text },
        { role: "assistant", content: data.answer },
      );
      state.history = state.history.slice(-20);
      if (data.feature_collection) renderAiFeatures(data.feature_collection);
    } catch (error) {
      typing.remove();
      addError(`Request failed: ${error.message}`);
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

  $("layer-search").addEventListener("input", (event) => renderLayerButtons(event.target.value));
  $("refresh-layers").addEventListener("click", loadCollections);
  $("clear-button").addEventListener("click", clearMapResults);
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

  updateMappedCount();
  Promise.all([loadCollections(), checkStatus()]);
})();
