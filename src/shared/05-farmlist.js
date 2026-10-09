// ═══════════════════════════════════════════════════════════
// src/shared/05-farmlist.js — farm-list-v1 export primitives.
// The *builder* (`buildFarmListV1`) stays inside each plugin (it reads
// plugin DOM/state); only the generic document + target shapes live here.
// Key order and values must stay exactly as they were in v1.5.1.
// ═══════════════════════════════════════════════════════════

function _sharedBuildFarmListTarget(entry, troops) {
    return {
        name: _sharedCleanVillageName(entry.village),
        x: entry.x,
        y: entry.y,
        distance: entry.distance != null ? Math.round(entry.distance) : null,
        troops: { ...troops },
        heroFollow: false,
    };
}

function _sharedBuildFarmListDocument(listName, troops, targets) {
    return {
        _format: "farm-list-v1",
        _exported: Date.now(),
        list: {
            name: listName,
            troops: { ...troops },
            heroFollow: false,
            targets,
        },
    };
}
