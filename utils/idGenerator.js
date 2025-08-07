// utils/idGenerator.js
const generateModelId = (manufacturer, modelName) => {
  const manufacturerCode = manufacturer.substring(0, 3).toUpperCase();
  const modelCode = modelName.substring(0, 3).toUpperCase();
  const randomNum = Math.floor(100 + Math.random() * 900); // 3-digit random number
  return `MOD-${manufacturerCode}${modelCode}${randomNum}`;
};

const generateColorId = (modelId, colorName) => {
  const colorCode = colorName.substring(0, 3).toUpperCase();
  const randomNum = Math.floor(100 + Math.random() * 900); // 3-digit random number
  return `COL-${modelId.substring(0, 5)}${colorCode}${randomNum}`;
};

module.exports = {
  generateModelId,
  generateColorId
};