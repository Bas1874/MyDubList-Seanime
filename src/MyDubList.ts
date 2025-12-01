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

    // --- STORAGE ---
    const getStorageItem = (key, def) => { try { return $storage.get(key) || def; } catch (e) { return def; } };
    const setStorageItem = (key, val) => { try { $storage.set(key, val); } catch (e) {} };

    const savedLang = getStorageItem("dub-badge-lang", "english");
    const defaultConf = savedLang === "english" ? "normal" : "low";
    const savedConf = getStorageItem("dub-badge-conf", defaultConf);
    const savedPos = getStorageItem("dub-badge-pos", "beside");
    const savedColor = getStorageItem("dub-badge-color", "default");
    const savedDebug = getStorageItem("dub-badge-debug", "false");

    const langRef = ctx.fieldRef(savedLang);
    const confRef = ctx.fieldRef(savedConf);
    const posRef = ctx.fieldRef(savedPos);
    const colRef = ctx.fieldRef(savedColor);
    const debugRef = ctx.fieldRef(savedDebug);
    const statusState = ctx.state("Ready");

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

    ctx.registerEventHandler("reload-data", async () => {
        setStorageItem("dub-badge-lang", langRef.current);
        setStorageItem("dub-badge-conf", confRef.current);
        setStorageItem("dub-badge-pos", posRef.current);
        setStorageItem("dub-badge-color", colRef.current);
        setStorageItem("dub-badge-debug", debugRef.current);
        await loadDubData();
        await resetDomBadges();
    });

    // --- INJECT GLOBAL TOOLTIP SCRIPT ---
    // This injects a script into the page that handles the "Popper-like" behavior
    const injectTooltipScript = async () => {
        const body = await ctx.dom.queryOne("body");
        if (!body) return;
        
        const scriptContent = `
            (function() {
                if (document.getElementById('seanime-dub-tooltip-style')) return;

                // 1. Create Styles
                const style = document.createElement('style');
                style.id = 'seanime-dub-tooltip-style';
                style.textContent = \`
                    #seanime-dub-tooltip {
                        position: fixed;
                        z-index: 99999;
                        pointer-events: none;
                        background: #111827; /* gray-900 */
                        border: 1px solid #1f2937; /* gray-800 */
                        color: white;
                        padding: 6px 12px;
                        border-radius: 0.75rem; /* rounded-xl */
                        font-size: 0.875rem; /* text-sm */
                        font-weight: 500;
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                        opacity: 0;
                        transition: opacity 0.15s ease;
                        white-space: nowrap;
                        top: 0; left: 0;
                        transform: translate(-50%, -100%); /* Center horizontally, move above */
                        margin-top: -8px; /* Gap above element */
                    }
                    #seanime-dub-tooltip.visible { opacity: 1; }
                \`;
                document.head.appendChild(style);

                // 2. Create Global Tooltip Element
                const tooltip = document.createElement('div');
                tooltip.id = 'seanime-dub-tooltip';
                document.body.appendChild(tooltip);

                // 3. Event Listeners using Delegation
                document.body.addEventListener('mouseover', (e) => {
                    // Find if we are hovering our badge or its icon
                    const target = e.target.closest('.seanime-dub-badge-wrapper');
                    if (!target) {
                        tooltip.classList.remove('visible');
                        return;
                    }
                    
                    const text = target.getAttribute('data-tooltip');
                    if (!text) return;

                    tooltip.textContent = text;
                    
                    // Calculate Position (Popper Logic)
                    const rect = target.getBoundingClientRect();
                    
                    // Center X: Left + Half Width
                    const x = rect.left + (rect.width / 2);
                    // Top Y: Top Edge
                    const y = rect.top;

                    tooltip.style.left = x + 'px';
                    tooltip.style.top = y + 'px';
                    tooltip.classList.add('visible');
                });

                document.body.addEventListener('mouseout', (e) => {
                    const related = e.relatedTarget;
                    // If moving to child or same element, ignore. If leaving badge, hide.
                    if (!related || !related.closest('.seanime-dub-badge-wrapper')) {
                        tooltip.classList.remove('visible');
                    }
                });
            })();
        `;

        const script = await ctx.dom.createElement("script");
        await script.setProperty("textContent", scriptContent);
        await body.append(script);
    };

    // --- DATA FETCHING ---
    const dubbedAnilistIds = new Set<string>();
    let isDataReady = false;

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
                } catch (e) {}
            }

            isDataReady = true;
            statusState.set(`Active: ${lang} (${dubbedAnilistIds.size})`);
            await injectTooltipScript(); // Inject script after data loads
        } catch (e) {
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

    loadDubData();

    // --- UI OBSERVER ---
    const selectorBase = "[data-media-entry-card-body='true'], [data-episode-card-image-container='true'], [data-media-entry-card-hover-popup-banner-container='true']";
    
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

            if (el.innerHTML) {
                if (el.innerHTML.includes("data-media-entry-card-body-releasing-badge-container") || 
                    el.innerHTML.includes("data-media-entry-card-body-next-airing-badge-container") ||
                    el.innerHTML.includes("data-media-entry-card-hover-popup-banner-releasing-badge-container")) {
                    hasExistingBadge = true;
                }
                const $ = LoadDoc(el.innerHTML);
                const imgSrc = $("img").attr("src");
                if (imgSrc) {
                    const match = imgSrc.match(/\/bx(\d+)-/) || imgSrc.match(/\/banner\/(\d+)/) || imgSrc.match(/\/cover\/.*\/(\d+)-/) || imgSrc.match(/\/media\/(\d+)/);
                    if (match && match[1]) mediaId = match[1];
                }
                if (mediaId === "N/A") {
                    const childLink = $("a[href*='id=']").attr("href");
                    if (childLink) {
                        const match = childLink.match(/[?&]id=(\d+)/);
                        if (match && match[1]) mediaId = match[1];
                    }
                }
            }

            if (mediaId === "N/A") {
                if (isPopup) {
                    try {
                        const parent = await el.getParent();
                        if (parent) {
                            const href = await parent.getAttribute("href");
                            if (href) {
                                const match = href.match(/[?&]id=(\d+)/);
                                if (match && match[1]) mediaId = match[1];
                            }
                        }
                    } catch (e) {}
                } else {
                    let currentElement = el;
                    for (let i = 0; i < 10; i++) {
                        if (!currentElement) break;
                        const dataId = await currentElement.getAttribute("data-media-id");
                        if (dataId) { mediaId = dataId; break; }
                        const href = await currentElement.getAttribute("href");
                        if (href) {
                            const match = href.match(/[?&]id=(\d+)/);
                            if (match && match[1]) { mediaId = match[1]; break; }
                        }
                        try {
                            const parent = await currentElement.getParent();
                            if (!parent) break;
                            currentElement = parent;
                        } catch (e) { break; }
                    }
                }
            }

            if (mediaId !== "N/A") {
                if (dubbedAnilistIds.has(mediaId)) {
                    let targetContainer = el;
                    if (!isPopup) {
                        try { const p = await el.getParent(); if (p) targetContainer = p; } catch(e) {}
                    }
                    if (targetContainer.innerHTML && targetContainer.innerHTML.includes("seanime-dub-badge-wrapper")) {
                        await el.setAttribute("data-dub-badge-checked", "true");
                        return;
                    }

                    const colorSetting = colRef.current || "default";
                    let colorClass = "bg-indigo-500 hover:bg-indigo-600"; 
                    if (colorSetting === "red") colorClass = "bg-red-600 hover:bg-red-700";
                    else if (colorSetting === "green") colorClass = "bg-green-600 hover:bg-green-700";
                    else if (colorSetting === "blue") colorClass = "bg-blue-600 hover:bg-blue-700";
                    else if (colorSetting === "orange") colorClass = "bg-orange-600 hover:bg-orange-700";

                    const positionSetting = posRef.current || "beside";
                    let topValue = "8px";  
                    let rightValue = "4px"; 
                    if (hasExistingBadge) {
                        if (positionSetting === "below") { topValue = "40px"; rightValue = "4px"; } 
                        else { topValue = "8px"; rightValue = "52px"; }
                    }

                    const debugMode = debugRef.current || "false";
                    const tooltipText = debugMode === "true" ? mediaId : "Dubbed";

                    const wrapper = await ctx.dom.createElement("div");
                    const wrapperClasses = [
                        "seanime-dub-badge-wrapper",
                        "absolute",
                        isPopup ? "z-[60]" : "z-[12]",
                        "flex", "items-center", "group/badge", "pointer-events-auto",
                        "transition-transform", "duration-300", "ease-in-out",
                        isPopup ? "group-hover/media-entry-card:scale-100" : "group-hover/media-entry-card:scale-110",
                        isPopup ? "" : "group-hover/media-entry-card:-translate-y-1",
                        "group-hover/episode-card:scale-110",
                        "group-hover/episode-card:-translate-y-1"
                    ].join(" ");
                    
                    await wrapper.setProperty("className", wrapperClasses);
                    await wrapper.setProperty("style", `top: ${topValue}; right: ${rightValue};`);
                    // Store Tooltip Text in Attribute
                    await wrapper.setAttribute("data-tooltip", tooltipText);
                    
                    // IMPORTANT: Removed the inner <div class="absolute..."> for the tooltip.
                    // It is now handled by the global script.
                    await wrapper.setProperty("innerHTML", `
                        <div class="group relative">
                            <span class="UI-Badge__root inline-flex flex-none w-fit overflow-hidden justify-center items-center gap-2 text-white ${colorClass} h-7 px-3 text-md font-semibold tracking-wide rounded-full shadow-md cursor-pointer transition-colors group">
                                <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1.2em" width="1.2em" xmlns="http://www.w3.org/2000/svg"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>
                            </span>
                        </div>
                    `);

                    if (isPopup) { await el.append(wrapper); } else { const parent = await el.getParent(); if (parent) { await parent.append(wrapper); } else { await el.append(wrapper); } }
                }
                await el.setAttribute("data-dub-badge-checked", "true");
            } else {
                const currentRetries = parseInt((await el.getAttribute("data-badge-retries")) || "0");
                if (currentRetries > 10) { await el.setAttribute("data-dub-badge-checked", "true"); } else { await el.setAttribute("data-badge-retries", (currentRetries + 1).toString()); }
            }
        } catch (err) {}
    };

    const processElements = async (elements: any[]) => { await Promise.all(elements.map(el => processSingleCard(el))); };

    ctx.dom.observe(selectorBase, async (elements) => { await processElements(elements); }, { identifyChildren: true, withInnerHTML: true });

    ctx.setInterval(async () => {
        if (!isDataReady) return;
        const selectorRetry = `${selectorBase}:not([data-dub-badge-checked='true'])`;
        try {
            const retryElements = await ctx.dom.query(selectorRetry, { identifyChildren: true, withInnerHTML: true });
            if (retryElements && retryElements.length > 0) { await processElements(retryElements); }
        } catch (e) {}
    }, 4000);

  });
}
