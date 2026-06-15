import fs from 'fs';
import path from 'path';

// Tile IDs for TMJ (palette index + 1)
const T_GRASS = 1;
const T_STONE_WALL = 2;
const T_DIRT_PATH = 3;
const T_WATER_OLD = 4;
const T_DARK_GRASS = 5;
const T_SAND = 6;
const T_FLOWERS = 7;
const T_VOID = 8;
const T_WATER = 9;
const T_LH_STONE = 10;
const T_PATH_BEIGE = 11;
const T_BLDG_BROWN = 12;
const T_DOCK_WOOD = 13;
const T_TALL_GRASS = 14;
const T_ROCKY_GROUND = 15;
const T_ROCK_OBS = 16;
const T_FORGE_OCHRE = 17;
const T_HOT_STONE = 18;
const T_VOLCANIC_ROCK = 19;
const T_GYM_FLOOR = 20;
const T_BRAZIER = 21;

function createLayer(id, name, width, height, data, type = "tilelayer") {
  return {
    data,
    height,
    id,
    name,
    opacity: 1,
    type,
    visible: true,
    width,
    x: 0,
    y: 0
  };
}

function createObjectLayer(id, name, objects) {
  return {
    draworder: "topdown",
    id,
    name,
    objects,
    opacity: 1,
    type: "objectgroup",
    visible: true,
    x: 0,
    y: 0
  };
}

function createMap(width, height, layers) {
  return {
    compressionlevel: -1,
    height,
    infinite: false,
    layers,
    nextlayerid: 10,
    nextobjectid: 20,
    orientation: "orthogonal",
    renderorder: "right-down",
    tiledversion: "1.10.2",
    tileheight: 16,
    tilesets: [
      {
        columns: 24,
        firstgid: 1,
        image: "tiles.png",
        imageheight: 16,
        imagewidth: 384,
        margin: 0,
        name: "procedural",
        spacing: 0,
        tilecount: 24,
        tileheight: 16,
        tilewidth: 16
      }
    ],
    tilewidth: 16,
    type: "map",
    version: "1.10",
    width
  };
}

// -----------------------------------------------------------------------------
// MAP 1: MIREFALL VILLAGE
// -----------------------------------------------------------------------------
function buildMirefall() {
  const W = 20, H = 20;
  const ground = new Array(W * H).fill(T_GRASS);
  const collision = new Array(W * H).fill(0);
  const above = new Array(W * H).fill(0);

  // Helper to set tile
  const setTile = (arr, x, y, val) => arr[y * W + x] = val;
  const fillRect = (arr, x, y, w, h, val) => {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        setTile(arr, c, r, val);
      }
    }
  };

  // Water on left (col 0, row 0-12)
  fillRect(ground, 0, 0, 1, 13, T_WATER);
  fillRect(collision, 0, 0, 1, 13, T_WATER);

  // Dock (col 0-3, row 15-19)
  fillRect(ground, 0, 15, 4, 5, T_WATER);
  fillRect(ground, 1, 15, 3, 5, T_DOCK_WOOD); // Pier
  // Collision edges of dock
  fillRect(collision, 0, 15, 1, 5, T_WATER); // pure water

  // Lighthouse (col 2-4, row 1-5)
  fillRect(ground, 2, 1, 3, 5, T_LH_STONE);
  fillRect(collision, 2, 1, 3, 4, T_LH_STONE); // Leave bottom row clear for entrance

  // Lab (col 7-10, row 7-10)
  fillRect(ground, 7, 7, 4, 4, T_BLDG_BROWN);
  fillRect(collision, 7, 7, 4, 3, T_BLDG_BROWN); // Leave bottom row clear

  // Homes (col 14-19, row 8-16)
  fillRect(ground, 15, 8, 2, 2, T_BLDG_BROWN);
  fillRect(collision, 15, 8, 2, 1, T_BLDG_BROWN);
  fillRect(ground, 15, 12, 2, 2, T_BLDG_BROWN);
  fillRect(collision, 15, 12, 2, 1, T_BLDG_BROWN);

  // Paths
  fillRect(ground, 3, 6, 2, 14, T_PATH_BEIGE); // Path from lighthouse down
  fillRect(ground, 3, 11, 6, 2, T_PATH_BEIGE); // Path to lab
  fillRect(ground, 8, 11, 2, 9, T_PATH_BEIGE); // Path down to exit

  const objectsNpcs = [
    { id: 1, name: "KaelFather", x: 3 * 16, y: 5 * 16, properties: [{name: "dialogueId", type: "string", value: "kaels_father"}, {name: "facing", type: "string", value: "down"}] },
    { id: 2, name: "Aldwyn", x: 8 * 16, y: 10 * 16, properties: [{name: "dialogueId", type: "string", value: "aldwyn_mirefall"}, {name: "facing", type: "string", value: "down"}] },
    { id: 3, name: "Sable", x: 6 * 16, y: 10 * 16, properties: [{name: "dialogueId", type: "string", value: "sable_mirefall"}, {name: "facing", type: "string", value: "right"}] },
    { id: 4, name: "DockVillager", x: 2 * 16, y: 16 * 16, properties: [{name: "dialogueId", type: "string", value: "mirefall_villager_dock"}, {name: "facing", type: "string", value: "up"}] },
    { id: 5, name: "Elder", x: 14 * 16, y: 13 * 16, properties: [{name: "dialogueId", type: "string", value: "mirefall_elder"}, {name: "facing", type: "string", value: "left"}] }
  ];

  const objectsSpawns = [
    { id: 6, name: "PlayerSpawn", x: 5 * 16, y: 12 * 16 }
  ];

  const objectsMapExits = [
    { id: 7, name: "ToRoute2", x: 8 * 16, y: 19 * 16, width: 32, height: 16, properties: [
      {name: "targetMap", type: "string", value: "route2"},
      {name: "targetX", type: "int", value: 9},
      {name: "targetY", type: "int", value: 28},
      {name: "facing", type: "string", value: "up"}
    ]}
  ];

  const layers = [
    createLayer(1, "Ground", W, H, ground),
    createLayer(2, "Collision", W, H, collision),
    createObjectLayer(3, "NPCs", objectsNpcs),
    createObjectLayer(4, "TrainerTriggers", []),
    createObjectLayer(5, "Spawns", objectsSpawns),
    createLayer(6, "AbovePlayer", W, H, above),
    createObjectLayer(7, "MapExits", objectsMapExits)
  ];

  return createMap(W, H, layers);
}

