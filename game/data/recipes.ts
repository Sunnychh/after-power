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
  { id: 'tomato-rice', name: '锅底番茄焖饭', appliance: 'gas-stove', ingredients: { rice: 1, 'tomato-can': 1 }, water: 4, energy: 3, output: 'dish-tomato-rice', description: '番茄汤汁慢慢收进米里，锅底会结一层脆壳。' },
  { id: 'pan-fried-dumplings', name: '应急锅贴', appliance: 'gas-stove', ingredients: { 'frozen-dumplings': 1, 'cooking-oil': 1 }, water: 2, energy: 3, output: 'dish-pan-fried-dumplings', description: '先煎底再沿锅边补水，能把已经解冻的饺子救回来。' },
  { id: 'savory-oat-broth', name: '咸味燕麦菌汤', appliance: 'gas-stove', ingredients: { oats: 1, 'dried-mushrooms': 1, bouillon: 1 }, water: 5, energy: 3, output: 'dish-savory-oat-broth', description: '燕麦把汤熬得过分浓稠，香菇和汤块勉强把它拉回正餐。' },
  { id: 'egg-drop-dough', name: '蛋花面疙瘩', appliance: 'gas-stove', ingredients: { flour: 1, 'egg-powder': 1 }, water: 4, energy: 3, output: 'dish-egg-drop-dough', description: '把面粉拨进蛋汤里，疙瘩大小全凭手感。' },
  { id: 'coffee-glazed-meat', name: '咖啡焦边午餐肉', appliance: 'gas-stove', ingredients: { 'luncheon-meat': 1, 'instant-coffee': 1, 'cooking-oil': 1 }, water: 0, energy: 3, output: 'dish-coffee-glazed-meat', description: '苦味咖啡在肉片边缘结成薄壳，闻起来荒唐，入口却意外像焦糖。' },
  { id: 'milky-rice', name: '避难所奶香甜饭', appliance: 'gas-stove', ingredients: { rice: 1, 'milk-powder': 1 }, water: 4, energy: 3, output: 'dish-milky-rice', description: '没有糖，只靠奶粉的甜味把一碗软饭变成简陋甜点。' },

  { id: 'milk-oatmeal', name: '奶香燕麦糊', appliance: 'microwave', ingredients: { oats: 1, 'milk-powder': 1 }, water: 2, energy: 2, output: 'dish-milk-oatmeal', description: '加热时间短，最适合刚开始练习。' },
  { id: 'bean-hash', name: '豆子午餐肉烩', appliance: 'microwave', ingredients: { 'canned-beans': 1, 'luncheon-meat': 1 }, water: 0, energy: 2, output: 'dish-bean-hash', description: '需要中途搅拌，否则边缘容易干硬。' },
  { id: 'microwave-potato', name: '酱香焖土豆', appliance: 'microwave', ingredients: { potatoes: 1, 'soy-sauce': 1 }, water: 2, energy: 2, output: 'dish-microwave-potato', description: '密封加热能保住水分，但时间很难判断。' },
  { id: 'steamed-egg', name: '杯装蒸蛋', appliance: 'microwave', ingredients: { 'egg-powder': 1, 'soy-sauce': 1 }, water: 2, energy: 2, output: 'dish-steamed-egg', description: '蛋液比例准确时，短时间就能凝固。' },
  { id: 'cup-noodle-custard', name: '杯面蛋羹', appliance: 'microwave', ingredients: { 'instant-noodles': 1, 'egg-powder': 1 }, water: 3, energy: 2, output: 'dish-cup-noodle-custard', description: '掰碎面饼泡进蛋液，成品介于蛋羹和泡面之间。' },
  { id: 'tomato-baked-beans', name: '番茄焗豆', appliance: 'microwave', ingredients: { 'canned-beans': 1, 'tomato-can': 1 }, water: 0, energy: 2, output: 'dish-tomato-baked-beans', description: '酸味让罐头豆没那么单调，边缘烤得略微发干。' },
  { id: 'soft-cracker-pudding', name: '软心饼干布丁', appliance: 'microwave', ingredients: { crackers: 1, 'milk-powder': 1 }, water: 2, energy: 2, output: 'dish-soft-cracker-pudding', description: '压缩饼干吸饱奶液，口感古怪，却是一份真正的甜口热食。' },
  { id: 'coffee-oat-slab', name: '咖啡燕麦砖', appliance: 'microwave', ingredients: { oats: 1, 'instant-coffee': 1 }, water: 1, energy: 2, output: 'dish-coffee-oat-slab', description: '燕麦被加热成紧实方块，苦得清醒，也很顶饿。' },
  { id: 'tomato-steamed-dumplings', name: '番茄汽蒸饺', appliance: 'microwave', ingredients: { 'frozen-dumplings': 1, 'tomato-can': 1 }, water: 1, energy: 3, output: 'dish-tomato-steamed-dumplings', description: '番茄汁在密封盒里变成蒸汽，饺子皮染成浅红色。' },
  { id: 'chocolate-baked-apple', name: '黑巧烤苹果', appliance: 'microwave', ingredients: { 'fresh-apples': 1, chocolate: 1 }, water: 0, energy: 2, output: 'dish-chocolate-baked-apple', description: '苹果软塌，黑巧克力融进果汁里，是停电前才会嫌寒酸的甜点。' },

  { id: 'dumpling-soup', name: '蔬菜饺子汤', appliance: 'electric-hotpot', ingredients: { 'frozen-dumplings': 1, 'dried-vegetables': 1 }, water: 5, energy: 3, output: 'dish-dumpling-soup', description: '解冻后的饺子皮很脆弱，水滚得太急会破。' },
  { id: 'plain-dumplings', name: '清水煮饺子', appliance: 'electric-hotpot', ingredients: { 'frozen-dumplings': 1 }, water: 4, energy: 3, output: 'dish-boiled-dumplings', description: '只有水和速冻水饺也能成一顿饭；水开后需要及时添一次凉水。' },
  { id: 'mushroom-broth', name: '香菇清汤', appliance: 'electric-hotpot', ingredients: { 'dried-mushrooms': 1, bouillon: 1 }, water: 5, energy: 3, output: 'dish-mushroom-broth', description: '食材简单，关键是别把汤块放得太咸。' },
  { id: 'mixed-hotpot', name: '杂烩小火锅', appliance: 'electric-hotpot', ingredients: { potatoes: 1, 'luncheon-meat': 1, 'dried-vegetables': 1 }, water: 5, energy: 4, output: 'dish-mixed-hotpot', description: '食材最多、恢复最好，也最考验下锅顺序。' },
  { id: 'tomato-noodles', name: '番茄汤面', appliance: 'electric-hotpot', ingredients: { 'tomato-can': 1, 'instant-noodles': 1 }, water: 3, energy: 3, output: 'dish-tomato-noodles', description: '番茄底很容易粘锅，需要一直搅动。' },
  { id: 'bean-vegetable-soup', name: '豆蔬浓汤', appliance: 'electric-hotpot', ingredients: { 'canned-beans': 1, 'dried-vegetables': 1, bouillon: 1 }, water: 5, energy: 3, output: 'dish-bean-vegetable-soup', description: '罐头豆把清汤熬稠，脱水蔬菜提供了难得的嚼劲。' },
  { id: 'egg-rice-porridge', name: '酱油蛋花粥', appliance: 'electric-hotpot', ingredients: { rice: 1, 'egg-powder': 1, 'soy-sauce': 1 }, water: 5, energy: 4, output: 'dish-egg-rice-porridge', description: '米粥滚开后慢慢倒入蛋液，酱油只用来补一点颜色。' },
  { id: 'red-three-veg-pot', name: '红汤三蔬锅', appliance: 'electric-hotpot', ingredients: { potatoes: 1, 'tomato-can': 1, 'dried-mushrooms': 1 }, water: 4, energy: 4, output: 'dish-red-three-veg-pot', description: '没有新鲜菜，三种耐储食材仍能煮出层次分明的一锅。' },
  { id: 'cracker-bouillon-soup', name: '饼干浓汤', appliance: 'electric-hotpot', ingredients: { crackers: 1, bouillon: 1 }, water: 5, energy: 3, output: 'dish-cracker-bouillon-soup', description: '压缩饼干在汤里完全化开，像一碗咸味很重的糊。' },
  { id: 'apple-mushroom-broth', name: '苹果香菇汤', appliance: 'electric-hotpot', ingredients: { 'fresh-apples': 1, 'dried-mushrooms': 1, bouillon: 1 }, water: 5, energy: 3, output: 'dish-apple-mushroom-broth', description: '果酸、菌香和盐味挤在一起，是一碗猎奇但并不难喝的清汤。' },
];

export const RECIPES_BY_APPLIANCE: Record<CookingApplianceId, CookingRecipe[]> = {
  'gas-stove': RECIPES.filter((recipe) => recipe.appliance === 'gas-stove'),
  microwave: RECIPES.filter((recipe) => recipe.appliance === 'microwave'),
  'electric-hotpot': RECIPES.filter((recipe) => recipe.appliance === 'electric-hotpot'),
};

// Kept here so recipe output tuning remains next to ingredient tuning.
export const FAILED_COOKING_EFFECT: Partial<CoreStats> = { morale: -2 };
