Cesium.Ion.defaultAccessToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNGViYmM2OS0yOWY1LTQ4YzMtOTczMS1hMzY4NDE0YTA3ZWUiLCJpZCI6MzI5NjUzLCJpYXQiOjE3NTQ1NTQ1ODV9.x5fgneoR7V-JK7dLUIJVZ0Nxsnlp3xYTfiIbJ2EE8-M';

// STEP 1 — Create Viewer with terrain
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  baseLayerPicker: true,
  geocoder: false,
  timeline: false,
  animation: false
});

// STEP 2 — Fly to Hatfield Campus
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(28.2314, -25.7550, 300),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-35)
  }
});

// We'll keep a reference to the buildings datasource so the UI can filter & search it.
let buildingsDataSource = null;

// STEP 3 — Load 3D Buildings with Height
Cesium.GeoJsonDataSource.load("Buildings.geojson").then((dataSource) => {
  buildingsDataSource = dataSource;               // <-- captured here
  viewer.dataSources.add(dataSource);

  const entities = dataSource.entities.values;
  for (let entity of entities) {
    if (entity.polygon) {
      const height = entity.properties && entity.properties.Height
        ? entity.properties.Height.getValue()
        : 10;

      entity.polygon.height = 0;
      entity.polygon.extrudedHeight = height;
      entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
      entity.polygon.extrudedHeightReference =
        Cesium.HeightReference.RELATIVE_TO_GROUND;
      
      entity.polygon.material = Cesium.Color.ORANGE.withAlpha(1.0);
      entity.polygon.outline = true;
      entity.polygon.outlineColor = Cesium.Color.BLACK;
    }
  }
});

// STEP 4 — Load remaining 2D layers and Lights as 3D models
const otherLayers = [
  "Main road.geojson",
  "paths.geojson",
  "Green spaces.geojson",
  "Lights.geojson",
  "Entrance.geojson",
  
];

for (const file of otherLayers) {
  Cesium.GeoJsonDataSource.load(file, { clampToGround: true })
    .then((dataSource) => {
      const entities = dataSource.entities.values;

      if (file === "Main road.geojson") {
        for (let entity of entities) {
          if (entity.polyline) {
            entity.polyline.clampToGround = true;
            entity.polyline.width = 6;
            entity.polyline.material = Cesium.Color.BLACK;
          }
        }
      }

      if (file === "paths.geojson") {
        for (let entity of entities) {
          if (entity.polyline) {
            entity.polyline.clampToGround = true;
            entity.polyline.width = 3;
            entity.polyline.material = new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.YELLOW,
            });
          }
        }
      }

      if (file === "Lights.geojson") {
        for (let entity of entities) {
          if (entity.position) {
            // 🔹 Remove default Cesium blue markers and labels
            entity.billboard = undefined;
            entity.label = undefined;
      
            // 🔹 Remove the default point symbol
            entity.point = undefined;
      
            // 🔹 Add the GLTF model instead
            entity.model = new Cesium.ModelGraphics({
              uri: "./street_lamp_gltf/scene.gltf",  // make sure path is correct
              minimumPixelSize: 50,                  // ensures visibility from far
              maximumScale: 200,                     // prevents over-scaling
              scale: 1.0,                            // adjust size if needed
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            });
          }
        }
      }
      

      if (file === "Entrance.geojson") {
        for (let entity of entities) {
          if (entity.position) {
            entity.point = new Cesium.PointGraphics({
              pixelSize: 6,
              color: Cesium.Color.RED,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            });
          }
        }
      }

      viewer.dataSources.add(dataSource);
    });
}

/* =========================
   Filter UI behavior
   ========================= */

const clinicNames = ["Natural Science 2", "Student Health Service"];
const mentalNames = ["Student Mental"];

function getEntityName(entity) {
  try {
    if (!entity.properties) return null;
    if (entity.properties.Name) {
      const val = entity.properties.Name.getValue();
      return typeof val === "string" ? val : String(val);
    }
    if (entity.name) return entity.name;
  } catch (e) {
    return null;
  }
  return null;
}

