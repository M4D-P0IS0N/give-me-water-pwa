import { MASCOT_LEVELS } from "./constants.js";
import { getCurrentProgressPercentage } from "./state.js";

const USE_PROCESSED_PATH = true;
const POWER_SPARKLES_COUNT = 50;
const POWER_BOLTS_COUNT = 10;
let isMotionEnabled = false;

const LAYER_LAYOUT_BY_LEVEL = {
    0: {
        robotScale: 0.98,
        robotOffsetY: 2,
        oilScale: 0.88,
        oilOffsetY: -4
    },
    25: {
        robotScale: 1,
        robotOffsetY: 0,
        oilScale: 0.92,
        oilOffsetY: -4
    },
    50: {
        robotScale: 1.02,
        robotOffsetY: 0,
        oilScale: 0.97,
        oilOffsetY: -4
    },
    75: {
        robotScale: 1.04,
        robotOffsetY: -2,
        oilScale: 1.02,
        oilOffsetY: -5
    },
    100: {
        robotScale: 1.12,
        robotOffsetY: 6,
        oilScale: 1.06,
        oilOffsetY: -6
    }
};

const OIL_RING_COLOR_BY_LEVEL = {
    0: "#9ca0b0",
    25: "#1e66f5",
    50: "#179299",
    75: "#df8e1d",
    100: "#40a02b"
};

function clampLevel(rawPercentage) {
    if (rawPercentage >= 100) return 100;
    if (rawPercentage >= 75) return 75;
    if (rawPercentage >= 50) return 50;
    if (rawPercentage >= 25) return 25;
    return 0;
}

function randomBetween(minValue, maxValue) {
    return minValue + Math.random() * (maxValue - minValue);
}

function processedAssetPath(typeFolder, fileName) {
    return `./Imagens/Processed/${typeFolder}/${fileName}`;
}

function originalAssetPath(typeFolder, fileName) {
    return `./Imagens/${typeFolder}/${fileName}`;
}

function applyImageWithFallback(imageElement, processedPath, originalPath) {
    imageElement.onerror = () => {
        imageElement.onerror = null;
        imageElement.src = originalPath;
    };
    imageElement.src = USE_PROCESSED_PATH ? processedPath : originalPath;
}

function applyImageWithMultiFallback(imageElement, sourcePaths) {
    const validPaths = (sourcePaths || []).filter(Boolean);
    if (!imageElement || validPaths.length === 0) {
        return;
    }

    let currentPathIndex = 0;
    imageElement.onerror = () => {
        currentPathIndex += 1;
        if (currentPathIndex >= validPaths.length) {
            imageElement.onerror = null;
            return;
        }
        imageElement.src = validPaths[currentPathIndex];
    };
    imageElement.src = validPaths[currentPathIndex];
}

function initializePowerEffects(domRefs) {
    const sparklesContainer = domRefs.mascotPowerSparkles;
    const lightningContainer = domRefs.mascotPowerLightning;

    if (sparklesContainer && sparklesContainer.childElementCount === 0) {
        for (let index = 0; index < POWER_SPARKLES_COUNT; index += 1) {
            const sparkleElement = document.createElement("div");
            sparkleElement.className = "mascot-sparkle";
            sparkleElement.style.left = `${randomBetween(0, 100)}%`;
            sparkleElement.style.top = `${randomBetween(0, 100)}%`;
            sparkleElement.style.animationDelay = `${randomBetween(0, 2)}s`;
            sparkleElement.style.setProperty("--dx", `${randomBetween(-30, 30)}px`);
            sparkleElement.style.setProperty("--dy", `${randomBetween(-30, 30)}px`);
            sparkleElement.style.setProperty("--dx2", `${randomBetween(-60, 60)}px`);
            sparkleElement.style.setProperty("--dy2", `${randomBetween(-60, 60)}px`);
            sparklesContainer.appendChild(sparkleElement);
        }
    }

    if (lightningContainer && lightningContainer.childElementCount === 0) {
        for (let index = 0; index < POWER_BOLTS_COUNT; index += 1) {
            const boltElement = document.createElement("div");
            boltElement.className = "mascot-bolt";
            boltElement.style.left = `${randomBetween(0, 100)}%`;
            boltElement.style.top = `${randomBetween(0, 100)}%`;
            boltElement.style.animationDelay = `${randomBetween(0, 0.5)}s`;
            boltElement.style.setProperty("--rot", `${randomBetween(0, 360)}deg`);
            boltElement.style.setProperty("--tx", `${randomBetween(-80, 80)}px`);
            boltElement.style.setProperty("--ty", `${randomBetween(-80, 80)}px`);
            lightningContainer.appendChild(boltElement);
        }
    }
}

function applyLayerLayout(robotImageElement, oilImageElement, mascotLevel) {
    const layoutConfig = LAYER_LAYOUT_BY_LEVEL[mascotLevel] || LAYER_LAYOUT_BY_LEVEL[25];
    robotImageElement.style.setProperty("--robot-scale", String(layoutConfig.robotScale));
    robotImageElement.style.setProperty("--robot-offset-y", `${layoutConfig.robotOffsetY}px`);
    oilImageElement.style.setProperty("--oil-scale", String(layoutConfig.oilScale));
    oilImageElement.style.setProperty("--oil-offset-y", `${layoutConfig.oilOffsetY}px`);
}

function applyOilRingProgress(oilRingElement, progressPercentage, mascotLevel) {
    if (!oilRingElement) {
        return;
    }

    const safeProgress = Math.max(0, Math.min(100, progressPercentage));
    const ringColor = OIL_RING_COLOR_BY_LEVEL[mascotLevel] || OIL_RING_COLOR_BY_LEVEL[0];
    oilRingElement.style.setProperty("--oil-ring-progress", `${safeProgress}%`);
    oilRingElement.style.setProperty("--oil-ring-color", ringColor);
    oilRingElement.dataset.level = String(mascotLevel);
}