// -----------------------------------------------------------------------------
// MAP 2: ROUTE 2
// -----------------------------------------------------------------------------
function buildRoute2() {
  const W = 20, H = 30;
  const ground = new Array(W * H).fill(T_GRASS);
  const collision = new Array(W * H).fill(0);
  
  const setTile = (arr, x, y, val) => arr[y * W + x] = val;
  const fillRect = (arr, x, y, w, h, val) => {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        setTile(arr, c, r, val);
      }
    }
  };

  // Central Path
  fillRect(ground, 7, 0, 4, 30, T_PATH_BEIGE);

  // Top rocky border
  fillRect(ground, 0, 0, 20, 2, T_ROCKY_GROUND);
  fillRect(collision, 0, 0, 7, 2, T_ROCK_OBS);
  fillRect(collision, 11, 0, 9, 2, T_ROCK_OBS);

  // Tall grass patches
  fillRect(ground, 3, 4, 4, 9, T_TALL_GRASS);
  fillRect(ground, 12, 4, 5, 9, T_TALL_GRASS);
  fillRect(ground, 4, 15, 10, 8, T_TALL_GRASS); // Wider grass area

  // Rocky outcroppings / boundaries
  fillRect(collision, 0, 2, 2, 28, T_ROCK_OBS);
  fillRect(collision, 18, 2, 2, 28, T_ROCK_OBS);
  fillRect(collision, 2, 10, 2, 4, T_ROCK_OBS); // rock near robin/joey

  const objectsNpcs = [
    { id: 1, name: "Sign", x: 8 * 16, y: 28 * 16, properties: [{name: "dialogueId", type: "string", value: "route2_sign"}, {name: "facing", type: "string", value: "up"}] },
    { id: 2, name: "Hiker", x: 3 * 16, y: 13 * 16, properties: [{name: "dialogueId", type: "string", value: "route2_hiker"}, {name: "facing", type: "string", value: "right"}] }
  ];

  const objectsTrainers = [
    { id: 3, name: "Joey", x: 8 * 16, y: 15 * 16, properties: [{name: "trainerId", type: "string", value: "joey"}, {name: "facing", type: "string", value: "down"}] },
    { id: 4, name: "Robin", x: 12 * 16, y: 10 * 16, properties: [{name: "trainerId", type: "string", value: "robin"}, {name: "facing", type: "string", value: "left"}] }
  ];

  const objectsExits = [
    { id: 5, name: "ToCinderpeak", x: 7 * 16, y: 0 * 16, width: 64, height: 16, properties: [
      {name: "targetMap", type: "string", value: "cinderpeak"},
      {name: "targetX", type: "int", value: 11},
      {name: "targetY", type: "int", value: 18},
      {name: "facing", type: "string", value: "up"}
    ]},
    { id: 6, name: "ToMirefall", x: 7 * 16, y: 29 * 16, width: 64, height: 16, properties: [
      {name: "targetMap", type: "string", value: "mirefall"},
      {name: "targetX", type: "int", value: 9},
      {name: "targetY", type: "int", value: 18},
      {name: "facing", type: "string", value: "down"}
    ]}
  ];

  const growlitheZone = [
    { id: 7, name: "GrowlitheEncounter", x: 3 * 16, y: 7 * 16, width: 48, height: 48 }
  ];

  const layers = [
    createLayer(1, "Ground", W, H, ground),
    createLayer(2, "Collision", W, H, collision),
    createObjectLayer(3, "NPCs", objectsNpcs),
    createObjectLayer(4, "TrainerTriggers", objectsTrainers),
    createObjectLayer(5, "Spawns", []),
    createLayer(6, "AbovePlayer", W, H, new Array(W * H).fill(0)),
    createObjectLayer(7, "MapExits", objectsExits),
    createObjectLayer(8, "GrowlitheZone", growlitheZone)
  ];

  return createMap(W, H, layers);
}