function showOnlyMatching(namesArray) {
  if (!buildingsDataSource) return;
  const ents = buildingsDataSource.entities.values;
  for (let ent of ents) {
    if (!ent.polygon) continue;
    const nm = getEntityName(ent);
    ent.show = nm && namesArray.includes(nm);
  }
}

function resetShowAll() {
  if (!buildingsDataSource) return;
  const ents = buildingsDataSource.entities.values;
  for (let ent of ents) {
    if (ent.polygon) ent.show = true;
  }
}

const fab = document.getElementById("filterFab");
const panel = document.getElementById("filterPanel");
const panelClose = document.getElementById("panelClose");
const clinicBtn = document.getElementById("clinicBtn");
const mentalBtn = document.getElementById("mentalBtn");
const resetBtn = document.getElementById("resetBtn");

fab.addEventListener("click", () => {
  panel.classList.toggle("open");
  panel.setAttribute("aria-hidden", panel.classList.contains("open") ? "false" : "true");
});
panelClose.addEventListener("click", () => {
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
});
clinicBtn.addEventListener("click", () => {
  showOnlyMatching(clinicNames);
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
});
mentalBtn.addEventListener("click", () => {
  showOnlyMatching(mentalNames);
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
});
resetBtn.addEventListener("click", () => {
  resetShowAll();
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
});
document.addEventListener("click", (e) => {
  const target = e.target;
  if (!panel.contains(target) && !fab.contains(target)) {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }
});

/* =========================
   Search behavior
   ========================= */

const searchInput = document.getElementById("searchInput");
const searchGo = document.getElementById("searchGo");
const searchHint = document.getElementById("searchHint");

function showSearchMessage(text, timeout = 3000) {
  searchHint.textContent = text;
  searchHint.style.display = "block";
  clearTimeout(showSearchMessage._t);
  showSearchMessage._t = setTimeout(() => {
    searchHint.style.display = "none";
  }, timeout);
}

function findBuildingByName(query) {
  if (!buildingsDataSource) return null;
  const ents = buildingsDataSource.entities.values;
  const q = String(query || "").trim();
  if (!q) return null;

  for (let ent of ents) {
    if (!ent.polygon) continue;
    const nm = getEntityName(ent);
    if (nm && nm.toLowerCase() === q.toLowerCase()) return ent;
  }

  for (let ent of ents) {
    if (!ent.polygon) continue;
    const nm = getEntityName(ent);
    if (nm && nm.toLowerCase().includes(q.toLowerCase())) return ent;
  }

  return null;
}

function flyToEntityTopDown(entity) {
  if (!entity) return;
  try { entity.show = true; } catch (e) {}

  let range = 80;
  try {
    const bs = Cesium.BoundingSphere.fromBoundingSpheres([entity.computeBoundingSphere ? entity.computeBoundingSphere() : null].filter(Boolean));
    if (bs && bs.radius) range = Math.max(40, bs.radius * 1.8);
  } catch (e) { range = 80; }

  viewer.flyTo(entity, {
    duration: 1.6,
    offset: new Cesium.HeadingPitchRange(
      0.0,
      Cesium.Math.toRadians(-90.0),
      range
    )
  }).otherwise((err) => {
    try {
      const cart = entity.position ? entity.position.getValue(Cesium.JulianDate.now()) : null;
      if (cart) {
        viewer.camera.flyTo({
          destination: new Cesium.Cartesian3(cart.x, cart.y, cart.z + range),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90) },
          duration: 1.2
        });
      }
    } catch (e) {}
  });
}

