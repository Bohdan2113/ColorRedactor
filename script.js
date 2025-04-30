const getEl = document.querySelector.bind(document);
const canvasWidth = window.innerWidth - 500;
const canvasHeight = window.innerHeight - 77;
const MaxChangesStack = 10;
let changesList = [];

// Змінні канвасу
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
canvas.width = canvasWidth;
canvas.height = canvasHeight;
// Змінні для виділення
let isDrawing = false;
let startX = 0;
let startY = 0;
let startMoveX = 0;
let startMoveY = 0;
let endX = 0;
let endY = 0;

let savedImage;
let highlightedImage;
let workableImage;
let highlightedStartX = 0;
let highlightedStartY = 0;

// ПРосто гобальні змінні
let curColorModel;

window.onload = function () {
  const colorCircle = document.getElementById("colorCircle");
  const curColorBox = getEl("#cur-colorHue");
  const curColorValue = getEl("#cur-colorText");
  const imgBlock = getEl("#imgUrl-block");
  const imgDests = [imgBlock, canvas];

  imgDests.forEach((block) => {
    block.addEventListener("drop", (event) => {
      event.preventDefault();
      imgBlock.classList.remove("dragover");

      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        loadImage(file);
      }
    });

    block.addEventListener("dragover", (event) => {
      event.preventDefault();
      const file = event.dataTransfer.items[0];
      if (file && file.type.startsWith("image/")) {
        event.dataTransfer.dropEffect = "copy";
        imgBlock.classList.add("dragover");
      } else {
        event.dataTransfer.dropEffect = "none";
      }
    });

    block.addEventListener("dragleave", () => {
      imgBlock.classList.remove("dragover");
    });
  });
  canvas.addEventListener("mousemove", function (e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing) {
      startX = startMoveX;
      startY = startMoveY;
      endX = x;
      endY = y;
      RedrawHighlight();
    }

    if (
      (startX < endX &&
        x > startX &&
        x < endX - 1 &&
        ((startY < endY && y > startY && y < endY - 1) ||
          (startY > endY && y < startY - 1 && y > endY))) ||
      (startX > endX &&
        x < startX - 1 &&
        x > endX &&
        ((startY < endY && y > startY && y < endY - 1) ||
          (startY > endY && y < startY - 1 && y > endY)))
    ) {
      colorCircle.style.left = x - colorCircle.offsetWidth / 2 + "px"; // центр по горизонталі
      colorCircle.style.top = y - colorCircle.offsetHeight + "px"; // центр низу кружечка
      colorCircle.style.display = "block";

      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const [r, g, b] = pixel;
      const color = `rgb(${r}, ${g}, ${b})`;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000; // Calculate brightness

      const bgColor = color;
      const borderColor = brightness > 128 ? "black" : "white";
      colorCircle.style.backgroundColor = bgColor;
      colorCircle.style.borderColor = borderColor;
      curColorBox.style.backgroundColor = bgColor;
      curColorValue.style.color = borderColor;

      if (curColorModel === "CMYK") {
        const cmyk = RGBtoCMYK([r, g, b]);
        curColorValue.textContent = `${curColorModel}: ${cmyk.join(", ")}`;
      } else if (curColorModel === "XYZ") {
        const xyz = RGBtoXYZ([r, g, b]);
        const roundedXYZ = xyz.map((value) => parseFloat(value.toFixed(2)));
        curColorValue.textContent = `${curColorModel}: ${roundedXYZ.join(
          ", "
        )}`;
      } else if (curColorModel === "HSL") {
        const hsl = RGBtoHSL([r, g, b]);
        curColorValue.textContent = `${curColorModel}: ${hsl[0]}°, ${hsl[1]}%, ${hsl[2]}%`;
      } else {
        curColorValue.textContent = `RGB: ${[r, g, b].join(", ")}`;
      }
    } else {
      canvas.dispatchEvent(new Event("mouseleave"));
    }
  });
  canvas.addEventListener("mousedown", (e) => {
    if (savedImage) {
      if (e.button === 0) {
        // Перевірка на ліву кнопку миші
        const rect = canvas.getBoundingClientRect();
        startMoveX = e.clientX - rect.left;
        startMoveY = e.clientY - rect.top;
        isDrawing = true;

        RestoreCanvas(ctx, workableImage);
        HighlightAll_Img();
      }
    }
  });
  canvas.addEventListener("mouseup", () => {
    isDrawing = false;
  });
  canvas.addEventListener("mouseleave", function () {
    colorCircle.style.display = "none";
    curColorBox.style.backgroundColor = "black";
    curColorValue.style.color = "white";
    curColorValue.textContent = curColorValue.textContent.split(":")[0] + ":";
  });

  initializeCMYKEvents();
  initializeXYZEvents();
  initializeHSLEvents();
};
function initializeCMYKEvents() {
  const ranges = [
    getEl("#C-cmyk"),
    getEl("#M-cmyk"),
    getEl("#Y-cmyk"),
    getEl("#K-cmyk"),
  ];
  ranges.forEach((r) => r.addEventListener("input", ChangeAtr_CMYK));
}
function initializeXYZEvents() {
  const ranges = [getEl("#X-xyz"), getEl("#Y-xyz"), getEl("#Z-xyz")];
  ranges.forEach((r) => r.addEventListener("input", ChangeAtr_XYZ));
}
function initializeHSLEvents() {
  const ranges = [getEl("#S-hsl"), getEl("#L-hsl")];
  ranges.forEach((r) => r.addEventListener("input", ChangeAtr_HSL));
}

