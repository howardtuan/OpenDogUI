(() => {
  const canvas = document.getElementById("avatarCanvas");
  const ctx = canvas.getContext("2d");
  const uploadInput = document.getElementById("imageUpload");
  const uploadDrop = document.querySelector(".upload-drop");
  const thumbList = document.getElementById("thumbList");
  const statusText = document.getElementById("statusText");
  const downloadButtons = [
    document.getElementById("downloadArtwork"),
    document.getElementById("downloadArtworkSide"),
  ];
  const clearSelectionButton = document.getElementById("clearSelection");
  const selectedName = document.getElementById("selectedName");
  const selectedHint = document.getElementById("selectedHint");
  const sizeRange = document.getElementById("sizeRange");
  const rotationRange = document.getElementById("rotationRange");
  const opacityRange = document.getElementById("opacityRange");
  const bringForwardButton = document.getElementById("bringForward");
  const sendBackwardButton = document.getElementById("sendBackward");
  const deleteSelectedButton = document.getElementById("deleteSelected");
  const resetCanvasButton = document.getElementById("resetCanvas");

  const state = {
    dogLoaded: false,
    items: [],
    selectedId: null,
    pointer: null,
    idSeed: 1,
  };

  const dogImage = new Image();
  dogImage.onload = () => {
    state.dogLoaded = true;
    statusText.textContent = "拖曳裝飾可以移動；角落可以縮放，上方圓點可以旋轉。";
    render();
  };
  dogImage.onerror = () => {
    statusText.textContent = "狗頭載入失敗，請確認 static/assets/dog.jpg 存在。";
  };
  dogImage.src = window.OPENDOG?.dogPhotoUrl || "/dog-photo";

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const toDegrees = (radians) => Math.round((radians * 180) / Math.PI);
  const toRadians = (degrees) => (Number(degrees) * Math.PI) / 180;
  const normalizeDegrees = (degrees) => ((((degrees + 180) % 360) + 360) % 360) - 180;

  function selectedItem() {
    return state.items.find((item) => item.id === state.selectedId) || null;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function localPoint(item, point) {
    const dx = point.x - item.x;
    const dy = point.y - item.y;
    const cos = Math.cos(item.rotation);
    const sin = Math.sin(item.rotation);

    return {
      x: dx * cos + dy * sin,
      y: -dx * sin + dy * cos,
    };
  }

  function handlePoints(item) {
    const halfW = item.width / 2;
    const halfH = item.height / 2;

    return [
      { x: -halfW, y: -halfH, action: "resize" },
      { x: halfW, y: -halfH, action: "resize" },
      { x: -halfW, y: halfH, action: "resize" },
      { x: halfW, y: halfH, action: "resize" },
      { x: 0, y: -halfH - 78, action: "rotate" },
    ];
  }

  function hitTest(point) {
    for (let index = state.items.length - 1; index >= 0; index -= 1) {
      const item = state.items[index];
      const local = localPoint(item, point);
      const handles = handlePoints(item);

      for (const handle of handles) {
        const dist = Math.hypot(local.x - handle.x, local.y - handle.y);
        if (dist <= 30) {
          return { item, action: handle.action };
        }
      }

      if (
        local.x >= -item.width / 2 &&
        local.x <= item.width / 2 &&
        local.y >= -item.height / 2 &&
        local.y <= item.height / 2
      ) {
        return { item, action: "move" };
      }
    }

    return null;
  }

  function drawDog(targetCtx) {
    targetCtx.drawImage(dogImage, 0, 0, canvas.width, canvas.height);
  }

  function drawItem(targetCtx, item) {
    targetCtx.save();
    targetCtx.translate(item.x, item.y);
    targetCtx.rotate(item.rotation);
    targetCtx.globalAlpha = item.opacity;
    targetCtx.drawImage(item.image, -item.width / 2, -item.height / 2, item.width, item.height);
    targetCtx.restore();
  }

  function drawSelection(targetCtx, item) {
    const halfW = item.width / 2;
    const halfH = item.height / 2;

    targetCtx.save();
    targetCtx.translate(item.x, item.y);
    targetCtx.rotate(item.rotation);
    targetCtx.strokeStyle = "rgba(0, 122, 255, 0.95)";
    targetCtx.lineWidth = 5;
    targetCtx.setLineDash([18, 12]);
    targetCtx.strokeRect(-halfW, -halfH, item.width, item.height);
    targetCtx.setLineDash([]);

    targetCtx.beginPath();
    targetCtx.moveTo(0, -halfH);
    targetCtx.lineTo(0, -halfH - 58);
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    targetCtx.lineWidth = 7;
    targetCtx.stroke();
    targetCtx.strokeStyle = "rgba(0, 122, 255, 0.9)";
    targetCtx.lineWidth = 3;
    targetCtx.stroke();

    for (const handle of handlePoints(item)) {
      targetCtx.beginPath();
      targetCtx.arc(handle.x, handle.y, handle.action === "rotate" ? 18 : 15, 0, Math.PI * 2);
      targetCtx.fillStyle = handle.action === "rotate" ? "#007aff" : "#ffffff";
      targetCtx.strokeStyle = "#007aff";
      targetCtx.lineWidth = 5;
      targetCtx.fill();
      targetCtx.stroke();
    }

    targetCtx.restore();
  }

  function drawScene(targetCtx, includeSelection = true) {
    targetCtx.clearRect(0, 0, canvas.width, canvas.height);

    if (!state.dogLoaded) {
      targetCtx.fillStyle = "#b6eff6";
      targetCtx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    drawDog(targetCtx);
    state.items.forEach((item) => drawItem(targetCtx, item));

    if (includeSelection) {
      const item = selectedItem();
      if (item) {
        drawSelection(targetCtx, item);
      }
    }
  }

  function render() {
    drawScene(ctx, true);
    renderThumbs();
    updateControls();
  }

  function updateControls() {
    const item = selectedItem();
    const hasSelection = Boolean(item);

    [sizeRange, rotationRange, opacityRange, bringForwardButton, sendBackwardButton, deleteSelectedButton].forEach(
      (control) => {
        control.disabled = !hasSelection;
      },
    );

    if (!item) {
      selectedName.textContent = "沒有選取物件";
      selectedHint.textContent = "點一下畫布上的裝飾，或從素材列表選取。";
      sizeRange.value = "28";
      rotationRange.value = "0";
      opacityRange.value = "100";
      return;
    }

    selectedName.textContent = item.name;
    selectedHint.textContent = `位置 ${Math.round(item.x)}, ${Math.round(item.y)}`;
    sizeRange.value = String(Math.round((item.width / canvas.width) * 100));
    rotationRange.value = String(normalizeDegrees(toDegrees(item.rotation)));
    opacityRange.value = String(Math.round(item.opacity * 100));
  }

  function renderThumbs() {
    thumbList.replaceChildren();

    if (!state.items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "尚未上傳裝飾。";
      thumbList.append(empty);
      return;
    }

    state.items
      .slice()
      .reverse()
      .forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `thumb-button${item.id === state.selectedId ? " is-selected" : ""}`;
        button.addEventListener("click", () => {
          state.selectedId = item.id;
          render();
        });

        const img = document.createElement("img");
        img.src = item.src;
        img.alt = `${item.name} 縮圖`;

        const copy = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = item.name;
        const meta = document.createElement("small");
        meta.textContent = "點選後可調整";
        copy.append(title, meta);

        button.append(img, copy);
        thumbList.append(button);
      });
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      if (file.type && !file.type.startsWith("image/")) {
        reject(new Error(`${file.name} 不是圖片檔`));
        return;
      }

      const src = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ image, src });
      image.onerror = () => {
        URL.revokeObjectURL(src);
        reject(new Error(`${file.name} 載入失敗`));
      };
      image.src = src;
    });
  }

  async function addFiles(files) {
    const imageFiles = Array.from(files || []);
    if (!imageFiles.length) {
      return;
    }

    let added = 0;
    for (const file of imageFiles) {
      try {
        const { image, src } = await loadImage(file);
        const aspect = image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
        const width = canvas.width * 0.28;
        const height = width / aspect;
        const item = {
          id: `item-${state.idSeed}`,
          name: file.name,
          image,
          src,
          x: canvas.width / 2,
          y: canvas.height * 0.34 + added * 34,
          width,
          height,
          aspect,
          rotation: 0,
          opacity: 1,
        };

        state.idSeed += 1;
        state.items.push(item);
        state.selectedId = item.id;
        added += 1;
      } catch (error) {
        statusText.textContent = error.message;
      }
    }

    if (added) {
      statusText.textContent = `已加入 ${added} 個裝飾。`;
    }

    uploadInput.value = "";
    render();
  }

  function beginPointer(event) {
    const point = canvasPoint(event);
    const hit = hitTest(point);

    if (!hit) {
      state.selectedId = null;
      render();
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");

    const { item, action } = hit;
    state.selectedId = item.id;
    state.pointer = {
      action,
      id: event.pointerId,
      startPoint: point,
      startX: item.x,
      startY: item.y,
      startWidth: item.width,
      startHeight: item.height,
      startRotation: item.rotation,
      startDistance: Math.max(1, Math.hypot(point.x - item.x, point.y - item.y)),
      startAngle: Math.atan2(point.y - item.y, point.x - item.x),
    };

    render();
  }

  function movePointer(event) {
    if (!state.pointer || state.pointer.id !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const point = canvasPoint(event);
    const item = selectedItem();
    if (!item) {
      return;
    }

    if (state.pointer.action === "move") {
      const dx = point.x - state.pointer.startPoint.x;
      const dy = point.y - state.pointer.startPoint.y;
      item.x = clamp(state.pointer.startX + dx, -item.width, canvas.width + item.width);
      item.y = clamp(state.pointer.startY + dy, -item.height, canvas.height + item.height);
      statusText.textContent = "正在移動裝飾。";
    }

    if (state.pointer.action === "resize") {
      const nextDistance = Math.max(1, Math.hypot(point.x - item.x, point.y - item.y));
      const scale = clamp(nextDistance / state.pointer.startDistance, 0.16, 5.6);
      item.width = clamp(state.pointer.startWidth * scale, 44, canvas.width * 1.6);
      item.height = item.width / item.aspect;
      statusText.textContent = "正在調整大小。";
    }

    if (state.pointer.action === "rotate") {
      const nextAngle = Math.atan2(point.y - item.y, point.x - item.x);
      item.rotation = state.pointer.startRotation + (nextAngle - state.pointer.startAngle);
      statusText.textContent = "正在旋轉裝飾。";
    }

    render();
  }

  function endPointer(event) {
    if (state.pointer?.id === event.pointerId) {
      state.pointer = null;
      canvas.classList.remove("is-dragging");
      statusText.textContent = "已更新畫布。";
      render();
    }
  }

  function updateSelectedFromRange() {
    const item = selectedItem();
    if (!item) {
      return;
    }

    item.width = clamp((Number(sizeRange.value) / 100) * canvas.width, 44, canvas.width * 1.6);
    item.height = item.width / item.aspect;
    item.rotation = toRadians(rotationRange.value);
    item.opacity = Number(opacityRange.value) / 100;
    statusText.textContent = "已套用微調。";
    render();
  }

  function bringForward() {
    const index = state.items.findIndex((item) => item.id === state.selectedId);
    if (index < 0 || index === state.items.length - 1) {
      return;
    }

    const [item] = state.items.splice(index, 1);
    state.items.splice(index + 1, 0, item);
    render();
  }

  function sendBackward() {
    const index = state.items.findIndex((item) => item.id === state.selectedId);
    if (index <= 0) {
      return;
    }

    const [item] = state.items.splice(index, 1);
    state.items.splice(index - 1, 0, item);
    render();
  }

  function deleteSelected() {
    const item = selectedItem();
    if (!item) {
      return;
    }

    URL.revokeObjectURL(item.src);
    state.items = state.items.filter((candidate) => candidate.id !== item.id);
    state.selectedId = null;
    statusText.textContent = "已刪除選取物件。";
    render();
  }

  function resetCanvas() {
    state.items.forEach((item) => URL.revokeObjectURL(item.src));
    state.items = [];
    state.selectedId = null;
    state.pointer = null;
    statusText.textContent = "畫布已重置。";
    render();
  }

  function downloadArtwork() {
    if (!state.dogLoaded) {
      statusText.textContent = "狗頭還在載入，請稍等一下。";
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    drawScene(exportCtx, false);

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        statusText.textContent = "下載失敗，請再試一次。";
        return;
      }

      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "opendog-avatar.png";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      statusText.textContent = "作品已下載。";
    }, "image/png");
  }

  uploadInput.addEventListener("change", (event) => addFiles(event.target.files));
  uploadDrop.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadDrop.classList.add("is-dragging");
  });
  uploadDrop.addEventListener("dragleave", () => uploadDrop.classList.remove("is-dragging"));
  uploadDrop.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadDrop.classList.remove("is-dragging");
    addFiles(event.dataTransfer.files);
  });

  canvas.addEventListener("pointerdown", beginPointer);
  canvas.addEventListener("pointermove", movePointer);
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  [sizeRange, rotationRange, opacityRange].forEach((range) => {
    range.addEventListener("input", updateSelectedFromRange);
  });

  clearSelectionButton.addEventListener("click", () => {
    state.selectedId = null;
    render();
  });
  bringForwardButton.addEventListener("click", bringForward);
  sendBackwardButton.addEventListener("click", sendBackward);
  deleteSelectedButton.addEventListener("click", deleteSelected);
  resetCanvasButton.addEventListener("click", resetCanvas);
  downloadButtons.forEach((button) => button.addEventListener("click", downloadArtwork));

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isEditingControl =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable;

    if (isEditingControl) {
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && selectedItem()) {
      event.preventDefault();
      deleteSelected();
    }
  });
})();
