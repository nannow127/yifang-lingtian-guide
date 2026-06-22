<script setup>
import { computed, reactive, ref, watch } from "vue";
import {
  Collection,
  Dish,
  Food,
  Goods,
  Grid,
  Search,
  Star,
  Sunny,
} from "@element-plus/icons-vue";
import data from "./data/game-data.json";
import communityPrices from "./data/community-prices.json";

const STORAGE_KEY = "yifang-lingtian-guide-v1";
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
const state = reactive({
  favorites: saved.favorites || [],
  cooked: saved.cooked || [],
  salePrices: saved.salePrices || {},
  itemPrices: saved.itemPrices || {},
  exchangeDone: saved.exchangeDone || [],
  unlockDone: saved.unlockDone || [],
  riddlesKnown: saved.riddlesKnown || [],
  questDone: saved.questDone || [],
});
watch(
  state,
  (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)),
  { deep: true },
);

const active = ref("recipes");
const search = ref("");
const npc = ref("");
const preference = ref("");
const ingredient = ref("");
const season = ref("");
const favoriteOnly = ref(false);
const sortBy = ref("stamina");
const page = ref(1);
const pageSize = 12;
const recipeDialog = ref(null);
const recipeDialogVisible = ref(false);
const priceSearch = ref("");
const priceCategory = ref("");
const exchangeCategory = ref("");
const riddleType = ref("");
const unlockType = ref("");
const unlockGroup = ref("");
const fishLocation = ref("");
const monsterLocation = ref("");
const questChapter = ref("");
const pillCategory = ref("");

const cropByName = new Map(data.crops.map((crop) => [crop.name, crop]));
const sourceByName = new Map(
  data.ingredientSources.map((item) => [item.name, item]),
);
const communityRecipeByName = new Map(
  communityPrices.recipes.map(([name, common, good, excellent]) => [
    name,
    { common, good, excellent },
  ]),
);
const communityItemByName = new Map(
  communityPrices.items.map(
    ([name, category, buy, common, good, excellent]) => [
      name,
      { name, category, buy, common, good, excellent },
    ],
  ),
);
const allIngredients = data.ingredientSources.map((item) => item.name);
const favoriteSet = computed(() => new Set(state.favorites));
const cookedSet = computed(() => new Set(state.cooked));
const animalNames = new Set([
  "鸡蛋",
  "鸡肉",
  "猪肉",
  "牛肉",
  "咸肉",
  "松花蛋",
  "百花蜜",
  "九里香蜜",
]);
const itemUnitPrice = (name) =>
  Number(
    state.itemPrices[name] ||
      cropByName.get(name)?.prices?.凡 ||
      communityItemByName.get(name)?.common ||
      0,
  );
const knownCost = (recipe) =>
  recipe.ingredients.reduce(
    (total, item) => total + itemUnitPrice(item.name) * item.qty,
    0,
  );
const pricedIngredients = (recipe) =>
  recipe.ingredients.filter((item) => itemUnitPrice(item.name) > 0).length;
const costCoverage = (recipe) =>
  Math.round((pricedIngredients(recipe) / recipe.ingredients.length) * 100);
const knownSource = (name) => {
  const item = sourceByName.get(name);
  return item?.type === "待补充" ? "" : item?.source || "";
};
const recipeSalePrice = (recipe) =>
  Number(
    state.salePrices[recipe.name] ||
      communityRecipeByName.get(recipe.name)?.common ||
      0,
  );
const profit = (recipe) => recipeSalePrice(recipe) - knownCost(recipe);
const formatQualityPrices = (prices) =>
  [
    prices?.common != null && `凡 ${prices.common}`,
    prices?.good != null && `良 ${prices.good}`,
    prices?.excellent != null && `佳 ${prices.excellent}`,
  ]
    .filter(Boolean)
    .join(" / ");