getEl("#hsl-info-but").addEventListener("click", () => openInfo("hsl-info"));
document.addEventListener("click", (e) => {
  const infoPopups = document.querySelectorAll(".info-popup");
  const infoButtons = Array.from(document.querySelectorAll(".info-button"));

  infoPopups.forEach((infoPopup) => {
    const isClickInsidePopup = infoPopup.contains(e.target);
    const isClickOnButton = infoButtons.some((btn) => btn.contains(e.target));

    if (!isClickInsidePopup && !isClickOnButton) {
      infoPopup.classList.add("hidden");
    }
  });
});
function openInfo(infoId) {
  getEl(`#${infoId}`).classList.toggle("hidden");
}

function ChooseImg() {
  const fileInput = document.getElementById("fileInput");
  fileInput.click();
}
function handleFile(event) {
  const file = event.target.files[0];
  if (file) {
    loadImage(file);
  }
}
function loadImage(file) {
  getEl("#imgUrl-block").style.display = "none";
  getEl("#control-container").style.display = "flex";

  const forms = document.querySelectorAll(".color-form");
  forms.forEach((f) => ClearForm(f));

  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      ClearCanvas(canvas);

      // Розрахунок масштабу для вписування в канвас
      const scale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
      );
      const width = img.width * scale;
      const height = img.height * scale;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      SaveCanvas(canvas);
      HighlightAll_Img();
      switchModel("HSL");
    };
    img.src = e.target.result;
  };
}

function RemoveAll() {
  ClearWork();
  changesList = [];
}
function UndoLastChange() {
  if (changesList.length === 0) return;

  if (changesList.length > 1) changesList.pop();
  savedImage = changesList[changesList.length - 1];

  HighlightAll_Img();
  RestoreCanvas(ctx, savedImage);
  workableImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
  changesList[changesList.length - 1] = workableImage;

  const forms = document.querySelectorAll(".color-form");
  forms.forEach((f) => ClearForm(f));
}
function SaveAsBut() {
  if (!savedImage) return;
  RestoreCanvas(ctx, workableImage);
  HighlightAll_Img();

  const link = document.createElement("a");
  link.download = "color_redacted.png";
  link.href = canvas.toDataURL("image/png");
  link.click(); // Trigger the download
}
function SaveChanges() {
  if (!savedImage) return;
  RestoreCanvas(ctx, workableImage);
  HighlightAll_Img();
  SaveCanvas(canvas);

  const forms = document.querySelectorAll(".color-form");
  forms.forEach((f) => ClearForm(f));
}
function DiscardChanges() {
  if (!savedImage) return;
  ctx.putImageData(savedImage, 0, 0);
  workableImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
  changesList[changesList.length - 1] = workableImage;
  HighlightAll_Img();

  const forms = document.querySelectorAll(".color-form");
  forms.forEach((f) => ClearForm(f));
}