// -----------------------------------------------------------------------------
// MAP 3: CINDERPEAK CITY
// -----------------------------------------------------------------------------
function buildCinderpeak() {
  const W = 24, H = 20;
  const ground = new Array(W * H).fill(T_FORGE_OCHRE);
  const collision = new Array(W * H).fill(0);
  
  const setTile = (arr, x, y, val) => arr[y * W + x] = val;
  const fillRect = (arr, x, y, w, h, val) => {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        setTile(arr, c, r, val);
      }
    }
  };

  // Gym Building (6x5 at col 9-14, row 0-4)
  fillRect(ground, 9, 0, 6, 5, T_VOLCANIC_ROCK);
  fillRect(collision, 9, 0, 6, 4, T_VOLCANIC_ROCK);

  // PokeCenter (3x3 at col 2-4, row 5-7)
  fillRect(ground, 2, 5, 3, 3, T_BLDG_BROWN);
  fillRect(collision, 2, 5, 3, 2, T_BLDG_BROWN);

  // Garnet's Forge (col 16-23, row 4-14)
  fillRect(ground, 16, 4, 8, 11, T_VOLCANIC_ROCK);
  fillRect(collision, 16, 4, 8, 11, T_VOLCANIC_ROCK);

  // Decorative hot stone path to gym
  fillRect(ground, 10, 5, 4, 15, T_HOT_STONE);

  const objectsNpcs = [
    { id: 1, name: "Nurse", x: 3 * 16, y: 7 * 16, properties: [{name: "dialogueId", type: "string", value: "pokecenter_nurse"}, {name: "facing", type: "string", value: "down"}] },
    { id: 2, name: "Worker", x: 14 * 16, y: 10 * 16, properties: [{name: "dialogueId", type: "string", value: "cinderpeak_worker"}, {name: "facing", type: "string", value: "left"}] },
    { id: 3, name: "Child", x: 7 * 16, y: 3 * 16, properties: [{name: "dialogueId", type: "string", value: "cinderpeak_child"}, {name: "facing", type: "string", value: "right"}] },
    { id: 4, name: "Guard", x: 11 * 16, y: 5 * 16, properties: [{name: "dialogueId", type: "string", value: "gym_gate_guard"}, {name: "facing", type: "string", value: "down"}] },
    { id: 5, name: "ForgeSign", x: 15 * 16, y: 8 * 16, properties: [{name: "dialogueId", type: "string", value: "route2_sign"}, {name: "facing", type: "string", value: "right"}] } // re-using sign logic
  ];

  const objectsExits = [
    { id: 6, name: "ToGym", x: 11 * 16, y: 4 * 16, width: 32, height: 16, properties: [
      {name: "targetMap", type: "string", value: "garnet_gym"},
      {name: "targetX", type: "int", value: 5},
      {name: "targetY", type: "int", value: 14},
      {name: "facing", type: "string", value: "up"}
    ]},
    { id: 7, name: "ToRoute2", x: 10 * 16, y: 19 * 16, width: 64, height: 16, properties: [
      {name: "targetMap", type: "string", value: "route2"},
      {name: "targetX", type: "int", value: 9},
      {name: "targetY", type: "int", value: 1},
      {name: "facing", type: "string", value: "down"}
    ]}
  ];

  const layers = [
    createLayer(1, "Ground", W, H, ground),
    createLayer(2, "Collision", W, H, collision),
    createObjectLayer(3, "NPCs", objectsNpcs),
    createObjectLayer(4, "TrainerTriggers", []),
    createObjectLayer(5, "Spawns", []),
    createLayer(6, "AbovePlayer", W, H, new Array(W * H).fill(0)),
    createObjectLayer(7, "MapExits", objectsExits)
  ];

  return createMap(W, H, layers);
}

