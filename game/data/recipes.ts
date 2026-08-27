import type { CoreStats, FurnitureId } from '../types.ts';

export type CookingApplianceId = Exclude<FurnitureId, 'fridge'>;

export interface CookingRecipe {
  id: string;
  name: string;
  appliance: CookingApplianceId;
  ingredients: Record<string, number>;
  water: number;
  energy: number;
  output: string;
  description: string;
}

export const RECIPES: CookingRecipe[] = [
  { id: 'vegetable-congee', name: '蔬菜米粥', appliance: 'gas-stove', ingredients: { rice: 1, 'dried-vegetables': 1 }, water: 4, energy: 2, output: 'dish-vegetable-congee', description: '小火慢煮，比例不对时很容易糊底。' },
  { id: 'potato-stew', name: '土豆午餐肉炖锅', appliance: 'gas-stove', ingredients: { potatoes: 1, 'luncheon-meat': 1 }, water: 4, energy: 3, output: 'dish-potato-stew', description: '先煎再炖，香味大，也更耗燃料。' },
  { id: 'mushroom-noodles', name: '香菇汤面', appliance: 'gas-stove', ingredients: { 'instant-noodles': 1, 'dried-mushrooms': 1 }, water: 4, energy: 2, output: 'dish-mushroom-noodles', description: '泡发香菇后再下面，汤会更有味道。' },
  { id: 'flatbread', name: '简易油烙饼', appliance: 'gas-stove', ingredients: { flour: 1, 'cooking-oil': 1 }, water: 2, energy: 2, output: 'dish-flatbread', description: '和面比例与火候都需要一点经验。' },

  { id: 'milk-oatmeal', name: '奶香燕麦糊', appliance: 'microwave', ingredients: { oats: 1, 'milk-powder': 1 }, water: 2, energy: 2, output: 'dish-milk-oatmeal', description: '加热时间短，最适合刚开始练习。' },
  { id: 'bean-hash', name: '豆子午餐肉烩', appliance: 'microwave', ingredients: { 'canned-beans': 1, 'luncheon-meat': 1 }, water: 0, energy: 2, output: 'dish-bean-hash', description: '需要中途搅拌，否则边缘容易干硬。' },
  { id: 'microwave-potato', name: '酱香焖土豆', appliance: 'microwave', ingredients: { potatoes: 1, 'soy-sauce': 1 }, water: 2, energy: 2, output: 'dish-microwave-potato', description: '密封加热能保住水分，但时间很难判断。' },
  { id: 'steamed-egg', name: '杯装蒸蛋', appliance: 'microwave', ingredients: { 'egg-powder': 1, 'soy-sauce': 1 }, water: 2, energy: 2, output: 'dish-steamed-egg', description: '蛋液比例准确时，短时间就能凝固。' },

  { id: 'dumpling-soup', name: '蔬菜饺子汤', appliance: 'electric-hotpot', ingredients: { 'frozen-dumplings': 1, 'dried-vegetables': 1 }, water: 5, energy: 3, output: 'dish-dumpling-soup', description: '解冻后的饺子皮很脆弱，水滚得太急会破。' },
  { id: 'plain-dumplings', name: '清水煮饺子', appliance: 'electric-hotpot', ingredients: { 'frozen-dumplings': 1 }, water: 4, energy: 3, output: 'dish-boiled-dumplings', description: '只有水和速冻水饺也能成一顿饭；水开后需要及时添一次凉水。' },
  { id: 'mushroom-broth', name: '香菇清汤', appliance: 'electric-hotpot', ingredients: { 'dried-mushrooms': 1, bouillon: 1 }, water: 5, energy: 3, output: 'dish-mushroom-broth', description: '食材简单，关键是别把汤块放得太咸。' },
  { id: 'mixed-hotpot', name: '杂烩小火锅', appliance: 'electric-hotpot', ingredients: { potatoes: 1, 'luncheon-meat': 1, 'dried-vegetables': 1 }, water: 5, energy: 4, output: 'dish-mixed-hotpot', description: '食材最多、恢复最好，也最考验下锅顺序。' },
  { id: 'tomato-noodles', name: '番茄汤面', appliance: 'electric-hotpot', ingredients: { 'tomato-can': 1, 'instant-noodles': 1 }, water: 3, energy: 3, output: 'dish-tomato-noodles', description: '番茄底很容易粘锅，需要一直搅动。' },
];

export const RECIPES_BY_APPLIANCE: Record<CookingApplianceId, CookingRecipe[]> = {
  'gas-stove': RECIPES.filter((recipe) => recipe.appliance === 'gas-stove'),
  microwave: RECIPES.filter((recipe) => recipe.appliance === 'microwave'),
  'electric-hotpot': RECIPES.filter((recipe) => recipe.appliance === 'electric-hotpot'),
};

// Kept here so recipe output tuning remains next to ingredient tuning.
export const FAILED_COOKING_EFFECT: Partial<CoreStats> = { morale: -2 };