function ClearWork() {
  ClearCanvas(getEl("#myCanvas"));
  getEl("#imgUrl-block").style.display = "flex";
  getEl("#control-container").style.display = "none";

  const forms = document.querySelectorAll(".color-form");
  forms.forEach((f) => ClearForm(f));
}
function ClearCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  startX = 0;
  startY = 0;
  startMoveX = 0;
  startMoveY = 0;
  endX = 0;
  endY = 0;
  savedImage = null;
  workableImage = null;
  highlightedImage = null;
  highlightedStartX = 0;
  highlightedStartY = 0;
}
function ClearForm(form) {
  form.reset();

  form.querySelectorAll("input").forEach((input) => {
    const hasUpdateValue = input
      .getAttribute("oninput")
      ?.includes("updateValue");
    if (hasUpdateValue) {
      const id = input.id;
      const valueId = `${id}-value`;
      updateValue(id, valueId);
    }
  });
}
function switchModel(colorModel) {
  if (curColorModel === colorModel) return;

  if (savedImage) {
    DiscardChanges();

    const formId = colorModel.toLowerCase() + "-form";
    document.querySelectorAll(".color-form, .tab-button").forEach((form) => {
      form.classList.remove("active");
    });

    curColorModel = colorModel;
    document.getElementById(formId).classList.add("active");
    document.getElementById(`${formId}-but`).classList.add("active");
    document.getElementById("cur-colorText").textContent = colorModel + ":";

    const originalData = workableImage.data.slice();
    if (colorModel === "CMYK") ConvertImgToCMYK();
    else if (colorModel === "XYZ") ConvertImgToXYZ();
    else if (colorModel === "HSL") ConvertImgToHSL();
    HighlightAll_Img();

    const diffHead = getEl("#diff-header-text");
    diffHead.textContent = `After converting to ${colorModel}`;
    OutputDiffInfo(originalData, workableImage.data);
  }
}

function adjustValue(rangeId, diff) {
  const element = getEl(`#${rangeId}`);
  element.value = parseInt(element.value) + diff;

  element.dispatchEvent(new Event("input")); // Trigger the input event
}
function updateValue(source, dest) {
  const sourceElement = document.getElementById(source);
  const destElement = document.getElementById(dest);
  destElement.textContent = sourceElement.value;
}
function syncRanges(event, startId, endId) {
  const start = getEl(`#${startId}`);
  const end = getEl(`#${endId}`);

  let startVal = parseInt(start.value);
  let endVal = parseInt(end.value);

  if (startVal > endVal) {
    if (event.target.id === startId) end.value = startVal;
    else start.value = endVal;
  }
}

function HighlightAll_Img() {
  startX = 0;
  startY = 0;
  endX = canvas.width;
  endY = canvas.height;
  highlightedImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
  highlightedStartX = 0;
  highlightedStartY = 0;
}
function SaveCanvas(_canvas) {
  savedImage = ctx.getImageData(0, 0, _canvas.width, _canvas.height);
  workableImage = ctx.getImageData(0, 0, _canvas.width, _canvas.height);

  if (changesList.length > MaxChangesStack) changesList.shift();
  changesList.push(savedImage);
}
function RestoreCanvas(_ctx, image) {
  canvas.width = image.width;
  canvas.height = image.height;
  _ctx.putImageData(image, 0, 0);
}
function RedrawHighlight() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  RestoreCanvas(ctx, workableImage);

  if (isDrawing) {
    highlightedStartX = Math.round(Math.min(startX, endX));
    highlightedStartY = Math.round(Math.min(startY, endY));
    const highlightedEndX = Math.round(Math.max(startX, endX));
    const highlightedEndY = Math.round(Math.max(startY, endY));

    // Взяти все зображення
    highlightedImage = ctx.getImageData(
      highlightedStartX,
      highlightedStartY,
      highlightedEndX - highlightedStartX,
      highlightedEndY - highlightedStartY
    );
    const curImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = curImage.data;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;

        // Якщо піксель НЕ в середині виділення
        if (
          x < highlightedStartX ||
          x > highlightedEndX ||
          y < highlightedStartY ||
          y > highlightedEndY
        ) {
          // Затемнити піксель (наприклад на 50%)
          data[index] = data[index] * 0.5; // R
          data[index + 1] = data[index + 1] * 0.5; // G
          data[index + 2] = data[index + 2] * 0.5; // B
        }
      }
    }

    // Вставляємо змінене зображення назад
    ctx.putImageData(curImage, 0, 0);

    // Малюємо рамку поверх
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);
    ctx.setLineDash([]);
    ctx.restore();
  }
}
function InsightData(dest, source, x, y) {
  // створюємо тимчасовий канвас
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  // вставляємо туди цілу та виділену частину
  tempCtx.putImageData(dest, 0, 0);
  tempCtx.putImageData(source, x, y);

  // Повертаємо ImageData, не зберігаючи тимчасовий канвас
  return tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
}