const filteredRecipes = computed(() => {
  const key = search.value.trim().toLowerCase();
  const result = data.recipes.filter((recipe) => {
    const haystack = [
      recipe.name,
      recipe.effect,
      recipe.unlock,
      ...recipe.ingredients.map((item) => item.name),
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!key || haystack.includes(key)) &&
      (!npc.value ||
        (!preference.value
          ? recipe.preferences[npc.value] !== "未知"
          : recipe.preferences[npc.value] === preference.value)) &&
      (!ingredient.value ||
        recipe.ingredients.some((item) => item.name === ingredient.value)) &&
      (!favoriteOnly.value || favoriteSet.value.has(recipe.name))
    );
  });
  return result.sort((a, b) =>
    sortBy.value === "price"
      ? recipeSalePrice(b) - recipeSalePrice(a)
      : sortBy.value === "profit"
        ? profit(b) - profit(a)
        : sortBy.value === "ingredients"
          ? a.ingredients.length - b.ingredients.length
          : b.stamina - a.stamina,
  );
});
const pagedRecipes = computed(() =>
  filteredRecipes.value.slice(
    (page.value - 1) * pageSize,
    page.value * pageSize,
  ),
);
watch([search, npc, preference, ingredient, favoriteOnly, sortBy], () => {
  page.value = 1;
});
const cropResults = computed(() =>
  data.crops
    .filter(
      (crop) =>
        (!search.value ||
          [crop.name, crop.seed, crop.special]
            .join(" ")
            .toLowerCase()
            .includes(search.value.toLowerCase())) &&
        (!season.value || crop.seasons.includes(season.value)),
    )
    .map((crop) => ({
      ...crop,
      recipes: data.recipes.filter((recipe) =>
        recipe.ingredients.some((item) => item.name === crop.name),
      ),
    })),
);
const npcCards = computed(() =>
  data.npcNames
    .map((name) => ({
      name,
      lovedRecipes: data.recipes.filter(
        (recipe) => recipe.preferences[name] === "喜欢",
      ),
      gifts: data.gifts.filter((gift) => gift.npc === name),
    }))
    .filter(
      (card) =>
        !search.value ||
        [
          card.name,
          ...card.gifts.map((g) => g.name),
          ...card.lovedRecipes.map((r) => r.name),
        ]
          .join(" ")
          .includes(search.value),
    ),
);
const sourceResults = computed(() =>
  data.ingredientSources.filter(
    (item) =>
      item.type !== "待补充" &&
      (!search.value ||
        `${item.name}${item.source}${item.type}`
          .toLowerCase()
          .includes(search.value.toLowerCase())),
  ),
);
const priceCatalog = computed(() =>
  [
    ...new Set([
      ...data.ingredientSources.map((item) => item.name),
      ...communityPrices.items.map((item) => item[0]),
    ]),
  ]
    .map((name) => {
      const item = data.ingredientSources.find(
        (entry) => entry.name === name,
      ) || {
        name,
        source: "社区攻略价格表",
        type: communityItemByName.get(name)?.category || "其他",
      };
      const crop = cropByName.get(item.name);
      const legacy = communityItemByName.get(item.name);
      const category = crop
        ? "灵植"
        : animalNames.has(item.name)
          ? "动物产品"
          : legacy?.category || (item.type === "鱼类" ? "鱼类" : "其他食材");
      return {
        ...item,
        category,
        guidePrice: crop?.prices?.凡 || legacy?.common || 0,
        prices: crop?.prices || null,
        legacy,
        currentPrice: itemUnitPrice(item.name),
      };
    })
    .filter(
      (item) =>
        (!priceCategory.value || item.category === priceCategory.value) &&
        (!priceSearch.value ||
          `${item.name}${item.source}`.includes(priceSearch.value)),
    ),
);
const exchangeResults = computed(() =>
  data.exchanges.filter(
    (item) =>
      (!search.value ||
        `${item.name}${item.materials.map((m) => m.name).join("")}`.includes(
          search.value,
        )) &&
      (!exchangeCategory.value || item.category === exchangeCategory.value),
  ),
);
const riddleResults = computed(() =>
  data.riddles.filter(
    (item) =>
      (!search.value ||
        `${item.question}${item.answer}`.includes(search.value)) &&
      (!riddleType.value || item.type === riddleType.value),
  ),
);
const pavilionGroups = computed(() => [
  ...new Set(data.pavilionUnlocks.map((item) => item.group).filter(Boolean)),
]);
const pavilionResults = computed(() =>
  data.pavilionUnlocks.filter(
    (item) =>
      (!search.value ||
        `${item.group}${item.name}${item.materials.map((m) => m.name).join("")}${item.reward}`.includes(
          search.value,
        )) &&
      (!unlockType.value || item.type === unlockType.value) &&
      (!unlockGroup.value || item.group === unlockGroup.value),
  ),
);
const fishLocations = [
  ...new Set(data.fish.flatMap((item) => item.locations)),
].sort();
const fishResults = computed(() => {
  const key = search.value.trim().toLowerCase();
  return data.fish.filter(
    (item) =>
      (!key ||
        `${item.name}${item.habit}${item.locations.join("")}`
          .toLowerCase()
          .includes(key)) &&
      (!fishLocation.value || item.locations.includes(fishLocation.value)),
  );
});
const monsterLocations = [
  ...new Set(data.monsters.map((item) => item.location).filter(Boolean)),
].sort();
const monsterResults = computed(() => {
  const key = search.value.trim().toLowerCase();
  return data.monsters.filter(
    (item) =>
      (!key ||
        `${item.name}${item.location}${item.drops.map((drop) => drop.name).join("")}`
          .toLowerCase()
          .includes(key)) &&
      (!monsterLocation.value || item.location === monsterLocation.value),
  );
});
const questChapters = [...new Set(data.quests.map((item) => item.chapter))];
const questResults = computed(() => {
  const key = search.value.trim().toLowerCase();
  return data.quests.filter(
    (item) =>
      (!key ||
        `${item.name}${item.description}${item.steps.join("")}${item.unlock}`
          .toLowerCase()
          .includes(key)) &&
      (!questChapter.value || item.chapter === questChapter.value),
  );
});
const pillCategories = [...new Set(data.pills.map((item) => item.category))];
const pillResults = computed(() => {
  const key = search.value.trim().toLowerCase();
  return data.pills.filter(
    (item) =>
      (!key || `${item.name}${item.effect}`.toLowerCase().includes(key)) &&
      (!pillCategory.value || item.category === pillCategory.value),
  );
});
const toggle = (list, name) => {
  const index = list.indexOf(name);
  index >= 0 ? list.splice(index, 1) : list.push(name);
};
const openRecipe = (recipe) => {
  recipeDialog.value = recipe;
  recipeDialogVisible.value = true;
};
const resetFilters = () => {
  search.value = "";
  npc.value = "";
  preference.value = "";
  ingredient.value = "";
  season.value = "";
  exchangeCategory.value = "";
  riddleType.value = "";
  unlockType.value = "";
  unlockGroup.value = "";
  fishLocation.value = "";
  monsterLocation.value = "";
  questChapter.value = "";
  pillCategory.value = "";
  favoriteOnly.value = false;
};
const topProfits = computed(() =>
  data.recipes
    .filter((recipe) => recipeSalePrice(recipe) > 0)
    .sort((a, b) => profit(b) - profit(a))
    .slice(0, 8),
);
const cropProfit = (crop) =>
  Math.round(
    ((crop.minYield + crop.maxYield) / 2) * crop.harvests * crop.prices.凡 -
      crop.seedPrice,
  );
