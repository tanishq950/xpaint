const canvas = document.getElementById("paintCanvas");
const context = canvas.getContext("2d");
const canvasFrame = document.querySelector(".canvas-frame");
const statusMessage = document.getElementById("statusMessage");
const colorPicker = document.getElementById("colorPicker");
const colorPreview = document.getElementById("colorPreview");
const sizeRange = document.getElementById("sizeRange");
const sizeValue = document.getElementById("sizeValue");
const fillToggle = document.getElementById("fillToggle");
const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");

let tool = "pencil";
let color = colorPicker.value;
let brushSize = Number(sizeRange.value);
let isDrawing = false;
let startPoint = null;
let snapshot = null;
let undoStack = [];
let redoStack = [];

function setStatus(message) {
  statusMessage.textContent = message;
}

function resizeCanvas() {
  const oldCanvas = document.createElement("canvas");
  oldCanvas.width = canvas.width;
  oldCanvas.height = canvas.height;
  if (canvas.width && canvas.height) oldCanvas.getContext("2d").drawImage(canvas, 0, 0);

  const width = Math.max(320, Math.floor(canvasFrame.clientWidth - 20));
  const height = Math.max(300, Math.floor(Math.min(window.innerHeight * 0.68, 680)));
  const image = oldCanvas.width && oldCanvas.height ? oldCanvas : null;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  if (image) context.drawImage(image, 0, 0, Math.min(image.width, width), Math.min(image.height, height));
}

function updateHistoryButtons() {
  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function saveState() {
  undoStack.push(canvas.toDataURL());
  if (undoStack.length > 30) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function restoreState(dataUrl) {
  const image = new Image();
  image.onload = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    updateHistoryButtons();
  };
  image.src = dataUrl;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(canvas.toDataURL());
  restoreState(undoStack.pop());
  setStatus("Undo complete");
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(canvas.toDataURL());
  restoreState(redoStack.pop());
  setStatus("Redo complete");
}

function getPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
  };
}

function configureStroke() {
  context.lineWidth = brushSize;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = tool === "eraser" ? "#ffffff" : color;
  context.fillStyle = color;
}

function drawShape(endPoint) {
  const { x: startX, y: startY } = startPoint;
  const { x: endX, y: endY } = endPoint;
  const width = endX - startX;
  const height = endY - startY;
  configureStroke();
  context.beginPath();

  if (tool === "line") {
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
  } else if (tool === "rectangle") {
    context.rect(startX, startY, width, height);
  } else {
    context.moveTo(startX + width / 2, startY);
    context.lineTo(startX + width, endY);
    context.lineTo(startX, endY);
    context.closePath();
  }

  if (tool !== "line" && fillToggle.checked) {
    context.globalAlpha = 0.22;
    context.fill();
    context.globalAlpha = 1;
  }
  context.stroke();
}

function drawCircle(endPoint) {
  const radius = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
  configureStroke();
  context.beginPath();
  context.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);
  if (fillToggle.checked) {
    context.globalAlpha = 0.22;
    context.fill();
    context.globalAlpha = 1;
  }
  context.stroke();
}

function drawText(point) {
  const text = window.prompt("Enter text to add:");
  if (!text) return;
  saveState();
  configureStroke();
  context.font = `${Math.max(14, brushSize * 4)}px "Segoe UI", sans-serif`;
  context.fillStyle = color;
  context.fillText(text, point.x, point.y);
  setStatus("Text added");
}

function startDrawing(event) {
  event.preventDefault();
  const point = getPoint(event);
  if (tool === "text") {
    drawText(point);
    return;
  }
  saveState();
  isDrawing = true;
  startPoint = point;
  snapshot = context.getImageData(0, 0, canvas.width, canvas.height);
  configureStroke();
  context.beginPath();
  context.moveTo(point.x, point.y);
  if (tool === "pencil" || tool === "eraser") context.lineTo(point.x + 0.01, point.y + 0.01);
  context.stroke();
  canvas.setPointerCapture(event.pointerId);
}

function draw(event) {
  if (!isDrawing) return;
  const point = getPoint(event);
  if (tool === "pencil" || tool === "eraser") {
    configureStroke();
    context.lineTo(point.x, point.y);
    context.stroke();
    return;
  }
  context.putImageData(snapshot, 0, 0);
  if (tool === "circle") drawCircle(point);
  else drawShape(point);
}

function stopDrawing(event) {
  if (!isDrawing) return;
  isDrawing = false;
  if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  startPoint = null;
  snapshot = null;
  setStatus(`${tool[0].toUpperCase()}${tool.slice(1)} applied`);
}

function setTool(nextTool) {
  tool = nextTool;
  document.querySelectorAll(".tool-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  canvas.style.cursor = tool === "text" ? "text" : "crosshair";
  setStatus(`${tool[0].toUpperCase()}${tool.slice(1)} selected`);
}

function setColor(nextColor) {
  color = nextColor;
  colorPicker.value = color;
  colorPreview.style.background = color;
}

function clearCanvas() {
  if (!window.confirm("Clear the whole canvas?")) return;
  saveState();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  setStatus("Canvas cleared");
}

function savePng() {
  const link = document.createElement("a");
  link.download = `cg-paint-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  setStatus("PNG saved");
}

document.querySelectorAll(".tool-button").forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool));
});
document.querySelectorAll(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => setColor(swatch.dataset.color));
});
colorPicker.addEventListener("input", (event) => setColor(event.target.value));
sizeRange.addEventListener("input", (event) => {
  brushSize = Number(event.target.value);
  sizeValue.textContent = `${brushSize} px`;
});
canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
document.getElementById("clearButton").addEventListener("click", clearCanvas);
document.getElementById("saveButton").addEventListener("click", savePng);

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  } else if (event.ctrlKey && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
  } else if (!event.ctrlKey && !event.altKey) {
    const shortcuts = { p: "pencil", l: "line", r: "rectangle", c: "circle", t: "triangle", x: "text", e: "eraser" };
    if (shortcuts[event.key.toLowerCase()]) setTool(shortcuts[event.key.toLowerCase()]);
  }
});

window.addEventListener("resize", resizeCanvas);
setColor(color);
resizeCanvas();
updateHistoryButtons();