function performSearch() {
  const q = searchInput.value.trim();
  if (!q) {
    showSearchMessage("Type a building name to search.");
    return;
  }
  if (!buildingsDataSource) {
    showSearchMessage("Buildings not loaded yet — please wait a moment.");
    return;
  }
  const found = findBuildingByName(q);
  if (!found) {
    showSearchMessage(`No building found for "${q}". Try another name.`);
    return;
  }
  try { found.show = true; } catch (e) {}
  flyToEntityTopDown(found);
  showSearchMessage(`Flying to: ${getEntityName(found)}`, 2000);
}

searchGo.addEventListener("click", performSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    performSearch();
  }
});
searchInput.addEventListener("focus", () => {
  searchHint.style.display = "none";
});
// Emergency Panic Button - show emergency numbers
// Panic Button Panel
const panicBtn = document.getElementById("panicBtn");
const panicPanel = document.getElementById("panicPanel");
const panicClose = document.getElementById("panicClose");

panicBtn.addEventListener("click", () => {
  panicPanel.style.display = panicPanel.style.display === "block" ? "none" : "block";
  panicPanel.setAttribute("aria-hidden", panicPanel.style.display === "none" ? "true" : "false");
});

panicClose.addEventListener("click", () => {
  panicPanel.style.display = "none";
  panicPanel.setAttribute("aria-hidden", "true");
});

// Optional: close panel if user clicks outside
document.addEventListener("click", (e) => {
  if (!panicPanel.contains(e.target) && e.target !== panicBtn) {
    panicPanel.style.display = "none";
    panicPanel.setAttribute("aria-hidden", "true");
  }
});
// Store references to your loaded data sources
const layerMap = {
  "Buildings": buildingsDataSource,
  "Main road": null,
  "paths": null,
  "Green spaces": null,
  "Lights": null,
  "Entrance": null
};

// Fill layerMap with the actual loaded data sources
viewer.dataSources._dataSources.forEach(ds => {
  if (ds.name) {
    if (ds.name.includes("Main road")) layerMap["Main road"] = ds;
    if (ds.name.includes("paths")) layerMap["paths"] = ds;
    if (ds.name.includes("Green spaces")) layerMap["Green spaces"] = ds;
    if (ds.name.includes("Lights")) layerMap["Lights"] = ds;
    if (ds.name.includes("Entrance")) layerMap["Entrance"] = ds;
  }
});

// Legend click logic
const legendItems = document.querySelectorAll("#legend li");

legendItems.forEach(item => {
  item.addEventListener("click", () => {
    const layerName = item.getAttribute("data-layer");

    // Show only the clicked layer, hide the rest
    Object.keys(layerMap).forEach(name => {
      const ds = layerMap[name];
      if (!ds) return;
      ds.show = (name === layerName);
    });
  });
});

const locBtn = document.getElementById("locBtn");

let userLocation = null;
let watchId = null;

// ✅ Request location permission immediately when page loads
window.addEventListener("load", () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("Location permission granted.");
        console.log("Lat:", pos.coords.latitude, "Lon:", pos.coords.longitude);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        alert("Please allow location access for this app to work.");
      },
      { enableHighAccuracy: true }
    );
  } else {
    alert("Geolocation not supported in this browser.");
  }
});

locBtn.addEventListener("click", () => {

  if (!("geolocation" in navigator)) {
    alert("Geolocation not supported in this browser.");
    return;
  }

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    alert("Live location tracking stopped.");
    return;
  }

  // ✅ Start live tracking
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lon = pos.coords.longitude;
      const lat = pos.coords.latitude;

      // ✅ Create the entity only after first geolocation
      if (!userLocation) {
        userLocation = viewer.entities.add({
          name: "My Location",
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          billboard: {
            image: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
            width: 40,
            height: 40,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });

        // Fly camera to first location
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 300),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45) },
          duration: 1.0,
        });
      } else {
        // Update existing entity
        userLocation.position = Cesium.Cartesian3.fromDegrees(lon, lat);

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 300),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45) },
          duration: 0.8,
        });
      }

    },
    (err) => {
      console.warn("Geolocation error:", err);
      alert("Unable to access your location. Check permissions.");
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
  );

  alert("Live location tracking started.");
});