const exportUserData = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        { exportedAt: new Date().toISOString(), ...state },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "一方灵田-我的攻略数据.json";
  link.click();
  URL.revokeObjectURL(link.href);
};
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">田</div>
        <div><strong>一方灵田</strong><span>随身攻略册</span></div>
      </div>
      <el-menu :default-active="active" @select="active = $event"
        ><el-menu-item index="recipes"
          ><el-icon><Dish /></el-icon><span>菜谱大全</span></el-menu-item
        ><el-menu-item index="npc"
          ><el-icon><Star /></el-icon><span>送礼助手</span></el-menu-item
        ><el-menu-item index="crops"
          ><el-icon><Sunny /></el-icon><span>种植规划</span></el-menu-item
        ><el-menu-item index="exchange"
          ><el-icon><Goods /></el-icon><span>牧夏兑换</span></el-menu-item
        ><el-menu-item index="riddles"
          ><el-icon><Collection /></el-icon><span>猜灯谜</span></el-menu-item
        ><el-menu-item index="pavilion"
          ><el-icon><Grid /></el-icon><span>琼珍阁解锁</span></el-menu-item
        ><el-menu-item index="sources"
          ><el-icon><Collection /></el-icon><span>食材来源</span></el-menu-item
        ><el-menu-item index="fish"
          ><el-icon><Food /></el-icon><span>鱼类图鉴</span></el-menu-item
        ><el-menu-item index="monsters"
          ><el-icon><Grid /></el-icon><span>怪物掉落</span></el-menu-item
        ><el-menu-item index="quests"
          ><el-icon><Collection /></el-icon><span>主线任务</span></el-menu-item
        ><el-menu-item index="pills"
          ><el-icon><Goods /></el-icon><span>丹药图鉴</span></el-menu-item
        ><el-menu-item index="profit"
          ><el-icon><Goods /></el-icon><span>物价与利润</span></el-menu-item
        ></el-menu
      >
      <div class="side-note">
        <span>数据源</span><b>{{ data.meta.source }}</b
        ><small
          >{{ data.recipes.length }} 道菜 · {{ data.crops.length }} 种灵植 ·
          {{ data.fish.length }} 种鱼</small
        >
      </div>
    </aside>
    <main>
      <header>
        <div>
          <p class="eyebrow">归云派生活指南</p>
          <h1>
            {{
              {
                recipes: "今天做点什么？",
                npc: "投其所好，事半功倍",
                crops: "顺时而种，满载而归",
                exchange: "找牧夏换点好东西",
                riddles: "灯火映谜，妙趣横生",
                pavilion: "琼珍百宝，逐项解锁",
                sources: "每样食材，都有来处",
                fish: "观水识鱼，择时下竿",
                monsters: "寻踪探秘，按需取材",
                quests: "循章而行，不漏要事",
                pills: "辨药识效，对症取用",
                profit: "算清成本，再下厨",
              }[active]
            }}
          </h1>
        </div>
      </header>
      <section class="toolbar">
        <el-input
          v-model="search"
          :prefix-icon="Search"
          clearable
          placeholder="搜索名称、材料、题目或来源…"
        /><template v-if="active === 'recipes'"
          ><el-select v-model="npc" clearable placeholder="选择角色"
            ><el-option
              v-for="name in data.npcNames"
              :key="name"
              :label="name"
              :value="name" /></el-select
          ><el-select v-model="preference" clearable placeholder="喜好"
            ><el-option
              v-for="p in ['喜欢', '一般', '不喜欢']"
              :key="p"
              :label="p"
              :value="p" /></el-select
          ><el-select
            v-model="ingredient"
            filterable
            clearable
            placeholder="指定食材"
            ><el-option
              v-for="name in allIngredients"
              :key="name"
              :label="name"
              :value="name" /></el-select
          ><el-select v-model="sortBy"
            ><el-option label="体力恢复优先" value="stamina" /><el-option
              label="售价优先"
              value="price" /><el-option
              label="利润优先"
              value="profit" /><el-option
              label="配料少优先"
              value="ingredients" /></el-select
          ><el-button
            class="favorite-filter"
            type="warning"
            :plain="!favoriteOnly"
            @click="favoriteOnly = !favoriteOnly"
            ><el-icon><Star /></el-icon>收藏菜谱
            {{ state.favorites.length }}</el-button
          ></template
        ><el-select
          v-if="active === 'crops'"
          v-model="season"
          clearable
          placeholder="适宜季节"
          ><el-option
            v-for="s in ['春', '夏', '秋', '冬']"
            :key="s"
            :label="s + '季'"
            :value="s" /></el-select
        ><el-select
          v-if="active === 'exchange'"
          v-model="exchangeCategory"
          clearable
          placeholder="兑换类别"
          ><el-option
            v-for="c in [...new Set(data.exchanges.map((i) => i.category))]"
            :key="c"
            :label="c"
            :value="c" /></el-select
        ><el-select
          v-if="active === 'riddles'"
          v-model="riddleType"
          clearable
          placeholder="灯会类型"
          ><el-option
            v-for="c in [...new Set(data.riddles.map((i) => i.type))]"
            :key="c"
            :label="c"
            :value="c" /></el-select
        ><template v-if="active === 'pavilion'"
          ><el-select v-model="unlockType" clearable placeholder="项目类型"
            ><el-option
              v-for="c in ['灵植', '装饰']"
              :key="c"
              :label="c"
              :value="c" /></el-select
          ><el-select
            v-model="unlockGroup"
            filterable
            clearable
            placeholder="选择套组"
            ><el-option
              v-for="c in pavilionGroups"
              :key="c"
              :label="c"
              :value="c" /></el-select></template
        ><el-select
          v-if="active === 'fish'"
          v-model="fishLocation"
          filterable
          clearable
          placeholder="出没地点"
          ><el-option
            v-for="location in fishLocations"
            :key="location"
            :label="location"
            :value="location" /></el-select
        ><el-select
          v-if="active === 'monsters'"
          v-model="monsterLocation"
          filterable
          clearable
          placeholder="怪物区域"
          ><el-option
            v-for="location in monsterLocations"
            :key="location"
            :label="location"
            :value="location" /></el-select
        ><el-select
          v-if="active === 'quests'"
          v-model="questChapter"
          clearable
          placeholder="主线章节"
          ><el-option
            v-for="chapter in questChapters"
            :key="chapter"
            :label="chapter"
            :value="chapter" /></el-select
        ><el-select
          v-if="active === 'pills'"
          v-model="pillCategory"
          clearable
          placeholder="丹药类型"
          ><el-option
            v-for="category in pillCategories"
            :key="category"
            :label="category"
            :value="category" /></el-select
        ><el-button text @click="resetFilters">重置</el-button>
      </section>
      <section v-if="active === 'recipes'" class="content-panel">
        <div class="section-title">
          <div>
            <p>共找到 {{ filteredRecipes.length }} 道菜</p>
            <span>支持按角色喜好、食材与状态筛选</span>
          </div>
        </div>
        <div class="recipe-grid">
          <article
            v-for="recipe in pagedRecipes"
            :key="recipe.id"
            class="recipe-card"
            :class="{ cooked: cookedSet.has(recipe.name) }"
            @click="openRecipe(recipe)"
          >
            <div class="recipe-card-head">
              <div class="recipe-title">
                <h3>{{ recipe.name }}</h3>
                <p v-if="recipe.effect" class="effect">{{ recipe.effect }}</p>
              </div>
              <div class="card-buttons" @click.stop>
                <el-button
                  circle
                  text
                  :class="{ selected: favoriteSet.has(recipe.name) }"
                  @click="toggle(state.favorites, recipe.name)"
                  ><el-icon><Star /></el-icon></el-button
                ><el-checkbox
                  :model-value="cookedSet.has(recipe.name)"
                  @change="toggle(state.cooked, recipe.name)"
                  >做过</el-checkbox
                >
              </div>
            </div>
            <div class="tags">
              <el-tag v-if="recipe.stamina" type="success"
                >体力 +{{ recipe.stamina }}</el-tag
              ><el-tag
                v-if="communityRecipeByName.has(recipe.name)"
                type="warning"
                >EA参考价 {{ recipeSalePrice(recipe) }}</el-tag
              ><el-tag
                v-if="npc"
                :type="
                  recipe.preferences[npc] === '喜欢'
                    ? 'warning'
                    : recipe.preferences[npc] === '不喜欢'
                      ? 'danger'
                      : 'info'
                "
                >{{ npc }} · {{ recipe.preferences[npc] }}</el-tag
              >
            </div>
            <div class="ingredients">
              <span v-for="item in recipe.ingredients" :key="item.name"
                >{{ item.name }} ×{{ item.qty }}</span
              >
            </div>
            <div
              v-if="knownCost(recipe) || recipeSalePrice(recipe)"
              class="card-foot"
            >
              <span v-if="knownCost(recipe)"
                >成本 {{ knownCost(recipe) }} · 覆盖
                {{ costCoverage(recipe) }}%</span
              ><b
                v-if="recipeSalePrice(recipe)"
                :class="{ loss: profit(recipe) < 0 }"
                >{{ state.salePrices[recipe.name] ? "利润" : "参考利润" }}
                {{ profit(recipe) }}</b
              >
            </div>
          </article>
        </div>
        <el-empty
          v-if="!filteredRecipes.length"
          description="没有符合条件的菜谱"
        /><el-pagination
          v-if="filteredRecipes.length > pageSize"
          v-model:current-page="page"
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="filteredRecipes.length"
        />
      </section>
      <section v-else-if="active === 'npc'" class="npc-grid">
        <article v-for="card in npcCards" :key="card.name" class="npc-card">
          <div class="npc-name">
            <span>{{ card.name.slice(0, 1) }}</span>
            <div>
              <h3>{{ card.name }}</h3>
              <p>
                {{ card.gifts.length }} 件最爱礼物 ·
                {{ card.lovedRecipes.length }} 道喜欢的菜
              </p>
            </div>
          </div>
          <h4>最喜欢的菜</h4>
          <div class="link-list">
            <button
              v-for="recipe in card.lovedRecipes"
              :key="recipe.name"
              @click="openRecipe(recipe)"
            >
              {{ recipe.name }}
            </button>
          </div>
          <h4>好感 +9 礼物</h4>
          <div class="gift-list">
            <el-tooltip
              v-for="gift in card.gifts"
              :key="gift.name"
              :content="gift.source"
              :disabled="!gift.source"
              ><span>{{ gift.name }}</span></el-tooltip
            >
          </div>
        </article>
      </section>
      <section v-else-if="active === 'crops'" class="table-panel">
        <el-table :data="cropResults" stripe
          ><el-table-column
            prop="name"
            label="作物"
            fixed
            width="110"
          /><el-table-column label="季节" width="130"
            ><template #default="{ row }"
              ><el-tag v-for="s in row.seasons" :key="s" size="small">{{
                s
              }}</el-tag></template
            ></el-table-column
          ><el-table-column label="成熟/天" width="90" sortable
            ><template #default="{ row }"
              ><span v-if="row.days">{{ row.days }}</span></template
            ></el-table-column
          ><el-table-column label="产量" width="105"
            ><template #default="{ row }"
              ><span v-if="row.maxYield"
                >{{ row.minYield }}~{{ row.maxYield }} ×
                {{ row.harvests }}次</span
              ></template
            ></el-table-column
          ><el-table-column label="种子价" width="85" sortable
            ><template #default="{ row }"
              ><span v-if="row.seedPrice">{{ row.seedPrice }}</span></template
            ></el-table-column
          ><el-table-column label="售价（凡/良/佳）" width="180"
            ><template #default="{ row }">{{
              formatQualityPrices({
                common: row.prices.凡 || null,
                good: row.prices.良 || null,
                excellent: row.prices.佳 || null,
              })
            }}</template></el-table-column
          ><el-table-column
            label="单种期望净收益"
            width="135"
            sortable
            :sort-method="(a, b) => cropProfit(a) - cropProfit(b)"
            ><template #default="{ row }"
              ><b
                v-if="row.prices.凡 && row.seedPrice"
                :class="cropProfit(row) >= 0 ? 'gain' : 'loss'"
                >{{ cropProfit(row) }}</b
              ></template
            ></el-table-column
          ><el-table-column
            label="日均净收益"
            width="115"
            sortable
            :sort-method="
              (a, b) => cropProfit(a) / a.days - cropProfit(b) / b.days
            "
            ><template #default="{ row }"
              ><span v-if="row.prices.凡 && row.seedPrice && row.days">{{
                (cropProfit(row) / row.days).toFixed(1)
              }}</span></template
            ></el-table-column
          ><el-table-column label="可做菜谱" min-width="260"
            ><template #default="{ row }"
              ><el-button
                v-for="recipe in row.recipes.slice(0, 6)"
                :key="recipe.name"
                link
                type="primary"
                @click="openRecipe(recipe)"
                >{{ recipe.name }}</el-button
              ></template
            ></el-table-column
          ></el-table
        >
      </section>
      <section
        v-else-if="active === 'exchange'"
        class="table-panel exchange-panel"
      >
        <div class="section-title">
          <div>
            <p>牧夏可兑换 {{ exchangeResults.length }} 项</p>
            <span>兑换材料来自攻略汇总表</span>
          </div>
        </div>
        <el-table :data="exchangeResults" stripe row-key="id"
          ><el-table-column label="已兑换" width="88" fixed
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="state.exchangeDone.includes(row.id)"
                @change="
                  toggle(state.exchangeDone, row.id)
                " /></template></el-table-column
          ><el-table-column label="类别" width="140"
            ><template #default="{ row }"
              ><el-tag>{{ row.category }}</el-tag></template
            ></el-table-column
          ><el-table-column prop="name" label="兑换项目" min-width="220" />
          <el-table-column label="兑换材料" min-width="420"
            ><template #default="{ row }"
              ><div v-if="row.materials.length" class="inline-materials">
                <span v-for="material in row.materials" :key="material.name"
                  >{{ material.name }} ×{{ material.qty }}</span
                >
              </div></template
            ></el-table-column
          ></el-table
        >
      </section>
      <section
        v-else-if="active === 'riddles'"
        class="table-panel riddle-panel"
      >
        <div class="section-title">
          <div>
            <p>共收录 {{ riddleResults.length }} 条灯谜</p>
            <span>题目与答案来自攻略汇总表</span>
          </div>
        </div>
        <el-table :data="riddleResults" stripe row-key="id"
          ><el-table-column label="已掌握" width="88" fixed
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="state.riddlesKnown.includes(row.id)"
                @change="
                  toggle(state.riddlesKnown, row.id)
                " /></template></el-table-column
          ><el-table-column label="类型" width="120"
            ><template #default="{ row }"
              ><el-tag>{{ row.type }}</el-tag></template
            ></el-table-column
          ><el-table-column prop="question" label="题目" min-width="420" />
          <el-table-column prop="answer" label="答案" min-width="220" />
        </el-table>
      </section>
      <section
        v-else-if="active === 'pavilion'"
        class="table-panel pavilion-panel"
      >
        <div class="section-title">
          <div>
            <p>琼珍阁 {{ pavilionResults.length }} 项解锁</p>
            <span>品质材料按“名称（品质）”独立展示</span>
          </div>
        </div>
        <el-table :data="pavilionResults" stripe row-key="id"
          ><el-table-column label="完成" width="72" fixed
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="state.unlockDone.includes(row.id)"
                @change="
                  toggle(state.unlockDone, row.id)
                " /></template></el-table-column
          ><el-table-column prop="type" label="类型" width="80"
            ><template #default="{ row }"
              ><el-tag>{{ row.type }}</el-tag></template
            ></el-table-column
          ><el-table-column
            prop="group"
            label="套组/类别"
            width="150"
          /><el-table-column
            prop="name"
            label="解锁项目"
            min-width="180"
          /><el-table-column label="所需材料" min-width="280"
            ><template #default="{ row }"
              ><div class="inline-materials">
                <span v-for="material in row.materials" :key="material.name"
                  >{{ material.name }} ×{{ material.qty }}</span
                >
              </div></template
            ></el-table-column
          ><el-table-column prop="reward" label="套组全解锁奖励" min-width="210"
            ><template #default="{ row }"
              ><span class="source-text">{{ row.reward }}</span></template
            ></el-table-column
          ></el-table
        >
      </section>
      <section v-else-if="active === 'sources'" class="table-panel">
        <el-table :data="sourceResults" stripe
          ><el-table-column
            prop="name"
            label="食材"
            fixed
            width="150"
          /><el-table-column prop="type" label="类别" width="100"
            ><template #default="{ row }"
              ><el-tag>{{ row.type }}</el-tag></template
            ></el-table-column
          ><el-table-column prop="source" label="全部已知来源"
            ><template #default="{ row }"
              ><span class="source-text">{{ row.source }}</span></template
            ></el-table-column
          ><el-table-column label="相关菜谱" width="220"
            ><template #default="{ row }">{{
              data.recipes
                .filter((r) => r.ingredients.some((i) => i.name === row.name))
                .map((r) => r.name)
                .join("、")
            }}</template></el-table-column
          ></el-table
        >
      </section>
      <section v-else-if="active === 'fish'" class="table-panel atlas-panel">
        <div class="section-title">
          <div>
            <p>共找到 {{ fishResults.length }} 种鱼</p>
            <span>可按季节、昼夜描述与出没地点搜索</span>
          </div>
        </div>
        <el-table :data="fishResults" stripe row-key="id"
          ><el-table-column
            prop="name"
            label="鱼类"
            width="150"
            fixed
          /><el-table-column
            prop="habit"
            label="出没习性"
            min-width="320"
          /><el-table-column label="出没地点" min-width="420"
            ><template #default="{ row }"
              ><div class="inline-materials">
                <span v-for="location in row.locations" :key="location">{{
                  location
                }}</span>
              </div></template
            ></el-table-column
          ></el-table
        >
      </section>
      <section
        v-else-if="active === 'monsters'"
        class="table-panel atlas-panel"
      >
        <div class="section-title">
          <div>
            <p>共找到 {{ monsterResults.length }} 种怪物</p>
            <span>搜索材料名称，即可反查由哪些怪物掉落</span>
          </div>
        </div>
        <el-table :data="monsterResults" stripe row-key="id"
          ><el-table-column
            prop="name"
            label="怪物"
            width="180"
            fixed
          /><el-table-column
            prop="location"
            label="出现区域"
            min-width="240"
          /><el-table-column label="掉落物" min-width="480"
            ><template #default="{ row }"
              ><div class="inline-materials">
                <span v-for="drop in row.drops" :key="drop.name"
                  >{{ drop.name }} ×{{ drop.qty }}</span
                >
              </div></template
            ></el-table-column
          ></el-table
        >
      </section>
      <section v-else-if="active === 'quests'" class="table-panel atlas-panel">
        <div class="section-title">
          <div>
            <p>共找到 {{ questResults.length }} 项主线任务</p>
            <span>覆盖七章主线，完成进度自动保存在本机</span>
          </div>
        </div>
        <el-table :data="questResults" stripe row-key="id"
          ><el-table-column label="完成" width="72" fixed
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="state.questDone.includes(row.id)"
                @change="
                  toggle(state.questDone, row.id)
                " /></template></el-table-column
          ><el-table-column
            prop="chapter"
            label="章节"
            width="90"
          /><el-table-column
            prop="name"
            label="任务"
            min-width="170"
          /><el-table-column
            prop="description"
            label="任务简介"
            min-width="280"
          /><el-table-column label="任务步骤" min-width="440"
            ><template #default="{ row }"
              ><div class="quest-steps">
                <span
                  v-for="(step, index) in row.steps"
                  :key="index"
                  :class="{ 'quest-objective': !/^\d+\./.test(step) }"
                  >{{ step }}</span
                >
              </div></template
            ></el-table-column
          ><el-table-column label="玩法解锁" min-width="150"
            ><template #default="{ row }"
              ><el-tag v-if="row.unlock" type="success">{{
                row.unlock
              }}</el-tag></template
            ></el-table-column
          ></el-table
        >
      </section>
      <section v-else-if="active === 'pills'" class="table-panel atlas-panel">
        <div class="section-title">
          <div>
            <p>共找到 {{ pillResults.length }} 种丹药</p>
            <span>按效果用途分类，缺失字段不展示</span>
          </div>
        </div>
        <el-table :data="pillResults" stripe row-key="id"
          ><el-table-column
            prop="name"
            label="丹药"
            width="180"
            fixed /><el-table-column label="类型" width="130"
            ><template #default="{ row }"
              ><el-tag>{{ row.category }}</el-tag></template
            ></el-table-column
          ><el-table-column prop="effect" label="效果" min-width="520"
        /></el-table>
      </section>
      <section v-else class="price-page">
        <div class="profit-layout">
          <div class="profit-intro">
            <p class="eyebrow">售价 / 成本分析</p>
            <h2>正式版数据与社区旧版价格分层管理</h2>
            <p>
              灵植售价来自当前攻略 Excel；菜品、鱼类、素材和加工品补充了 2022
              年社区攻略图。自定义价优先，旧版价格仅作参考。
            </p>
            <el-alert
              :title="communityPrices.meta.warning"
              type="warning"
              :closable="false"
            />
            <div class="source-links">
              <a
                v-for="source in communityPrices.meta.sources"
                :key="source.url"
                :href="source.url"
                target="_blank"
                rel="noreferrer"
                >{{ source.title }}</a
              >
            </div>
            <el-button class="export-button" @click="exportUserData"
              >导出我的物价与进度</el-button
            >
          </div>
          <div class="ranking">
            <h3>最赚钱菜谱排行</h3>
            <div
              v-for="(recipe, index) in topProfits"
              :key="recipe.name"
              class="rank-row"
              @click="openRecipe(recipe)"
            >
              <b>{{ index + 1 }}</b
              ><span
                >{{ recipe.name
                }}<small
                  >{{ state.salePrices[recipe.name] ? "自定义" : "EA参考" }}售价
                  {{ recipeSalePrice(recipe) }} · 成本 {{ knownCost(recipe) }} ·
                  覆盖 {{ costCoverage(recipe) }}%</small
                ></span
              ><strong :class="{ loss: profit(recipe) < 0 }">{{
                profit(recipe)
              }}</strong>
            </div>
          </div>
        </div>
        <div class="price-tables">
          <div class="table-panel">
            <div class="table-heading">
              <div>
                <h3>菜品售价</h3>
                <p>
                  已匹配
                  {{
                    data.recipes.filter((r) =>
                      communityRecipeByName.has(r.name),
                    ).length
                  }}
                  道社区参考价
                </p>
              </div>
              <el-input
                v-model="priceSearch"
                clearable
                placeholder="搜索物品"
              />
            </div>
            <el-table
              :data="
                data.recipes.filter(
                  (r) => !priceSearch || r.name.includes(priceSearch),
                )
              "
              height="480"
              stripe
              ><el-table-column
                prop="name"
                label="菜品"
                width="135"
              /><el-table-column label="EA参考（凡/良/佳）" min-width="160"
                ><template #default="{ row }"
                  ><span v-if="communityRecipeByName.has(row.name)"
                    >{{ communityRecipeByName.get(row.name).common }} /
                    {{ communityRecipeByName.get(row.name).good }} /
                    {{ communityRecipeByName.get(row.name).excellent }}</span
                  ></template
                ></el-table-column
              ><el-table-column label="成本" width="75"
                ><template #default="{ row }"
                  ><span v-if="knownCost(row)">{{
                    knownCost(row)
                  }}</span></template
                ></el-table-column
              ><el-table-column label="覆盖" width="75"
                ><template #default="{ row }"
                  ><el-tag
                    v-if="pricedIngredients(row)"
                    :type="costCoverage(row) === 100 ? 'success' : 'warning'"
                    >{{ costCoverage(row) }}%</el-tag
                  ></template
                ></el-table-column
              ><el-table-column label="自定义售价" width="135"
                ><template #default="{ row }"
                  ><el-input-number
                    v-model="state.salePrices[row.name]"
                    :min="0"
                    :controls="false"
                    :placeholder="
                      communityRecipeByName.has(row.name)
                        ? String(communityRecipeByName.get(row.name).common)
                        : ''
                    " /></template></el-table-column
              ><el-table-column label="利润" width="80"
                ><template #default="{ row }"
                  ><b
                    v-if="recipeSalePrice(row)"
                    :class="profit(row) >= 0 ? 'gain' : 'loss'"
                    >{{ profit(row) }}</b
                  ></template
                ></el-table-column
              ></el-table
            >
          </div>
          <div class="table-panel">
            <div class="table-heading">
              <div>
                <h3>动植物与食材物价</h3>
                <p>正式攻略优先，EA 社区价次之</p>
              </div>
              <el-select
                v-model="priceCategory"
                clearable
                placeholder="全部类别"
                ><el-option
                  v-for="c in [...new Set(priceCatalog.map((i) => i.category))]"
                  :key="c"
                  :label="c"
                  :value="c"
              /></el-select>
            </div>
            <el-table :data="priceCatalog" height="480" stripe
              ><el-table-column
                prop="name"
                label="物品"
                width="110" /><el-table-column
                prop="category"
                label="类别"
                width="90"
                ><template #default="{ row }"
                  ><el-tag>{{ row.category }}</el-tag></template
                ></el-table-column
              ><el-table-column label="售价（凡/良/佳）" min-width="165"
                ><template #default="{ row }"
                  ><span v-if="row.prices"
                    >{{ row.prices.凡 }} / {{ row.prices.良 }} /
                    {{ row.prices.佳 }}
                    <small class="verified">Excel</small></span
                  ><span v-else-if="row.legacy"
                    >{{ formatQualityPrices(row.legacy) }}
                    <small class="legacy">EA</small></span
                  ></template
                ></el-table-column
              ><el-table-column label="买入价" width="75"
                ><template #default="{ row }"
                  ><span v-if="row.legacy?.buy != null">{{
                    row.legacy.buy
                  }}</span></template
                ></el-table-column
              ><el-table-column label="自定义单价" width="135"
                ><template #default="{ row }"
                  ><el-input-number
                    v-model="state.itemPrices[row.name]"
                    :min="0"
                    :controls="false"
                    :placeholder="
                      row.guidePrice ? String(row.guidePrice) : ''
                    " /></template></el-table-column
            ></el-table>
          </div>
        </div>
      </section>
    </main>
    <el-dialog
      v-model="recipeDialogVisible"
      :title="recipeDialog?.name"
      width="min(640px, 92vw)"
      ><template v-if="recipeDialog"
        ><p class="recipe-effect">{{ recipeDialog.effect }}</p>
        <h4>全部配料</h4>
        <div class="detail-ingredients">
          <div v-for="item in recipeDialog.ingredients" :key="item.name">
            <b>{{ item.name }} ×{{ item.qty }}</b
            ><span v-if="itemUnitPrice(item.name) || knownSource(item.name)"
              ><template v-if="itemUnitPrice(item.name)"
                >单价 {{ itemUnitPrice(item.name) }}</template
              ><template
                v-if="itemUnitPrice(item.name) && knownSource(item.name)"
              >
                · </template
              ><template v-if="knownSource(item.name)">{{
                knownSource(item.name)
              }}</template></span
            >
          </div>
        </div>
        <h4>售价与成本</h4>
        <p
          v-if="communityRecipeByName.has(recipeDialog.name)"
          class="legacy-note"
        >
          EA参考售价：凡
          {{ communityRecipeByName.get(recipeDialog.name).common }} / 良
          {{ communityRecipeByName.get(recipeDialog.name).good }} / 佳
          {{ communityRecipeByName.get(recipeDialog.name).excellent }}
        </p>
        <div class="price-row">
          <el-input-number
            v-model="state.salePrices[recipeDialog.name]"
            :min="0"
            :placeholder="
              communityRecipeByName.has(recipeDialog.name)
                ? String(communityRecipeByName.get(recipeDialog.name).common)
                : '成品售价'
            "
          /><span v-if="knownCost(recipeDialog)"
            >成本 {{ knownCost(recipeDialog) }}（覆盖
            {{ costCoverage(recipeDialog) }}%）</span
          ><strong
            v-if="recipeSalePrice(recipeDialog)"
            :class="profit(recipeDialog) >= 0 ? 'gain' : 'loss'"
            >{{ state.salePrices[recipeDialog.name] ? "利润" : "参考利润" }}
            {{ profit(recipeDialog) }}</strong
          >
        </div>
        <p v-if="recipeDialog.unlock" class="unlock">
          获取方式：{{ recipeDialog.unlock }}
        </p></template
      ><template #footer
        ><el-button @click="toggle(state.cooked, recipeDialog.name)">{{
          cookedSet.has(recipeDialog?.name) ? "取消做过" : "标记做过"
        }}</el-button
        ><el-button
          type="primary"
          @click="toggle(state.favorites, recipeDialog.name)"
          >{{
            favoriteSet.has(recipeDialog?.name) ? "取消收藏" : "收藏菜谱"
          }}</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