// -----------------------------------------------------------------------------
// MAP 4: GARNET'S GYM
// -----------------------------------------------------------------------------
function buildGarnetGym() {
  const W = 12, H = 16;
  const ground = new Array(W * H).fill(T_GYM_FLOOR);
  const collision = new Array(W * H).fill(0);
  
  const setTile = (arr, x, y, val) => arr[y * W + x] = val;
  const fillRect = (arr, x, y, w, h, val) => {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        setTile(arr, c, r, val);
      }
    }
  };

  // Narrow central path
  fillRect(ground, 5, 2, 2, 14, T_HOT_STONE);

  // Fire/Brazier boundaries
  fillRect(collision, 0, 0, 12, 1, T_VOLCANIC_ROCK); // Back wall
  fillRect(collision, 0, 1, 4, 15, T_VOLCANIC_ROCK); // Left edge
  fillRect(collision, 8, 1, 4, 15, T_VOLCANIC_ROCK); // Right edge

  // Add Braziers (decorative collision)
  for (let r = 2; r < 14; r += 3) {
    setTile(ground, 4, r, T_BRAZIER);
    setTile(collision, 4, r, T_BRAZIER);
    setTile(ground, 7, r, T_BRAZIER);
    setTile(collision, 7, r, T_BRAZIER);
  }

  const objectsNpcs = [
    { id: 1, name: "Garnet", x: 5 * 16, y: 1 * 16, properties: [{name: "dialogueId", type: "string", value: "garnet_pre_battle"}, {name: "facing", type: "string", value: "down"}] }
  ];

  const objectsExits = [
    { id: 2, name: "ToCinderpeak", x: 5 * 16, y: 15 * 16, width: 32, height: 16, properties: [
      {name: "targetMap", type: "string", value: "cinderpeak"},
      {name: "targetX", type: "int", value: 11},
      {name: "targetY", type: "int", value: 6},
      {name: "facing", type: "string", value: "down"}
    ]}
  ];

  const layers = [
    createLayer(1, "Ground", W, H, ground),
    createLayer(2, "Collision", W, H, collision),
    createObjectLayer(3, "NPCs", objectsNpcs),
    createObjectLayer(4, "TrainerTriggers", []),
    createObjectLayer(5, "Spawns", []),
    createLayer(6, "AbovePlayer", W, H, new Array(W * H).fill(0)),
    createObjectLayer(7, "MapExits", objectsExits)
  ];

  return createMap(W, H, layers);
}

// -----------------------------------------------------------------------------
// EXECUTE
// -----------------------------------------------------------------------------
const outDir = path.join(process.cwd(), 'public', 'assets', 'maps');

fs.writeFileSync(path.join(outDir, 'mirefall.tmj'), JSON.stringify(buildMirefall(), null, 2));
fs.writeFileSync(path.join(outDir, 'route2.tmj'), JSON.stringify(buildRoute2(), null, 2));
fs.writeFileSync(path.join(outDir, 'cinderpeak.tmj'), JSON.stringify(buildCinderpeak(), null, 2));
fs.writeFileSync(path.join(outDir, 'garnet_gym.tmj'), JSON.stringify(buildGarnetGym(), null, 2));

console.log("Generated all 4 maps successfully.");
