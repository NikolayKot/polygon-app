class BufferZone extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this.polygons = new Map();
		this.init();
	}

	init() {
		this.render();
		this.attachEventListeners();
	}

	render() {
		this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background-color: rgb(51, 51, 51);
                    position: relative;
                    overflow-y: auto;
                    overflow-x: hidden;
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                }

                .buffer-content {
                    padding: 20px;
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                }

                .polygons-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 15px;
                    width: 100%;
                }

                .polygon-card {
                    width: 120px;
                    height: 120px;
                    background-color: transparent;
                    border-radius: 8px;
                    cursor: grab;
                    transition: all 0.2s ease;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                }

                .polygon-card:hover {
                    border-color: white;
                    transform: scale(1.05);
                }

                .polygon-card.dragging {
                    opacity: 0.5;
                    cursor: grabbing;
                }

                .polygon-svg {
                    width: 100px;
                    height: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: none;
                    overflow: visible;
                }

                .polygon-svg svg {
                    width: 80px;
                    height: 80px;
                    display: block;
                }

                .polygon-svg polygon {
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                }

                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: rgb(204, 204, 204);
                    font-size: 16px;
                }

                .drop-zone {
                    border: 3px dashed rgb(204, 204, 204);
                    border-radius: 12px;
                    padding: 30px 20px;
                    text-align: center;
                    background: rgba(204, 204, 204, 0.1);
                    color: rgb(204, 204, 204);
                    font-weight: 600;
                    margin-bottom: 20px;
                    display: none;
                    font-size: 14px;
                }

                .drop-zone.active {
                    display: block;
                    border-color: white;
                    color: white;
                    background: rgba(255, 255, 255, 0.1);
                }

                :host::-webkit-scrollbar {
                    width: 8px;
                }

                :host::-webkit-scrollbar-track {
                    background: rgb(51, 51, 51);
                }

                :host::-webkit-scrollbar-thumb {
                    background: rgb(204, 204, 204);
                    border-radius: 4px;
                }

                :host::-webkit-scrollbar-thumb:hover {
                    background: white;
                }
            </style>

            <div class="buffer-content">
                <div class="drop-zone" id="dropZone">
                    ↩️ Отпустите, чтобы вернуть полигон в буферную зону
                </div>

                <div class="polygons-grid" id="polygonsGrid">
                </div>

                <div class="empty-state" id="emptyState">
                    Буферная зона пуста<br>
                    Нажмите "Создать" чтобы сгенерировать полигоны
                </div>
            </div>
        `;
	}

	attachEventListeners() {
		this.addEventListener("dragover", this.handleDragOver.bind(this));
		this.addEventListener("dragenter", this.handleDragEnter.bind(this));
		this.addEventListener("dragleave", this.handleDragLeave.bind(this));
		this.addEventListener("drop", this.handleDrop.bind(this));
	}

	handleDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}

	handleDragEnter(e) {
		e.preventDefault();
		const sourceZone = e.dataTransfer.getData("text/source-zone");

		if (
			sourceZone === "work" &&
			e.dataTransfer.types.includes("application/polygon")
		) {
			this.shadowRoot.getElementById("dropZone").classList.add("active");
		}
	}

	handleDragLeave(e) {
		if (!this.contains(e.relatedTarget)) {
			this.shadowRoot.getElementById("dropZone").classList.remove("active");
		}
	}

	handleDrop(e) {
		e.preventDefault();
		this.shadowRoot.getElementById("dropZone").classList.remove("active");

		try {
			const polygonData = JSON.parse(
				e.dataTransfer.getData("application/polygon")
			);
			const sourceZone = e.dataTransfer.getData("text/source-zone");

			if (sourceZone === "work") {
				const success = this.showPolygon(polygonData.id);

				if (!success) {
					this.addPolygon(polygonData);
				}

				this.dispatchEvent(
					new CustomEvent("polygon-moved", {
						bubbles: true,
						detail: { polygon: polygonData, from: "work", to: "buffer" },
					})
				);
			}
		} catch (error) {
			console.error("Ошибка при возврате полигона:", error);
		}
	}

	showPolygon(polygonId) {
		const card = this.shadowRoot.querySelector(
			`[data-polygon-id="${polygonId}"]`
		);

		if (card) {
			card.style.display = "flex";
			card.style.opacity = "1";
			card.classList.remove("dragging");
			this.updateUI();
			return true;
		} else {
			const hasData = this.polygons.has(polygonId);

			if (hasData) {
				const polygonData = this.polygons.get(polygonId);
				this.renderPolygon(polygonData);
				this.updateUI();
				return true;
			}

			return false;
		}
	}

	addPolygon(polygonData) {
		if (this.polygons.has(polygonData.id)) return;

		this.polygons.set(polygonData.id, polygonData);
		this.renderPolygon(polygonData);
		this.updateUI();
	}

	renderPolygon(polygonData) {
		const grid = this.shadowRoot.getElementById("polygonsGrid");

		const card = document.createElement("div");
		card.className = "polygon-card";
		card.setAttribute("draggable", "true");
		card.setAttribute("data-polygon-id", polygonData.id);

		const svgContainer = this.createPolygonSVG(polygonData);
		card.appendChild(svgContainer);

		card.addEventListener("dragstart", this.handleDragStart.bind(this));
		card.addEventListener("dragend", this.handleDragEnd.bind(this));

		grid.appendChild(card);
	}

	createPolygonSVG(polygonData) {
		const svgContainer = document.createElement("div");
		svgContainer.className = "polygon-svg";

		const points = polygonData.vertices
			.map(vertex => `${vertex.x},${vertex.y}`)
			.join(" ");

		svgContainer.innerHTML = `
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <polygon 
                    points="${points}"
                    fill="${polygonData.fill}"
                    stroke="none"
                    stroke-width="0"
                />
            </svg>
        `;

		return svgContainer;
	}

	handleDragStart(e) {
		const card = e.target.closest(".polygon-card");
		if (!card) return;

		const polygonId = card.getAttribute("data-polygon-id");
		const polygonData = this.polygons.get(polygonId);

		if (polygonData) {
			e.dataTransfer.setData("application/polygon", JSON.stringify(polygonData));
			e.dataTransfer.setData("text/source-zone", "buffer");
			e.dataTransfer.effectAllowed = "move";

			card.classList.add("dragging");

			setTimeout(() => {
				card.style.display = "none";
			}, 50);
		}
	}

	handleDragEnd(e) {
		const card = e.target.closest(".polygon-card");
		if (card) {
			card.classList.remove("dragging");
		}
	}

	updateUI() {
		const emptyState = this.shadowRoot.getElementById("emptyState");
		const hasPolygons = this.polygons.size > 0;
		emptyState.style.display = hasPolygons ? "none" : "block";
	}

	getPolygonCount() {
		const visibleCards = this.shadowRoot.querySelectorAll(
			'.polygon-card:not([style*="display: none"])'
		);
		return visibleCards.length;
	}

	getPolygons() {
		return Array.from(this.polygons.values());
	}

	getPolygonData(polygonId) {
		return this.polygons.get(polygonId);
	}

	clearPolygons() {
		this.polygons.clear();
		const grid = this.shadowRoot.getElementById("polygonsGrid");
		grid.innerHTML = "";
		this.updateUI();
	}

	addPolygons(polygonsArray) {
		polygonsArray.forEach(polygonData => {
			this.addPolygon(polygonData);
		});
	}
}

customElements.define("buffer-zone", BufferZone);
export default BufferZone;
