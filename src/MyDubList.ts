/// <reference path="./plugin.d.ts" />
/// <reference path="./app.d.ts" />
/// <reference path="./core.d.ts" />

function init() {
    $ui.register(async (ctx) => {
        // --- CONSTANTS ---
        const LANGUAGES = [
            { label: "Arabic", value: "arabic" },
            { label: "Catalan", value: "catalan" },
            { label: "Chinese", value: "chinese" },
            { label: "Danish", value: "danish" },
            { label: "Dutch", value: "dutch" },
            { label: "English", value: "english" },
            { label: "Finnish", value: "finnish" },
            { label: "French", value: "french" },
            { label: "German", value: "german" },
            { label: "Hebrew", value: "hebrew" },
            { label: "Hindi", value: "hindi" },
            { label: "Hungarian", value: "hungarian" },
            { label: "Indonesian", value: "indonesian" },
            { label: "Italian", value: "italian" },
            { label: "Japanese", value: "japanese" },
            { label: "Korean", value: "korean" },
            { label: "Lithuanian", value: "lithuanian" },
            { label: "Norwegian", value: "norwegian" },
            { label: "Polish", value: "polish" },
            { label: "Portuguese", value: "portuguese" },
            { label: "Russian", value: "russian" },
            { label: "Spanish", value: "spanish" },
            { label: "Swedish", value: "swedish" },
            { label: "Tagalog", value: "tagalog" },
            { label: "Thai", value: "thai" },
            { label: "Turkish", value: "turkish" },
            { label: "Vietnamese", value: "vietnamese" },
        ];

        const CONFIDENCE_LEVELS = [
            { label: "Low", value: "low" },
            { label: "Normal", value: "normal" },
            { label: "High", value: "high" },
            { label: "Very High", value: "very-high" },
        ];

        const POSITION_OPTIONS = [
            { label: "Beside (Left)", value: "beside" },
            { label: "Below", value: "below" },
        ];

        const COLOR_OPTIONS = [
            { label: "Default (Indigo)", value: "default" },
            { label: "Green", value: "green" },
            { label: "Red", value: "red" },
            { label: "Blue", value: "blue" },
            { label: "Orange", value: "orange" },
        ];

        const DEBUG_OPTIONS = [
            { label: "Off", value: "false" },
            { label: "On", value: "true" },
        ];

        // --- STORAGE HELPERS ---
        const getStorageItem = (key, def) => {
            try { return $storage.get(key) || def; } catch (e) { return def; }
        };
        const setStorageItem = (key, val) => {
            try { $storage.set(key, val); } catch (e) {}
        };

        // Load Settings
        const savedLang = getStorageItem("dub-badge-lang", "english");
        const defaultConf = savedLang === "english" ? "normal" : "low";
        const savedConf = getStorageItem("dub-badge-conf", defaultConf);
        const savedPos = getStorageItem("dub-badge-pos", "beside");
        const savedColor = getStorageItem("dub-badge-color", "default");
        const savedDebug = getStorageItem("dub-badge-debug", "false");

        // --- STATES & REFS ---
        const langRef = ctx.fieldRef(savedLang);
        const confRef = ctx.fieldRef(savedConf);
        const posRef = ctx.fieldRef(savedPos);
        const colRef = ctx.fieldRef(savedColor);
        const debugRef = ctx.fieldRef(savedDebug);
        const statusState = ctx.state("Ready");

        // Track currently loaded data to avoid re-fetching on color changes
        let currentLoadedLang = "";
        let currentLoadedConf = "";

        // --- TRAY ---
        const tray = ctx.newTray({
            tooltipText: "Dub Badge Settings",
            iconUrl: "https://raw.githubusercontent.com/Bas1874/MyDubList-Seanime/refs/heads/main/src/icons/logo.png",
            withContent: true
        });

        tray.render(() => {
            return tray.stack([
                tray.text("Dub Badge Settings", { style: { fontWeight: "bold", fontSize: "1rem" } }),
                tray.select("Language", { options: LANGUAGES, fieldRef: langRef }),
                tray.select("Confidence", { options: CONFIDENCE_LEVELS, fieldRef: confRef }),
                tray.select("Badge Position", { options: POSITION_OPTIONS, fieldRef: posRef }),
                tray.select("Badge Color", { options: COLOR_OPTIONS, fieldRef: colRef }),
                tray.select("Debug Mode (Show ID)", { options: DEBUG_OPTIONS, fieldRef: debugRef }),
                tray.text(`Status: ${statusState.get()}`, { style: { fontSize: "0.8rem", color: "#888", marginBottom: "5px" } }),
                tray.button("Save & Reload", { onClick: "reload-data", intent: "primary", style: { width: "100%" } })
            ], { gap: 4, style: { width: "250px", padding: "10px" } });
        });

        // --- SMART RELOAD HANDLER ---
        ctx.registerEventHandler("reload-data", async () => {
            const newLang = langRef.current;
            const newConf = confRef.current;

            setStorageItem("dub-badge-lang", newLang);
            setStorageItem("dub-badge-conf", newConf);
            setStorageItem("dub-badge-pos", posRef.current);
            setStorageItem("dub-badge-color", colRef.current);
            setStorageItem("dub-badge-debug", debugRef.current);

            // Remove existing badges first (UI Reset)
            await resetDomBadges();

            // Only fetch data if Language or Confidence changed, or if data isn't ready
            if (newLang !== currentLoadedLang || newConf !== currentLoadedConf || !isDataReady) {
                await loadDubData();
            } else {
                // If only color/position changed, just trigger a re-scan with existing data
                triggerScan();
            }
        });

        // --- SELECTORS & STATE ---
        const selectorBase = "[data-media-entry-card-body='true'], [data-media-entry-card-hover-popup-banner-container='true']";
        const dubbedAnilistIds = new Set<string>();
        let isDataReady = false;
        let isScanning = false; // Scan Lock

        // --- HELPERS ---
        const triggerScan = async () => {
            if (!isDataReady || isScanning) return;
            isScanning = true;
            
            const selectorRetry = `${selectorBase}:not([data-dub-badge-checked='true'])`;
            try {
                const retryElements = await ctx.dom.query(selectorRetry, { identifyChildren: true, withInnerHTML: true });
                if (retryElements && retryElements.length > 0) {
                    await processElements(retryElements);
                }
            } catch (e) { }
            finally {
                isScanning = false;
            }
        };

        const loadDubData = async () => {
            try {
                isDataReady = false;
                dubbedAnilistIds.clear();
                statusState.set("Loading...");

                const lang = langRef.current;
                const conf = confRef.current;
                const url = `https://raw.githubusercontent.com/Joelis57/MyDubList/refs/heads/main/dubs/confidence/${conf}/dubbed_${lang}.json`;
                const dubsRes = await ctx.fetch(url);

                if (dubsRes.status !== 200) throw new Error(`Fetch failed: ${dubsRes.status}`);

                const dubsData = await dubsRes.json();
                const dubbedMalIds = new Set(dubsData.dubbed);

                const mapRes = await ctx.fetch("https://raw.githubusercontent.com/Joelis57/MyDubList/refs/heads/main/dubs/mappings/mappings_anilist.jsonl");
                const mapText = await mapRes.text();

                const lines = mapText.split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const mapping = JSON.parse(line);
                        if (dubbedMalIds.has(mapping.mal_id)) {
                            dubbedAnilistIds.add(String(mapping.anilist_id));
                        }
                    } catch (e) { }
                }

                currentLoadedLang = lang;
                currentLoadedConf = conf;
                isDataReady = true;
                statusState.set(`Active: ${lang} (${dubbedAnilistIds.size})`);
                
                triggerScan();
            } catch (e) {
                console.error("[Dub Badge] Error:", e);
                statusState.set("Error");
                isDataReady = false;
            }
        };

        const resetDomBadges = async () => {
            const processedElements = await ctx.dom.query("[data-dub-badge-checked='true']", { identifyChildren: true });
            for (const el of processedElements) {
                await el.removeAttribute("data-dub-badge-checked");
                await el.removeAttribute("data-dub-badge-added");
                await el.removeAttribute("data-badge-retries");
            }
            const oldBadges = await ctx.dom.query(".seanime-dub-badge-wrapper");
            for (const badge of oldBadges) {
                await badge.remove();
            }
        };

        // Initial Load
        loadDubData();

        // --- CORE PROCESSOR ---
        const processSingleCard = async (el: any) => {
            try {
                if (await el.getAttribute("data-dub-badge-checked") === "true") return;
                if (!isDataReady) return;

                let mediaId = "N/A";
                let hasExistingBadge = false; 
                let isPopup = false;
                
                if (await el.getAttribute("data-media-entry-card-hover-popup-banner-container") === "true") {
                    isPopup = true;
                }

                // --- 1. Attribute Check (Fastest) ---
                const directDataId = await el.getAttribute("data-media-id");
                if (directDataId) {
                    mediaId = directDataId;
                } else {
                    const directHref = await el.getAttribute("href");
                    if (directHref) {
                        const match = directHref.match(/[?&]id=(\d+)/);
                        if (match && match[1]) mediaId = match[1];
                    }
                }

                // --- 2. Parent Check (Medium) ---
                if (mediaId === "N/A" && !isPopup) {
                    let tempEl = el;
                    for (let i = 0; i < 4; i++) {
                        try {
                            const parent = await tempEl.getParent();
                            if (!parent) break;
                            const pDataId = await parent.getAttribute("data-media-id");
                            if (pDataId) { mediaId = pDataId; break; }
                            const pHref = await parent.getAttribute("href");
                            if (pHref) {
                                const match = pHref.match(/[?&]id=(\d+)/);
                                if (match && match[1]) { mediaId = match[1]; break; }
                            }
                            tempEl = parent;
                        } catch(e) { break; }
                    }
                }

                // --- 3. HTML Analysis (Slowest - Fallback) ---
                if (mediaId === "N/A" && el.innerHTML) {
                    // Check for existing badges for layout purposes
                    if (el.innerHTML.includes("data-media-entry-card-body-releasing-badge-container") ||
                        el.innerHTML.includes("data-media-entry-card-body-next-airing-badge-container") ||
                        el.innerHTML.includes("data-media-entry-card-hover-popup-banner-releasing-badge-container")) {
                        hasExistingBadge = true;
                    }

                    const $ = LoadDoc(el.innerHTML);
                    const imgSrc = $("img").attr("src");
                    if (imgSrc) {
                        const match = imgSrc.match(/\/bx(\d+)/) ||
                            imgSrc.match(/\/banner\/(\d+)/) ||
                            imgSrc.match(/\/cover\/.*\/(\d+)/) ||
                            imgSrc.match(/\/media\/(\d+)/);
                        if (match && match[1]) mediaId = match[1];
                    }

                    if (mediaId === "N/A") {
                        const childLink = $("a[href*='id=']").attr("href");
                        if (childLink) {
                            const match = childLink.match(/[?&]id=(\d+)/);
                            if (match && match[1]) mediaId = match[1];
                        }
                    }
                } else if (mediaId !== "N/A" && el.innerHTML) {
                    // We found ID fast, but still need to check layout
                    if (el.innerHTML.includes("data-media-entry-card-body-releasing-badge-container") ||
                        el.innerHTML.includes("data-media-entry-card-body-next-airing-badge-container") ||
                        el.innerHTML.includes("data-media-entry-card-hover-popup-banner-releasing-badge-container")) {
                        hasExistingBadge = true;
                    }
                }

                if (mediaId !== "N/A") {
                    if (dubbedAnilistIds.has(mediaId)) {
                        // Mark checked immediately
                        await el.setAttribute("data-dub-badge-checked", "true");

                        // Colors
                        const colorSetting = colRef.current || "default";
                        let colorClass = "bg-indigo-500 hover:bg-indigo-600";
                        if (colorSetting === "red") colorClass = "bg-red-600 hover:bg-red-700";
                        else if (colorSetting === "green") colorClass = "bg-green-600 hover:bg-green-700";
                        else if (colorSetting === "blue") colorClass = "bg-blue-600 hover:bg-blue-700";
                        else if (colorSetting === "orange") colorClass = "bg-orange-600 hover:bg-orange-700";

                        // Positioning
                        const positionSetting = posRef.current || "beside";
                        let topValue = "8px";
                        let rightValue = "4px";

                        if (hasExistingBadge) {
                            if (positionSetting === "below") {
                                topValue = "40px";
                                rightValue = "4px";
                            } else {
                                topValue = "8px";
                                rightValue = "52px";
                            }
                        }

                        const debugMode = debugRef.current || "false";
                        const tooltipText = debugMode === "true" ? mediaId : "Dubbed";

                        const wrapper = await ctx.dom.createElement("div");
                        const wrapperClasses = [
                            "seanime-dub-badge-wrapper",
                            "absolute",
                            isPopup ? "z-[60]" : "z-[20]",
                            "flex",
                            "items-center",
                            "group/badge",
                            "pointer-events-auto",
                            "transition-transform",
                            "duration-300",
                            "ease-in-out",
                            isPopup ? "group-hover/media-entry-card:scale-100" : "group-hover/media-entry-card:scale-110",
                            isPopup ? "" : "group-hover/media-entry-card:-translate-y-1",
                            "group-hover/episode-card:scale-110",
                            "group-hover/episode-card:-translate-y-1"
                        ].join(" ");

                        await wrapper.setProperty("className", wrapperClasses);
                        await wrapper.setProperty("style", `top: ${topValue}; right: ${rightValue};`);

                        // --- ADVANCED INLINE JS (Animation + Bounds Checking) ---
                        const jsHoverLogic = `
                            (function(el) {
                                var id = 'seanime-dub-tooltip-temp';
                                var ex = document.getElementById(id);
                                if(ex) ex.remove();
                                var tt = document.createElement('div');
                                tt.id = id;
                                tt.innerText = '${tooltipText}';
                                
                                /* Style: Invisible start */
                                tt.style.cssText = 'position: absolute; z-index: 999999; background-color: #18181b; color: #FFFFFF; padding: 0.375rem 0.75rem; border-radius: 0.75rem; font-size: 0.875rem; line-height: 1.25rem; border: 1px solid #27272a; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; pointer-events: none; white-space: nowrap; opacity: 0; transform: translateX(-50%) scale(0.95) translateY(4px); transition: opacity 150ms ease-out, transform 150ms ease-out;';
                                
                                /* Calculate Position */
                                var rect = el.getBoundingClientRect();
                                var top = rect.top + window.scrollY - 34;
                                var left = rect.left + window.scrollX + (rect.width / 2);
                                
                                /* Initial Place to measure width */
                                tt.style.top = top + 'px';
                                tt.style.left = left + 'px';
                                document.body.appendChild(tt);
                                
                                /* Boundary Check (Prevent overflow) */
                                var ttRect = tt.getBoundingClientRect();
                                var winWidth = window.innerWidth;
                                var pad = 10;
                                
                                if (ttRect.left < pad) {
                                    /* Too far left */
                                    tt.style.left = (left + (pad - ttRect.left)) + 'px';
                                } else if (ttRect.right > winWidth - pad) {
                                    /* Too far right */
                                    tt.style.left = (left - (ttRect.right - (winWidth - pad))) + 'px';
                                }

                                /* Trigger Animation (Next Tick) */
                                setTimeout(function() {
                                    tt.style.opacity = '1';
                                    tt.style.transform = 'translateX(-50%) scale(1) translateY(0)';
                                }, 10);
                            })(this)
                        `.replace(/\s+/g, ' ');

                        const jsLeaveLogic = `
                            var tt = document.getElementById('seanime-dub-tooltip-temp'); 
                            if(tt) tt.remove();
                        `;

                        await wrapper.setProperty("innerHTML", `
                            <div class="group relative">
                                <span 
                                    onmouseenter="${jsHoverLogic}"
                                    onmouseleave="${jsLeaveLogic}"
                                    class="UI-Badge__root inline-flex flex-none w-fit overflow-hidden justify-center items-center gap-2 text-white ${colorClass} h-7 px-2.5 text-md font-semibold tracking-wide rounded-full shadow-md cursor-pointer transition-colors group"
                                >
                                    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1.2em" width="1.2em" xmlns="http://www.w3.org/2000/svg"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>
                                </span>
                            </div>
                        `);

                        if (isPopup) {
                            await el.append(wrapper);
                        } else {
                            // --- ATTACH TO PARENT ---
                            let targetContainer = el;
                            try {
                                const p = await el.getParent();
                                if (p && await p.getAttribute("href")) targetContainer = p;
                            } catch {}

                            await targetContainer.setStyle("position", "relative");

                            if (!(await targetContainer.getAttribute("data-has-dub-badge"))) {
                                await targetContainer.append(wrapper);
                                await targetContainer.setAttribute("data-has-dub-badge", "true");
                            }
                        }
                    }
                    await el.setAttribute("data-dub-badge-checked", "true");
                } else {
                    const currentRetries = parseInt((await el.getAttribute("data-badge-retries")) || "0");
                    if (currentRetries > 10) {
                        await el.setAttribute("data-dub-badge-checked", "true");
                    } else {
                        await el.setAttribute("data-badge-retries", (currentRetries + 1).toString());
                    }
                }
            } catch (err) { }
        };

        const processElements = async (elements: any[]) => {
            // "Safe" Parallel Processing
            await Promise.all(elements.map(el => processSingleCard(el)));
        };

        // Observer
        ctx.dom.observe(
            selectorBase,
            async (elements) => {
                await processElements(elements);
            },
            { identifyChildren: true, withInnerHTML: true }
        );

        // Interval
        ctx.setInterval(async () => {
            if (!isDataReady || isScanning) return;
            isScanning = true;
            
            const selectorRetry = `${selectorBase}:not([data-dub-badge-checked='true'])`;
            try {
                const retryElements = await ctx.dom.query(selectorRetry, { identifyChildren: true, withInnerHTML: true });
                if (retryElements && retryElements.length > 0) {
                    await processElements(retryElements);
                }
            } catch (e) { }
            finally {
                isScanning = false;
            }
        }, 2000);
    });
}
