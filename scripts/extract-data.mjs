import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const input = process.argv[2];
if (!input) throw new Error("请传入攻略 xlsx 路径");

const workbook = XLSX.readFile(input);
const rows = (name) =>
  XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "" });
const clean = (value) => String(value ?? "").trim();
const number = (value) => Number(value) || 0;
const parseItem = (raw) => {
  const text = clean(raw).replace(/[（(][凡良佳绝][）)]/g, "");
  const match = text.match(/^(.+?)[*x×](\d+)$/);
  return {
    name: clean(match ? match[1] : text),
    qty: match ? Number(match[2]) : 1,
  };
};
const parseList = (raw) =>
  clean(raw)
    .split(/\n+/)
    .map(parseItem)
    .filter((item) => item.name);

const npcNames = [
  "李梦卿",
  "陈远舟",
  "卫泓",
  "杨子勤",
  "牧夏",
  "宋烟瞳",
  "纪瑶华",
  "游景和",
  "谢闻天",
  "左离",
  "林婉兮",
  "叶玉心",
];
const recipeRows = rows("【菜谱图鉴】");
const recipes = recipeRows
  .slice(3)
  .filter((row) => Number.isFinite(Number(row[0])) && clean(row[2]))
  .map((row) => {
    const effect = clean(row[3]);
    const staminaValues = [...effect.matchAll(/(\d+)\s*点体力/g)].map((match) =>
      Number(match[1]),
    );
    const slashValues = [...effect.matchAll(/(\d+)\s*\/\s*(\d+)/g)].flatMap(
      (match) => [Number(match[1]), Number(match[2])],
    );
    return {
      id: number(row[0]),
      name: clean(row[2]),
      effect,
      stamina: Math.max(0, ...staminaValues, ...slashValues),
      ingredients: parseList(row[4]),
      preferences: Object.fromEntries(
        npcNames.map((npc, index) => [npc, clean(row[index + 5]) || "未知"]),
      ),
      unlock: clean(row[18]),
    };
  });

const cropRows = rows("【灵植图鉴】");
const seasons = ["春", "夏", "秋", "冬"];
const crops = cropRows
  .slice(2)
  .filter((row) => Number.isFinite(Number(row[0])) && clean(row[2]))
  .map((row) => {
    const yieldMatch = clean(row[9]).match(/(\d+)(?:~(\d+))?/);
    const minYield = yieldMatch ? Number(yieldMatch[1]) : 0;
    const maxYield = yieldMatch ? Number(yieldMatch[2] || yieldMatch[1]) : 0;
    return {
      id: number(row[0]),
      name: clean(row[2]),
      seed: clean(row[3]),
      seasons: seasons.filter((_, index) => clean(row[index + 4]) === "√"),
      days: number(row[8]),
      minYield,
      maxYield,
      harvests: number(row[10]),
      seedPrice: number(row[11]),
      prices: { 凡: number(row[12]), 良: number(row[13]), 佳: number(row[14]) },
      special: clean(row[16]),
    };
  });

const materials = rows("【素材图鉴】")
  .slice(1)
  .filter((row) => Number.isFinite(Number(row[0])) && clean(row[2]))
  .map((row) => ({
    id: number(row[0]),
    name: clean(row[2]),
    source: clean(row[3]),
    type: "素材",
  }));

const fishHeader = rows("【钓鱼图鉴】")[0];
const fish = rows("【钓鱼图鉴】")
  .slice(2)
  .filter((row) => Number.isFinite(Number(row[0])) && clean(row[2]))
  .map((row) => ({
    id: number(row[0]),
    name: clean(row[2]),
    habit: clean(row[3]),
    locations: row
      .slice(5, 14)
      .map((value, index) =>
        clean(value) === "√"
          ? clean(fishHeader[index + 5]).replace(/\n/g, "")
          : "",
      )
      .filter(Boolean),
  }));

const monsters = rows("【精怪图鉴】")
  .slice(2)
  .filter((row) => Number.isFinite(Number(row[0])) && clean(row[2]))
  .map((row) => ({
    id: number(row[0]),
    name: clean(row[2]),
    location: clean(row[3]),
    drops: row.slice(4).map(clean).filter(Boolean).map(parseItem),
  }));

const giftRows = rows("【送礼+9】图鉴");
const gifts = [];
for (const start of [0, 16, 32, 46, 63, 80]) {
  for (const offset of [0, 8]) {
    const npc = clean(giftRows[start]?.[offset]);
    if (!npc) continue;
    const end = Math.min(start + 16, giftRows.length);
    for (let rowIndex = start; rowIndex < end; rowIndex += 1) {
      if (clean(giftRows[rowIndex]?.[offset]) !== "名称") continue;
      const sourceRow = giftRows[rowIndex + 1] || [];
      for (let column = offset + 1; column < offset + 6; column += 1) {
        const name = clean(giftRows[rowIndex][column]);
        if (name) gifts.push({ npc, name, source: clean(sourceRow[column]) });
      }
    }
  }
}

const exchanges = rows("牧夏兑换")
  .slice(1)
  .filter((row) => clean(row[0]))
  .map((row, index) => ({
    id: index + 1,
    name: clean(row[0]),
    materials: row
      .slice(1, 5)
      .map(parseItem)
      .filter((item) => item.name),
    category: clean(row[5]) || "其他",
  }));