function getNumberCssCustomProperty(imageElement, propertyName, fallbackValue) {
    const rawValue = imageElement.style.getPropertyValue(propertyName).replace("px", "").trim();
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function refreshLayerAnimations(robotImageElement, oilImageElement) {
    if (!isMotionEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    const robotScale = getNumberCssCustomProperty(robotImageElement, "--robot-scale", 1);
    const robotOffsetY = getNumberCssCustomProperty(robotImageElement, "--robot-offset-y", 0);
    const oilScale = getNumberCssCustomProperty(oilImageElement, "--oil-scale", 1);
    const oilOffsetY = getNumberCssCustomProperty(oilImageElement, "--oil-offset-y", 0);

    if (robotImageElement.__motionAnimation) {
        robotImageElement.__motionAnimation.cancel();
    }
    if (oilImageElement.__motionAnimation) {
        oilImageElement.__motionAnimation.cancel();
    }

    robotImageElement.__motionAnimation = robotImageElement.animate(
        [
            { transform: `translateY(${robotOffsetY}px) scale(${robotScale}) rotate(-1deg)` },
            { transform: `translateY(${robotOffsetY - 8}px) scale(${robotScale}) rotate(1deg)` },
            { transform: `translateY(${robotOffsetY}px) scale(${robotScale}) rotate(-1deg)` }
        ],
        {
            duration: 4200,
            iterations: Infinity,
            easing: "ease-in-out"
        }
    );

    oilImageElement.__motionAnimation = oilImageElement.animate(
        [
            { transform: `translateY(${oilOffsetY}px) scale(${oilScale})` },
            { transform: `translateY(${oilOffsetY - 2}px) scale(${oilScale * 1.015})` },
            { transform: `translateY(${oilOffsetY}px) scale(${oilScale})` }
        ],
        {
            duration: 3600,
            iterations: Infinity,
            easing: "ease-in-out"
        }
    );
}

export function resolveMascotLevel(appState) {
    const progressPercentage = getCurrentProgressPercentage(appState);
    return clampLevel(progressPercentage);
}

export function renderMascotLevel(domRefs, appState) {
    const progressPercentage = getCurrentProgressPercentage(appState);
    const mascotLevel = clampLevel(progressPercentage);
    const robotImageElement = domRefs.mascotRobot;
    const oilImageElement = domRefs.mascotOil;
    const oilRingElement = domRefs.mascotOilRing;
    const robotPanelElement = domRefs.mascotRobotPanel;
    const robotShellElement = domRefs.mascotRobotShell;
    const powerAuraElement = domRefs.mascotPowerAura;
    const powerSparklesElement = domRefs.mascotPowerSparkles;
    const powerLightningElement = domRefs.mascotPowerLightning;
    if (!robotImageElement || !oilImageElement) {
        return mascotLevel;
    }

    initializePowerEffects(domRefs);

    const oilFileName = `oleo_${mascotLevel}.png`;
    const robotFileName = `robo_${mascotLevel}.png`;
    applyLayerLayout(robotImageElement, oilImageElement, mascotLevel);

    const processedOilPath = processedAssetPath("Oleo", oilFileName);
    const originalOilPath = originalAssetPath("Oleo", oilFileName);
    applyImageWithFallback(oilImageElement, processedOilPath, originalOilPath);
    applyOilRingProgress(oilRingElement, progressPercentage, mascotLevel);

    const processedRobotPath = processedAssetPath("Robo", robotFileName);
    const originalRobotPath = originalAssetPath("Robo", robotFileName);
    const processedCompleteRobotPath = processedAssetPath("Robo", "robo_100_completo_semfundo.png");
    const processedSemiTransparentRobotPath = processedAssetPath("Robo", "robo_100_semfundo.png");
    const semiTransparentRobotPath = originalAssetPath("Robo", "robo_100_semfundo.png");
    const shouldUseOriginalRobotOnly = mascotLevel === 0;

    if (mascotLevel === 100) {
        applyImageWithMultiFallback(robotImageElement, [
            processedCompleteRobotPath,
            processedSemiTransparentRobotPath,
            semiTransparentRobotPath,
            processedRobotPath,
            originalRobotPath
        ]);
        powerAuraElement?.classList.remove("hidden");
        powerSparklesElement?.classList.remove("hidden");
        powerLightningElement?.classList.remove("hidden");
        robotPanelElement?.classList.add("power-mode");
        robotShellElement?.classList.add("powered-up");
    } else {
        if (shouldUseOriginalRobotOnly) {
            applyImageWithFallback(robotImageElement, originalRobotPath, originalRobotPath);
        } else {
            applyImageWithFallback(robotImageElement, processedRobotPath, originalRobotPath);
        }
        powerAuraElement?.classList.add("hidden");
        powerSparklesElement?.classList.add("hidden");
        powerLightningElement?.classList.add("hidden");
        robotPanelElement?.classList.remove("power-mode");
        robotShellElement?.classList.remove("powered-up");
    }

    refreshLayerAnimations(robotImageElement, oilImageElement);
    return mascotLevel;
}

export function setupMascotMotion(domRefs) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    isMotionEnabled = true;
    const robotImageElement = domRefs.mascotRobot;
    const oilImageElement = domRefs.mascotOil;
    if (!robotImageElement || !oilImageElement) {
        return;
    }
    initializePowerEffects(domRefs);
    refreshLayerAnimations(robotImageElement, oilImageElement);
}

export function getMascotLevels() {
    return [...MASCOT_LEVELS];
}
