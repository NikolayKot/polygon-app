class WorkZone extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });

		this.polygons = new Map();
		this.scale = 1;
		this.minScale = 0.1;
		this.maxScale = 10;

		this.isPanning = false;
		this.panStart = { x: 0, y: 0 };
		this.panOffset = { x: 0, y: 0 };

		this.isDraggingPolygon = false;
		this.draggedPolygon = null;
		this.dragOffset = { x: 0, y: 0 };

		this.selectedPolygon = null;

		this.init();
	}

	init() {
		this.render();
		this.attachEventListeners();
		this.resetView();
	}

	render() {
		this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background-color: rgb(51, 51, 51);
                    position: relative;
                    overflow: hidden;
                    user-select: none;
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                }

                .work-header {
                    background: rgba(255, 255, 255, 0.95);
                    padding: 16px 20px;
                    border-bottom: 1px solid #dee2e6;
                    display: flex;
                    justify-content: end;
                    align-items: center;
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 200;
                    backdrop-filter: blur(10px);
                    height: 62px;
                    box-sizing: border-box;
                }

                .work-controls {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .zoom-controls {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                    background: #f8f9fa;
                    padding: 6px;
                    border-radius: 8px;
                    border: 1px solid #dee2e6;
                }

                .zoom-btn {
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    transition: all 0.2s;
                    font-size: 16px;
                }

                .zoom-btn:hover {
                    background: #e9ecef;
                    transform: scale(1.1);
                }

                .zoom-level {
                    font-size: 12px;
                    color: #6c757d;
                    min-width: 45px;
                    text-align: center;
                    font-weight: 500;
                }

                .work-canvas {
                    position: absolute;
                    top: 62px;
                    left: 50px;
                    right: 0;
                    bottom: 30px;
                    cursor: grab;
                    overflow: hidden;
                    background-color: rgb(51, 51, 51);
                    box-sizing: border-box;
                }

                .work-canvas.panning {
                    cursor: grabbing;
                }

                .main-svg {
                    width: 100%;
                    height: 100%;
                    display: block;
                }

                .polygon-group {
                    cursor: move;
                    transition: filter 0.2s ease;
                }

                .polygon-group:hover {
                    filter: brightness(1.2) drop-shadow(0 0 5px rgba(255,255,255,0.3));
                }

                .polygon-group.selected {
                    filter: brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.5));
                }

                .polygon-group.dragging {
                    opacity: 0.8;
                    filter: brightness(1.4) drop-shadow(0 0 10px rgba(255,255,255,0.6));
                    z-index: 1000;
                }

                .drop-indicator {
                    position: absolute;
                    top: 62px;
                    left: 50px;
                    right: 20px;
                    bottom: 30px;
                    background: rgba(204, 204, 204, 0.1);
                    border: 3px dashed rgb(204, 204, 204);
                    border-radius: 12px;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    color: rgb(204, 204, 204);
                    font-size: 18px;
                    z-index: 150;
                    backdrop-filter: blur(5px);
                }

                .drop-indicator.active {
                    display: flex;
                    animation: pulse 1s infinite;
                    border-color: white;
                    color: white;
                    background: rgba(255, 255, 255, 0.1);
                }

                @keyframes pulse {
                    0%, 100% { opacity: 0.7; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.02); }
                }

                .coordinates-display {
                    position: absolute;
                    bottom: 50px;
                    left: 50px;
                    background: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-family: monospace;
                    z-index: 100;
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .coordinates-display.visible {
                    opacity: 1;
                }

                .axis-lines {
                    position: absolute;
                    pointer-events: none;
                    z-index: 90;
                }

                .axis-x {
                    position: absolute;
                    left: 50px;
                    right: 0;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.6);
                    box-shadow: 0 0 3px rgba(255, 255, 255, 0.3);
                }

                .axis-y {
                    position: absolute;
                    top: 62px;
                    bottom: 30px;
                    width: 1px;
                    background: rgba(255, 255, 255, 0.6);
                    box-shadow: 0 0 3px rgba(255, 255, 255, 0.3);
                }

                .empty-state {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: rgb(204, 204, 204);
                    font-style: italic;
                    z-index: 50;
                    pointer-events: none;
                }

                .empty-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }

                .scale-ruler {
                    position: absolute;
                    background: rgba(40, 40, 40, 0.95);
                    color: white;
                    font-size: 10px;
                    font-family: monospace;
                    z-index: 100;
                    pointer-events: none;
                    border: 1px solid rgba(100, 100, 100, 0.5);
                }

                .scale-ruler.horizontal {
                    left: 50px;
                    right: 0;
                    height: 50px;
                    bottom: 0;
                    border-top: 2px solid rgba(150, 150, 150, 0.8);
                    display: flex;
                    align-items: center;
                    position: absolute;
                    overflow: hidden;
                    z-index: 9999;
                }

                .scale-ruler.vertical {
                    top: 62px;
                    bottom: 0px;
                    width: 50px;
                    height: calc(100% - 62px);
                    left: 0;
                    border-right: 2px solid rgba(150, 150, 150, 0.8);
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    position: relative;
                    overflow: hidden;
                }

                .ruler-mark {
                    position: absolute;
                    color: white;
                    font-size: 18px;
                    font-family: monospace;
                    font-weight: 500;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
                }

                .ruler-mark.horizontal {
                    bottom: 2px;
                    transform: translateX(-50%);
                    white-space: nowrap;
                }

                .ruler-mark.vertical {
                    right: 2px;
                    transform: translateY(50%);
                    white-space: nowrap;
                    writing-mode: horizontal-tb;
                }

                .ruler-tick {
                    position: absolute;
                    background: rgba(200, 200, 200, 0.8);
                }

                .ruler-tick.horizontal {
                    width: 1px;
                    height: 8px;
                    top: 0;
                }

                .ruler-tick.vertical {
                    height: 1px;
                    width: 8px;
                    right: 0;
                }

                .ruler-tick.major {
                    background: rgba(255, 255, 255, 0.9);
                }

                .ruler-tick.horizontal.major {
                    height: 12px;
                    width: 2px;
                }

                .ruler-tick.vertical.major {
                    width: 12px;
                    height: 2px;
                }

                .remove-btn {
                    padding: 8px 16px;
                    border: none;
                    background: #dc3545;
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    outline: none;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .remove-btn:hover {
                    background: #c82333;
                    transform: translateY(-1px);
                }

                .remove-btn:active {
                    transform: translateY(0);
                }
            </style>

            <div class="work-header">
                <div class="work-controls">
                    <div class="zoom-controls">
                        <button class="zoom-btn" id="zoomOut" title="Уменьшить">−</button>
                        <div class="zoom-level" id="zoomLevel">100%</div>
                        <button class="zoom-btn" id="zoomIn" title="Увеличить">+</button>
                        <button class="zoom-btn" id="zoomReset" title="К центру">⌂</button>
                    </div>

                    <button class="remove-btn" id="removeBtn" title="Вернуть выделенный полигон в буферную зону" style="display: none;">
                        ↩️ Вернуть
                    </button>
                </div>
            </div>

            <div class="work-canvas" id="workCanvas">
                <svg class="main-svg" id="mainSvg">
                    <defs>
                        <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgb(80, 80, 80)" stroke-width="0.5"/>
                        </pattern>
                        <pattern id="mediumGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgb(100, 100, 100)" stroke-width="1"/>
                        </pattern>
                        <pattern id="largeGrid" width="100" height="100" patternUnits="userSpaceOnUse">
                            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgb(120, 120, 120)" stroke-width="1.5"/>
                        </pattern>
                    </defs>
                    
                    <rect x="-50000" y="-50000" width="100000" height="100000" fill="url(#smallGrid)" />
                    <rect x="-50000" y="-50000" width="100000" height="100000" fill="url(#mediumGrid)" />
                    <rect x="-50000" y="-50000" width="100000" height="100000" fill="url(#largeGrid)" />
                    
                    <g id="polygonsGroup"></g>
                </svg>

                <div class="empty-state" id="emptyState">
                    <div class="empty-icon">📏</div>
                    <div>Перетащите полигоны на измерительную доску</div>
                    <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">
                        Бесконечная измерительная сетка<br>
                        ЛКМ на доске - панорамирование, ЛКМ на полигоне - перемещение<br>
                        <strong>Выделите полигон и нажмите "Вернуть" для возврата в буферную зону</strong>
                    </div>
                </div>
            </div>

            <div class="drop-indicator" id="dropIndicator">
                📏 Разместить на доске
            </div>

            <div class="axis-lines" id="axisLines" style="display: none;">
                <div class="axis-x" id="axisX"></div>
                <div class="axis-y" id="axisY"></div>
            </div>

            <div class="coordinates-display" id="coordinatesDisplay">
                X: 0, Y: 0
            </div>

            <div class="scale-ruler horizontal" id="horizontalRuler"></div>
            <div class="scale-ruler vertical" id="verticalRuler"></div>
        `;
	}

	attachEventListeners() {
		const canvas = this.shadowRoot.getElementById("workCanvas");
		const svg = this.shadowRoot.getElementById("mainSvg");

		this.shadowRoot
			.getElementById("zoomIn")
			.addEventListener("click", () => this.zoomIn());
		this.shadowRoot
			.getElementById("zoomOut")
			.addEventListener("click", () => this.zoomOut());
		this.shadowRoot
			.getElementById("removeBtn")
			.addEventListener("click", () => this.returnSelectedPolygon());
		this.shadowRoot
			.getElementById("zoomReset")
			.addEventListener("click", () => this.resetView());

		canvas.addEventListener("wheel", this.handleWheel.bind(this), {
			passive: false,
		});
		svg.addEventListener("mousedown", this.handleMouseDown.bind(this));
		svg.addEventListener("mousemove", this.handleMouseMove.bind(this));
		svg.addEventListener("mouseup", this.handleMouseUp.bind(this));
		svg.addEventListener("mouseleave", this.handleMouseLeave.bind(this));
		canvas.addEventListener("mousemove", this.handleCanvasMouseMove.bind(this));
		canvas.addEventListener("mouseleave", this.handleCanvasMouseLeave.bind(this));

		this.addEventListener("dragover", this.handleDragOver.bind(this));
		this.addEventListener("dragenter", this.handleDragEnter.bind(this));
		this.addEventListener("dragleave", this.handleDragLeave.bind(this));
		this.addEventListener("drop", this.handleDrop.bind(this));

		svg.addEventListener("click", this.handleSvgClick.bind(this));
	}

	zoomIn() {
		this.setZoom(this.scale * 1.3);
	}

	zoomOut() {
		this.setZoom(this.scale / 1.3);
	}

	resetView() {
		this.scale = 1;
		this.panOffset = { x: 0, y: 0 };
		this.updateViewBox();
	}

	setZoom(newScale) {
		this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
		this.updateViewBox();
	}

	updateViewBox() {
		const svg = this.shadowRoot.getElementById("mainSvg");
		const canvas = this.shadowRoot.getElementById("workCanvas");
		const rect = canvas.getBoundingClientRect();

		const width = (rect.width || 600) / this.scale;
		const height = (rect.height || 400) / this.scale;

		const centerX = 0 - this.panOffset.x / this.scale;
		const centerY = 0 - this.panOffset.y / this.scale;

		const x = centerX - width / 2;
		const y = centerY - height / 2;

		svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
		this.updateZoomDisplay();
		this.updateRulers();
	}

	updateZoomDisplay() {
		const zoomLevel = this.shadowRoot.getElementById("zoomLevel");
		zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
	}

	handleWheel(e) {
		e.preventDefault();
		const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
		this.setZoom(this.scale * zoomFactor);
	}

	handleMouseDown(e) {
		const polygonGroup = e.target.closest(".polygon-group");

		if (polygonGroup && e.button === 0) {
			this.isDraggingPolygon = true;
			this.draggedPolygon = polygonGroup;

			const polygonId = polygonGroup.getAttribute("data-polygon-id");
			const polygonData = this.polygons.get(polygonId);

			const svgPoint = this.getSvgPoint(e);
			this.dragOffset = {
				x: svgPoint.x - polygonData.workPosition.x,
				y: svgPoint.y - polygonData.workPosition.y,
			};

			polygonGroup.classList.add("dragging");
			this.selectPolygon(polygonId);

			e.stopPropagation();
		} else if (e.button === 0) {
			this.isPanning = true;
			this.panStart = {
				x: e.clientX - this.panOffset.x,
				y: e.clientY - this.panOffset.y,
			};
			this.shadowRoot.getElementById("workCanvas").classList.add("panning");
		}
	}

	handleMouseMove(e) {
		if (this.isDraggingPolygon && this.draggedPolygon) {
			const svgPoint = this.getSvgPoint(e);
			const newX = svgPoint.x - this.dragOffset.x;
			const newY = svgPoint.y - this.dragOffset.y;

			const polygonId = this.draggedPolygon.getAttribute("data-polygon-id");
			const polygonData = this.polygons.get(polygonId);
			polygonData.workPosition = { x: newX, y: newY };

			this.draggedPolygon.setAttribute(
				"transform",
				`translate(${newX}, ${newY}) scale(${polygonData.workScale || 1})`
			);

			e.preventDefault();
		} else if (this.isPanning) {
			this.panOffset.x = e.clientX - this.panStart.x;
			this.panOffset.y = e.clientY - this.panStart.y;
			this.updateViewBox();
		}
	}

	handleMouseUp(e) {
		if (this.isDraggingPolygon && this.draggedPolygon) {
			this.draggedPolygon.classList.remove("dragging");
			this.isDraggingPolygon = false;
			this.draggedPolygon = null;
			this.dragOffset = { x: 0, y: 0 };
		}

		if (this.isPanning) {
			this.isPanning = false;
			this.shadowRoot.getElementById("workCanvas").classList.remove("panning");
		}
	}

	handleMouseLeave(e) {
		this.handleMouseUp(e);
	}

	getSvgPoint(e) {
		const svg = this.shadowRoot.getElementById("mainSvg");
		const rect = svg.getBoundingClientRect();
		const viewBox = svg.viewBox.baseVal;

		const x = ((e.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
		const y = ((e.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;

		return { x, y };
	}

	handleCanvasMouseMove(e) {
		if (!this.isDraggingPolygon && !this.isPanning) {
			const point = this.getSvgPoint(e);
			const coordsDisplay = this.shadowRoot.getElementById("coordinatesDisplay");
			const axisLines = this.shadowRoot.getElementById("axisLines");
			const axisX = this.shadowRoot.getElementById("axisX");
			const axisY = this.shadowRoot.getElementById("axisY");

			coordsDisplay.textContent = `X: ${Math.round(point.x)}, Y: ${Math.round(
				-point.y
			)}`;
			coordsDisplay.classList.add("visible");

			const rect = this.shadowRoot
				.getElementById("workCanvas")
				.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			axisX.style.top = `${mouseY + 62}px`;
			axisY.style.left = `${mouseX + 50}px`;
			axisLines.style.display = "block";
		}
	}

	handleCanvasMouseLeave() {
		const coordsDisplay = this.shadowRoot.getElementById("coordinatesDisplay");
		const axisLines = this.shadowRoot.getElementById("axisLines");

		coordsDisplay.classList.remove("visible");
		axisLines.style.display = "none";
	}

	updateRulers() {
		const svg = this.shadowRoot.getElementById("mainSvg");
		const viewBox = svg.viewBox.baseVal;
		const canvas = this.shadowRoot.getElementById("workCanvas");
		const rect = canvas.getBoundingClientRect();

		this.updateHorizontalRuler(viewBox, rect);
		this.updateVerticalRuler(viewBox, rect);
	}

	updateHorizontalRuler(viewBox, canvasRect) {
		const ruler = this.shadowRoot.getElementById("horizontalRuler");
		ruler.innerHTML = "";

		const step = this.scale > 2 ? 10 : this.scale > 0.5 ? 50 : 100;
		const startX = Math.floor(viewBox.x / step) * step;
		const endX = viewBox.x + viewBox.width;

		for (let x = startX; x <= endX; x += step) {
			const pixelX = ((x - viewBox.x) / viewBox.width) * canvasRect.width;

			if (pixelX >= 0 && pixelX <= canvasRect.width) {
				const isMajor = x % (step * 5) === 0;

				const tick = document.createElement("div");
				tick.className = `ruler-tick horizontal ${isMajor ? "major" : ""}`;
				tick.style.left = `${pixelX}px`;
				ruler.appendChild(tick);

				if (isMajor) {
					const mark = document.createElement("div");
					mark.className = "ruler-mark horizontal";
					mark.style.left = `${pixelX}px`;
					mark.textContent = x.toString();
					ruler.appendChild(mark);
				}
			}
		}
	}

	updateVerticalRuler(viewBox, canvasRect) {
		const ruler = this.shadowRoot.getElementById("verticalRuler");
		ruler.innerHTML = "";

		const step = this.scale > 2 ? 10 : this.scale > 0.5 ? 50 : 100;
		const startY = Math.floor(viewBox.y / step) * step;
		const endY = viewBox.y + viewBox.height;

		for (let y = startY; y <= endY; y += step) {
			const pixelY = ((y - viewBox.y) / viewBox.height) * canvasRect.height;

			if (pixelY >= 0 && pixelY <= canvasRect.height) {
				const isMajor = y % (step * 5) === 0;

				const tick = document.createElement("div");
				tick.className = `ruler-tick vertical ${isMajor ? "major" : ""}`;
				tick.style.bottom = `${canvasRect.height - pixelY}px`;
				ruler.appendChild(tick);

				if (isMajor) {
					const mark = document.createElement("div");
					mark.className = "ruler-mark vertical";
					mark.style.bottom = `${canvasRect.height - pixelY}px`;
					mark.textContent = (-y).toString();
					ruler.appendChild(mark);
				}
			}
		}
	}

	handleDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}

	handleDragEnter(e) {
		e.preventDefault();
		if (e.dataTransfer.types.includes("application/polygon")) {
			this.shadowRoot.getElementById("dropIndicator").classList.add("active");
		}
	}

	handleDragLeave(e) {
		if (!this.contains(e.relatedTarget)) {
			this.shadowRoot.getElementById("dropIndicator").classList.remove("active");
		}
	}

	handleDrop(e) {
		e.preventDefault();
		this.shadowRoot.getElementById("dropIndicator").classList.remove("active");

		try {
			const polygonData = JSON.parse(
				e.dataTransfer.getData("application/polygon")
			);
			const sourceZone = e.dataTransfer.getData("text/source-zone");

			if (sourceZone !== "work") {
				const dropPoint = this.getSvgPoint(e);

				let existingElement = this.shadowRoot.querySelector(
					`[data-polygon-id="${polygonData.id}"]`
				);

				if (existingElement) {
					existingElement.style.display = "block";

					const workPolygon = this.polygons.get(polygonData.id);
					if (workPolygon) {
						workPolygon.workPosition = { x: dropPoint.x, y: dropPoint.y };
						existingElement.setAttribute(
							"transform",
							`translate(${dropPoint.x}, ${dropPoint.y}) scale(${
								workPolygon.workScale || 1
							})`
						);
					}
				} else {
					this.addPolygonAtPosition(polygonData, dropPoint.x, dropPoint.y);
				}

				this.dispatchEvent(
					new CustomEvent("polygon-moved", {
						bubbles: true,
						detail: { polygon: polygonData, from: sourceZone, to: "work" },
					})
				);
			}
		} catch (error) {
			console.error("Ошибка при обработке drop:", error);
		}
	}

	addPolygonAtPosition(polygonData, x, y) {
		if (this.polygons.has(polygonData.id)) return;

		const workPolygon = {
			...polygonData,
			workPosition: { x, y },
			workScale: 1,
		};

		this.polygons.set(polygonData.id, workPolygon);
		this.renderPolygon(workPolygon);
		this.updateUI();
	}

	renderPolygon(polygonData) {
		const polygonsGroup = this.shadowRoot.getElementById("polygonsGroup");

		const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
		group.classList.add("polygon-group");
		group.setAttribute("data-polygon-id", polygonData.id);

		const { x, y } = polygonData.workPosition;
		const scale = polygonData.workScale || 1;
		group.setAttribute("transform", `translate(${x}, ${y}) scale(${scale})`);

		const polygon = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"polygon"
		);

		let points;
		if (polygonData.points) {
			points = polygonData.points;
		} else if (polygonData.vertices) {
			points = polygonData.vertices
				.map(vertex => `${vertex.x - 50},${vertex.y - 50}`)
				.join(" ");
		} else {
			return;
		}

		polygon.setAttribute("points", points);
		polygon.setAttribute(
			"fill",
			polygonData.color || polygonData.fill || "#ff6b6b"
		);
		polygon.setAttribute("stroke", "rgba(255, 255, 255, 0.3)");
		polygon.setAttribute("stroke-width", "1");

		if (polygonData.name) {
			const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
			text.setAttribute("x", "0");
			text.setAttribute("y", "-5");
			text.setAttribute("fill", "white");
			text.setAttribute("font-size", "12");
			text.setAttribute("font-weight", "bold");
			text.setAttribute("text-anchor", "middle");
			text.setAttribute("text-shadow", "1px 1px 2px rgba(0,0,0,0.7)");
			text.textContent = polygonData.name;
			group.appendChild(text);
		}

		group.appendChild(polygon);
		polygonsGroup.appendChild(group);

		group.addEventListener("click", e => {
			this.selectPolygon(polygonData.id);
			e.stopPropagation();
		});

		group.style.opacity = "0";
		requestAnimationFrame(() => {
			group.style.transition = "opacity 0.3s ease";
			group.style.opacity = "1";
		});
	}

	handleSvgClick(e) {
		let polygonGroup = e.target.closest(".polygon-group");

		if (
			!polygonGroup &&
			e.target.hasAttribute &&
			e.target.hasAttribute("data-polygon-id")
		) {
			polygonGroup = e.target;
		}

		if (!polygonGroup) {
			let current = e.target;
			while (current && current !== this.shadowRoot) {
				if (current.hasAttribute && current.hasAttribute("data-polygon-id")) {
					polygonGroup = current;
					break;
				}
				current = current.parentElement;
			}
		}

		if (polygonGroup) {
			const polygonId = polygonGroup.getAttribute("data-polygon-id");
			this.selectPolygon(polygonId);
			e.stopPropagation();
		} else {
			this.selectPolygon(null);
		}
	}

	selectPolygon(polygonId) {
		if (this.selectedPolygon) {
			const prevSelected = this.shadowRoot.querySelector(
				`[data-polygon-id="${this.selectedPolygon}"]`
			);
			if (prevSelected) {
				prevSelected.classList.remove("selected");
			}
		}

		this.selectedPolygon = polygonId;

		if (polygonId) {
			const selected = this.shadowRoot.querySelector(
				`[data-polygon-id="${polygonId}"]`
			);
			if (selected) {
				selected.classList.add("selected");
			}
		}

		const removeBtn = this.shadowRoot.getElementById("removeBtn");
		removeBtn.style.display = polygonId ? "flex" : "none";
	}

	returnSelectedPolygon() {
		if (!this.selectedPolygon) return;

		const polygonId = this.selectedPolygon;
		const polygonData = this.polygons.get(polygonId);

		if (!polygonData) return;

		const polygonElement = this.shadowRoot.querySelector(
			`[data-polygon-id="${polygonId}"]`
		);
		if (polygonElement) {
			polygonElement.remove();
		}

		this.polygons.delete(polygonId);
		this.selectedPolygon = null;
		const removeBtn = this.shadowRoot.getElementById("removeBtn");
		removeBtn.style.display = "none";

		this.updateUI();

		let appContainer = this.parentElement;
		while (appContainer && appContainer.tagName !== "POLYGON-APP") {
			appContainer = appContainer.parentElement || appContainer.host;
		}

		if (appContainer) {
			appContainer.handlePolygonReturn(polygonData);
		} else {
			this.dispatchEvent(
				new CustomEvent("polygon-moved", {
					bubbles: true,
					composed: true,
					detail: { polygon: polygonData, from: "work", to: "buffer" },
				})
			);
		}
	}

	updateUI() {
		const count = this.polygons.size;
		const emptyState = this.shadowRoot.getElementById("emptyState");
		emptyState.style.display = count === 0 ? "block" : "none";
	}

	getPolygonCount() {
		return this.polygons.size;
	}

	getPolygons() {
		return Array.from(this.polygons.values());
	}

	getPolygonData(polygonId) {
		return this.polygons.get(polygonId);
	}

	clearPolygons() {
		this.polygons.clear();
		const polygonsGroup = this.shadowRoot.getElementById("polygonsGroup");
		polygonsGroup.innerHTML = "";
		this.selectedPolygon = null;
		this.updateUI();
	}

	connectedCallback() {
		const resizeObserver = new ResizeObserver(() => {
			this.updateViewBox();
		});
		resizeObserver.observe(this);

		setTimeout(() => {
			this.updateViewBox();
		}, 100);
	}
}

customElements.define("work-zone", WorkZone);
export default WorkZone;