const riddles = rows("【灯谜一览】")
  .slice(1)
  .filter((row) => clean(row[0]) && clean(row[1]))
  .map((row, index) => ({
    id: index + 1,
    question: clean(row[0]),
    answer: clean(row[1]),
    type: clean(row[2]) || "其他",
  }));

const questRows = rows("【主线一览】");
const quests = [];
let questChapter = "";
for (const row of questRows) {
  const chapterCell = row.map(clean).find((cell) => /^第.+章$/.test(cell));
  if (chapterCell) {
    questChapter = chapterCell;
    continue;
  }
  for (const cell of row.map(clean).filter(Boolean)) {
    const lines = cell.split(/\n+/).map(clean).filter(Boolean);
    const heading = lines[0].match(/^【(.+?)】\s*[:：]?\s*(.*)$/);
    if (!heading) continue;
    const unlock = lines.filter((line) => line.startsWith("解锁")).join("、");
    quests.push({
      id: quests.length + 1,
      chapter: questChapter || "其他",
      name: clean(heading[1]),
      description: clean(heading[2]),
      steps: lines.slice(1).filter((line) => !line.startsWith("解锁")),
      unlock,
    });
  }
}

const pillCategory = (effect) => {
  if (/消除|不会陷入.*状态/.test(effect)) return "状态防护";
  if (/提升\d+点|提升\d+.*上限/.test(effect) && !/小时/.test(effect))
    return "永久提升";
  if (/钓鱼|工具|采集|加工|烹饪|收获|秘境的入口/.test(effect))
    return "生活辅助";
  if (/法术|普通攻击|灵力消耗|道法值|身法值|神识值|定力值/.test(effect))
    return "战斗增益";
  if (/恢复|筋脉/.test(effect)) return "恢复类";
  return "其他";
};
const pills = rows("丹药图鉴")
  .filter((row) => clean(row[0]) && clean(row[1]))
  .map((row, index) => ({
    id: index + 1,
    name: clean(row[0]),
    effect: clean(row[1]),
    category: pillCategory(clean(row[1])),
  }));

const parseRequirement = (raw) => {
  const text = clean(raw);
  const match = text.match(/^(.+?)[*x×](\d+)$/);
  return {
    name: clean(match ? match[1] : text),
    qty: match ? Number(match[2]) : 1,
  };
};
const pavilionRows = rows("琼珍阁解锁").slice(1);
const pavilionUnlocks = [];
const parsePavilionBlock = (offset, materialCount, rewardIndex, typeIndex) => {
  let group = "";
  let reward = "";
  for (const row of pavilionRows) {
    if (clean(row[offset])) {
      group = clean(row[offset]);
      reward = clean(row[rewardIndex]);
    }
    const name = clean(row[offset + 1]);
    if (!name) continue;
    pavilionUnlocks.push({
      id: pavilionUnlocks.length + 1,
      group,
      name,
      materials: row
        .slice(offset + 2, offset + 2 + materialCount)
        .map(parseRequirement)
        .filter((item) => item.name),
      reward: clean(row[rewardIndex]) || reward,
      type: clean(row[typeIndex]) || (offset === 0 ? "灵植" : "装饰"),
    });
  }
};
parsePavilionBlock(0, 3, 5, 6);
parsePavilionBlock(7, 2, 11, 12);

const sourceMap = new Map(
  materials.map((item) => [
    item.name,
    { source: item.source, type: item.type },
  ]),
);
crops.forEach((crop) =>
  sourceMap.set(crop.name, {
    source: `种植（${crop.seasons.join("、") || "特殊"}季）`,
    type: "灵植",
  }),
);
fish.forEach((item) =>
  sourceMap.set(item.name, {
    source: `钓鱼：${item.locations.join("、")}。${item.habit}`,
    type: "鱼类",
  }),
);
monsters.forEach((monster) =>
  monster.drops.forEach((drop) => {
    const current = sourceMap.get(drop.name);
    const source = `精怪掉落：${monster.name}（${monster.location}）`;
    sourceMap.set(drop.name, {
      source: current ? `${current.source}\n${source}` : source,
      type: current?.type || "掉落物",
    });
  }),
);

const usedIngredients = [
  ...new Set(
    recipes.flatMap((recipe) => recipe.ingredients.map((item) => item.name)),
  ),
].sort((a, b) => a.localeCompare(b, "zh-CN"));
const ingredientSources = usedIngredients.map((name) => ({
  name,
  ...(sourceMap.get(name) || {
    source: "原攻略未注明，可在游戏商店、加工设施或任务中确认",
    type: "待补充",
  }),
}));

const output = {
  meta: { source: path.basename(input), generatedAt: new Date().toISOString() },
  npcNames,
  recipes,
  crops,
  materials,
  fish,
  monsters,
  gifts,
  ingredientSources,
  exchanges,
  riddles,
  quests,
  pills,
  pavilionUnlocks,
};
const outputPath = path.resolve("src/data/game-data.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(
  `已生成 ${outputPath}: ${recipes.length} 菜谱 / ${crops.length} 灵植 / ${quests.length} 任务 / ${pills.length} 丹药 / ${exchanges.length} 兑换 / ${riddles.length} 灯谜 / ${pavilionUnlocks.length} 琼珍阁解锁`,
);