function ConvertImgToCMYK() {
  const data = workableImage.data;

  for (let i = 0; i < data.length; i += 4) {
    let rgb = [data[i], data[i + 1], data[i + 2]];
    const cmyk = RGBtoCMYK(rgb);

    rgb = CMYKtoRGB(cmyk);
    for (let j = 0; j < 3; j++) data[i + j] = rgb[j];
  }

  RestoreCanvas(ctx, workableImage);
}
function ConvertImgToXYZ() {
  const data = workableImage.data;

  for (let i = 0; i < data.length; i += 4) {
    let rgb = [data[i], data[i + 1], data[i + 2]];
    const xyz = RGBtoXYZ(rgb);

    rgb = XYZtoRGB(xyz);
    for (let j = 0; j < 3; j++) data[i + j] = rgb[j];
  }

  RestoreCanvas(ctx, workableImage);
}
function ConvertImgToHSL() {
  const data = workableImage.data;

  for (let i = 0; i < data.length; i += 4) {
    let rgb = [data[i], data[i + 1], data[i + 2]];
    const hsl = RGBtoHSL(rgb);

    rgb = HSLtoRGB(hsl);
    for (let j = 0; j < 3; j++) {
      data[i + j] = rgb[j];
    }
  }

  RestoreCanvas(ctx, workableImage);
}

