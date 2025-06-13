class AppContainer extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this.init();
	}

	init() {
		this.render();
		this.attachEventListeners();
		this.loadFromStorage();
	}

	render() {
		this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    height: 100vh;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                .control-panel {
                    background: #2a2a2a;
                    padding: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .control-left {
                    display: flex;
                    gap: 10px;
                }

                .control-right {
                    display: flex;
                    gap: 10px;
                }

                .separator {
                    height: 10px;
                    background: rgba(255, 255, 255, 0.95);
                    width: 100%;
                }

                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    outline: none;
                    background-color: #808080;
                    color: #000000;
                }

                .btn:hover {
                    background-color: #696969;
                    transform: translateY(-1px);
                }

                .app-content {
                    flex: 1;
                    display: flex;
                    height: 93%;
                    flex-direction: column;
                    overflow: hidden;
                }

                buffer-zone {
                    height: 35%;
                    min-height: 200px;
                }

                work-zone {
                    flex: 1;
                    min-height: 300px;
                }
            </style>

            <div class="control-panel">
                <div class="control-left">
                    <button class="btn" id="createBtn">Создать</button>
                </div>
                <div class="control-right">
                    <button class="btn" id="saveBtn">Сохранить</button>
                    <button class="btn" id="resetBtn">Сбросить</button>
                </div>
            </div>

            <div class="separator"></div>

            <div class="app-content">
                <buffer-zone id="bufferZone"></buffer-zone>
                <work-zone id="workZone"></work-zone>
            </div>
        `;
	}

	handlePolygonReturn(polygonData) {
		const bufferZone = this.shadowRoot.getElementById("bufferZone");
		const success = bufferZone.showPolygon(polygonData.id);

		if (!success) {
			bufferZone.addPolygon(polygonData);
		}
	}

	attachEventListeners() {
		this.shadowRoot.getElementById("createBtn").addEventListener("click", () => {
			this.createPolygons();
		});

		this.shadowRoot.getElementById("saveBtn").addEventListener("click", () => {
			this.saveToStorage();
		});

		this.shadowRoot.getElementById("resetBtn").addEventListener("click", () => {
			this.resetData();
		});

		this.addEventListener(
			"polygon-moved",
			e => {
				this.handlePolygonMoved(e);
			},
			{ capture: true }
		);
	}

	createPolygons() {
		const bufferZone = this.shadowRoot.getElementById("bufferZone");
		const count = Math.floor(Math.random() * 16) + 5;

		for (let i = 0; i < count; i++) {
			const polygon = this.generateRandomPolygon();
			bufferZone.addPolygon(polygon);
		}

		this.showNotification(`Создано ${count} полигонов!`);
	}

	generateRandomPolygon() {
		const vertexCount = Math.floor(Math.random() * 6) + 3;
		const vertices = [];
		const centerX = 50;
		const centerY = 50;
		const radius = Math.random() * 30 + 15;

		for (let i = 0; i < vertexCount; i++) {
			const angle = (i / vertexCount) * 2 * Math.PI;
			const radiusVariation = radius + (Math.random() - 0.5) * 20;
			const x = centerX + Math.cos(angle) * radiusVariation;
			const y = centerY + Math.sin(angle) * radiusVariation;
			vertices.push({
				x: Math.max(5, Math.min(95, x)),
				y: Math.max(5, Math.min(95, y)),
			});
		}

		return {
			id: `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			vertices: vertices,
			fill: "#8B0000",
			stroke: "none",
			strokeWidth: 0,
		};
	}

	handlePolygonMoved(e) {
		const { polygon, from, to } = e.detail;
		const bufferZone = this.shadowRoot.getElementById("bufferZone");
		const workZone = this.shadowRoot.getElementById("workZone");

		if (to === "work" && from === "buffer") {
			workZone.addPolygon(polygon);
		} else if (to === "buffer" && from === "work") {
			const success = bufferZone.showPolygon(polygon.id);
			if (!success) {
				bufferZone.addPolygon(polygon);
			}
		}
	}

	saveToStorage() {
		try {
			const bufferZone = this.shadowRoot.getElementById("bufferZone");
			const workZone = this.shadowRoot.getElementById("workZone");

			const data = {
				bufferPolygons: bufferZone.getPolygons(),
				workPolygons: workZone.getPolygons(),
				timestamp: new Date().toISOString(),
			};

			localStorage.setItem("polygon-app-data", JSON.stringify(data));
			this.showNotification("Данные сохранены!", "success");
		} catch (error) {
			this.showNotification("Ошибка сохранения!", "error");
		}
	}

	loadFromStorage() {
		try {
			const savedData = localStorage.getItem("polygon-app-data");
			if (savedData) {
				const data = JSON.parse(savedData);

				setTimeout(() => {
					const bufferZone = this.shadowRoot.getElementById("bufferZone");
					const workZone = this.shadowRoot.getElementById("workZone");

					if (data.bufferPolygons && bufferZone) {
						data.bufferPolygons.forEach(polygon => bufferZone.addPolygon(polygon));
					}

					if (data.workPolygons && workZone) {
						data.workPolygons.forEach(polygon => workZone.addPolygon(polygon));
					}
				}, 500);
			}
		} catch (error) {
			console.error("Ошибка загрузки:", error);
		}
	}

	resetData() {
		if (confirm("Вы уверены, что хотите удалить все данные?")) {
			localStorage.removeItem("polygon-app-data");

			const bufferZone = this.shadowRoot.getElementById("bufferZone");
			const workZone = this.shadowRoot.getElementById("workZone");

			bufferZone.clearPolygons();
			workZone.clearPolygons();

			this.showNotification("Данные сброшены!", "info");
		}
	}

	showNotification(message, type = "info") {
		const notification = document.createElement("div");
		notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background-color: ${
													type === "success"
														? "#28a745"
														: type === "error"
														? "#dc3545"
														: "#17a2b8"
												};
        `;
		notification.textContent = message;

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.style.animation = "slideOut 0.3s ease";
			setTimeout(() => notification.remove(), 300);
		}, 2000);
	}

	connectedCallback() {
		if (!document.getElementById("notification-styles")) {
			const style = document.createElement("style");
			style.id = "notification-styles";
			style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
			document.head.appendChild(style);
		}
	}
}

customElements.define("polygon-app", AppContainer);
export default AppContainer;