function OutputDiffInfo(originalData, workableData) {
  const acuracy = compareImages(originalData, workableData);
  const meanColorError = getMeanColorError(originalData, workableData);
  const maxColorError = getMaxColorError(originalData, workableData);
  const psnr = getPSNR(originalData, workableData);

  const diffField = getEl("#diff-text");
  diffField.innerHTML = "";

  const accuracyParagraph = document.createElement("p");
  accuracyParagraph.innerHTML = `<strong>Accuracy:</strong> ${acuracy}%`;
  diffField.appendChild(accuracyParagraph);

  const avgErrorParagraph = document.createElement("p");
  avgErrorParagraph.innerHTML = `<strong>Average color error:</strong> ${meanColorError} (out of 255)`;
  diffField.appendChild(avgErrorParagraph);

  const maxErrorParagraph = document.createElement("p");
  maxErrorParagraph.innerHTML = `<strong>Max color error:</strong> ${maxColorError.value} (out of 255)`;
  diffField.appendChild(maxErrorParagraph);

  if (maxColorError.color) {
    const maxErrorDiv = document.createElement("p");

    const colorLabel = document.createElement("p");
    colorLabel.style.display = "inline-block";
    colorLabel.innerHTML = `<strong>Color that changed the most:</strong>`;
    maxErrorDiv.appendChild(colorLabel);

    const colorSpan = document.createElement("span");
    colorSpan.id = "max-color-span";
    colorSpan.style.backgroundColor = maxColorError.color;
    maxErrorDiv.appendChild(colorSpan);

    const colorText = document.createElement("p");
    colorText.style.display = "inline-block";
    colorText.textContent = maxColorError.color;
    maxErrorDiv.appendChild(colorText);

    diffField.appendChild(maxErrorDiv);
  }

  const psnrParagraph = document.createElement("p");
  let psnrText;
  if (psnr === 0) {
    psnrText = `Infinite (perfect match)`;
  } else if (psnr > 40) {
    psnrText = `${psnr} dB (very high quality)`;
  } else if (psnr > 30) {
    psnrText = `${psnr} dB (high quality)`;
  } else if (psnr > 20) {
    psnrText = `${psnr} dB (medium quality)`;
  } else {
    psnrText = `${psnr} dB (low quality)`;
  }
  psnrParagraph.innerHTML = `<strong>PSNR:</strong> ${psnrText}`;
  diffField.appendChild(psnrParagraph);
}
function compareImages(originalData, newData) {
  const tolerance = 1; // допустима похибка в 1 одиницю кольору
  let totalPixels = 0;
  let differentPixels = 0;

  for (let i = 0; i < originalData.length; i += 4) {
    totalPixels++;

    const rDiff = Math.abs(originalData[i] - newData[i]);
    const gDiff = Math.abs(originalData[i + 1] - newData[i + 1]);
    const bDiff = Math.abs(originalData[i + 2] - newData[i + 2]);

    if (rDiff > tolerance || gDiff > tolerance || bDiff > tolerance) {
      differentPixels++;
    }
  }

  return (100 - (differentPixels / totalPixels) * 100).toFixed(2);
}
function getMeanColorError(originalData, newData) {
  let totalError = 0;
  let totalPixels = 0;

  for (let i = 0; i < originalData.length; i += 4) {
    const rDiff = Math.abs(originalData[i] - newData[i]);
    const gDiff = Math.abs(originalData[i + 1] - newData[i + 1]);
    const bDiff = Math.abs(originalData[i + 2] - newData[i + 2]);

    const pixelError = (rDiff + gDiff + bDiff) / 3; // середнє відхилення по пікселю
    totalError += pixelError;
    totalPixels++;
  }

  const meanError = totalError / totalPixels;
  return meanError.toFixed(3);
}
function getMaxColorError(originalData, newData) {
  let maxError = 0;
  let theColor = null;

  for (let i = 0; i < originalData.length; i += 4) {
    const rDiff = Math.abs(originalData[i] - newData[i]);
    const gDiff = Math.abs(originalData[i + 1] - newData[i + 1]);
    const bDiff = Math.abs(originalData[i + 2] - newData[i + 2]);

    const pixelError = (rDiff + gDiff + bDiff) / 3;
    if (pixelError > maxError) {
      maxError = pixelError;
      theColor = `rgb(${newData[i]}, ${newData[i + 1]}, ${newData[i + 2]})`;
    }
  }

  return { value: maxError.toFixed(3), color: theColor };
}
function getPSNR(originalData, newData) {
  let mse = 0;
  let totalPixels = 0;

  for (let i = 0; i < originalData.length; i += 4) {
    const rDiff = originalData[i] - newData[i];
    const gDiff = originalData[i + 1] - newData[i + 1];
    const bDiff = originalData[i + 2] - newData[i + 2];

    mse += rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
    totalPixels++;
  }

  mse = mse / (totalPixels * 3); // 3 канали на піксель

  if (mse === 0) {
    return 0;
  }

  const psnr = 10 * Math.log10((255 * 255) / mse);
  return psnr.toFixed(2);
}

function ChangeAtr_CMYK() {
  const ranges = [
    getEl("#C-cmyk"),
    getEl("#M-cmyk"),
    getEl("#Y-cmyk"),
    getEl("#K-cmyk"),
  ];
  const percentValues = ranges.map((range) => parseInt(range.value));
  const maxValues = [100, 100, 100, 100];
  console.log(percentValues);
  console.log(maxValues);

  const data = highlightedImage.data;
  const originalData = savedImage.data;

  for (let y = 0; y < highlightedImage.height; y++) {
    for (let x = 0; x < highlightedImage.width; x++) {
      const index = (y * highlightedImage.width + x) * 4;

      // координати в savedImage
      const savedX = highlightedStartX + x;
      const savedY = highlightedStartY + y;
      const savedIndex = (savedY * savedImage.width + savedX) * 4;

      const originalRGB = [
        originalData[savedIndex],
        originalData[savedIndex + 1],
        originalData[savedIndex + 2],
      ];
      const originalCMYK = RGBtoCMYK(originalRGB);

      for (let j = 0; j < originalCMYK.length; j++) {
        originalCMYK[j] = Math.round(
          CalculateNewVal(originalCMYK[j], maxValues[j], percentValues[j])
        );
      }
      let rgb = CMYKtoRGB(originalCMYK);
      for (let j = 0; j < 3; j++) data[index + j] = rgb[j];
    }
  }

  ctx.putImageData(highlightedImage, highlightedStartX, highlightedStartY);
  workableImage = InsightData(
    workableImage,
    highlightedImage,
    highlightedStartX,
    highlightedStartY
  );
}
function ChangeAtr_XYZ() {
  const ranges = [getEl("#X-xyz"), getEl("#Y-xyz"), getEl("#Z-xyz")];
  const percentValues = ranges.map((range) => parseInt(range.value));
  const maxValues = RGBtoXYZ([255, 255, 255]);

  const data = highlightedImage.data;
  const originalData = savedImage.data;

  for (let y = 0; y < highlightedImage.height; y++) {
    for (let x = 0; x < highlightedImage.width; x++) {
      const index = (y * highlightedImage.width + x) * 4;

      // координати в savedImage
      const savedX = highlightedStartX + x;
      const savedY = highlightedStartY + y;
      const savedIndex = (savedY * savedImage.width + savedX) * 4;

      let originalRGB = [
        originalData[savedIndex],
        originalData[savedIndex + 1],
        originalData[savedIndex + 2],
      ];
      const originalXYZ = RGBtoXYZ(originalRGB);

      for (let j = 0; j < originalXYZ.length; j++) {
        originalXYZ[j] = CalculateNewVal(
          originalXYZ[j],
          maxValues[j],
          percentValues[j]
        );
      }
      let rgb = XYZtoRGB(originalXYZ);
      for (let j = 0; j < 3; j++) data[index + j] = rgb[j];
    }
  }

  ctx.putImageData(highlightedImage, highlightedStartX, highlightedStartY);
  workableImage = InsightData(
    workableImage,
    highlightedImage,
    highlightedStartX,
    highlightedStartY
  );
}
function ChangeAtr_HSL() {
  const hueStart = parseInt(getEl("#hue-range-start").value);
  const hueEnd = parseInt(getEl("#hue-range-end").value);

  const ranges = [getEl("#S-hsl"), getEl("#L-hsl")];
  const percentValues = ranges.map((range) => parseInt(range.value));
  const maxValues = [360, 100, 100];

  const data = highlightedImage.data;
  const originalData = savedImage.data;

  for (let y = 0; y < highlightedImage.height; y++) {
    for (let x = 0; x < highlightedImage.width; x++) {
      const index = (y * highlightedImage.width + x) * 4;

      // координати в savedImage
      const savedX = highlightedStartX + x;
      const savedY = highlightedStartY + y;
      const savedIndex = (savedY * savedImage.width + savedX) * 4;

      let originalRGB = [
        originalData[savedIndex],
        originalData[savedIndex + 1],
        originalData[savedIndex + 2],
      ];
      const originalHSL = RGBtoHSL(originalRGB);
      if (originalHSL[0] < hueStart || originalHSL[0] > hueEnd) continue;

      for (let j = 1; j < originalHSL.length; j++) {
        originalHSL[j] = Math.round(
          CalculateNewVal(originalHSL[j], maxValues[j], percentValues[j - 1]) // percentValues[j-1] - hue не міняється
        );
      }
      let rgb = HSLtoRGB(originalHSL);
      for (let j = 0; j < 3; j++) data[index + j] = rgb[j];
    }
  }

  ctx.putImageData(highlightedImage, highlightedStartX, highlightedStartY);
  workableImage = InsightData(
    workableImage,
    highlightedImage,
    highlightedStartX,
    highlightedStartY
  );
}
function CalculateNewVal(originalVal, maxVal, percent) {
  const middlePercent = 100;
  const middleValue = maxVal / 2;

  if (percent === middlePercent) return originalVal;

  if (percent < middlePercent) {
    const decreaseMax = originalVal;
    const ratio = percent / middlePercent;
    return decreaseMax * ratio;
  } else {
    const increaseMax = maxVal - originalVal;
    const ratio = (percent - middlePercent) / middlePercent;
    return originalVal + increaseMax * ratio;
  }
}

function RGBtoCMYK([r, g, b]) {
  let [linear_R, linear_G, linear_B] = normalizeArr([r, g, b]);

  let C = 0;
  let M = 0;
  let Y = 0;
  let K = 1 - Math.max(linear_R, linear_G, linear_B);
  if (K !== 1) {
    C = (1 - linear_R - K) / (1 - K);
    M = (1 - linear_G - K) / (1 - K);
    Y = (1 - linear_B - K) / (1 - K);
  }

  C = Math.round(C * 100); // [0, 100]
  M = Math.round(M * 100); // [0, 100]
  Y = Math.round(Y * 100); // [0, 100]
  K = Math.round(K * 100); // [0, 100]

  return [C, M, Y, K];
}
function CMYKtoRGB([c, m, y, k]) {
  c /= 100;
  m /= 100;
  y /= 100;
  k /= 100;

  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));

  return [r, g, b];
}
function RGBtoXYZ([R, G, B]) {
  const [var_R, var_G, var_B] = [R, G, B]
    .map((x) => x / 255)
    .map((x) => (x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92))
    .map((x) => x * 100);

  // Observer. = 2°, Illuminant = D65
  let X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805;
  let Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722;
  let Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505;
  return [X, Y, Z];
}
function XYZtoRGB([X, Y, Z]) {
  //X, Y and Z input refer to a D65/2° standard illuminant.
  //sR, sG and sB (standard RGB) output range = 0 ÷ 255

  let var_X = X / 100;
  let var_Y = Y / 100;
  let var_Z = Z / 100;

  let var_R = var_X * 3.2406 + var_Y * -1.5372 + var_Z * -0.4986;
  let var_G = var_X * -0.9689 + var_Y * 1.8758 + var_Z * 0.0415;
  let var_B = var_X * 0.0557 + var_Y * -0.204 + var_Z * 1.057;

  return [var_R, var_G, var_B]
    .map((n) =>
      n > 0.0031308 ? 1.055 * Math.pow(n, 1 / 2.4) - 0.055 : 12.92 * n
    )
    .map((n) => Math.round(n * 255));
}
function RGBtoHSL([r, g, b]) {
  let [linear_R, linear_G, linear_B] = normalizeArr([r, g, b]);

  // get the min and max of r,g,b
  let max = Math.max(linear_R, linear_G, linear_B);
  let min = Math.min(linear_R, linear_G, linear_B);

  // lightness is the average of the largest and smallest color components
  let lum = (max + min) / 2;
  let hue;
  let sat;

  if (max == min) {
    // no saturation
    hue = 0;
    sat = 0;
  } else {
    let c = max - min; // chroma
    // saturation is simply the chroma scaled to fill
    // the interval [0, 1] for every combination of hue and lightness
    sat = c / (1 - Math.abs(2 * lum - 1));
    let segment;
    let shift;
    switch (max) {
      case linear_R:
        segment = (linear_G - linear_B) / c;
        shift = 0 / 60; // R° / (360° / hex sides)
        if (segment < 0) {
          // hue > 180, full rotation
          shift = 360 / 60; // R° / (360° / hex sides)
        }
        hue = segment + shift;
        break;
      case linear_G:
        segment = (linear_B - linear_R) / c;
        shift = 120 / 60; // G° / (360° / hex sides)
        hue = segment + shift;
        break;
      case linear_B:
        segment = (linear_R - linear_G) / c;
        shift = 240 / 60; // B° / (360° / hex sides)
        hue = segment + shift;
        break;
    }
  }
  hue = Math.round(hue * 60); // [0, 360]°
  sat = Math.round(sat * 100); // [0, 100]%
  lum = Math.round(lum * 100); // [0, 100']%
  return [hue, sat, lum];
}
function HSLtoRGB([h, s, l]) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return [r, g, b];
}
function normalizeArr(arr) {
  return arr.map((x) => parseFloat(x / 255));
}
