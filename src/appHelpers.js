export function calculateGoalMlFromOnboarding(formData) {
    const genderBase = formData.gender === "male" ? 35 : 31;
    const fgFactor = genderBase + formData.heightCm / 100;
    const rawGoal = formData.weightKg * fgFactor * formData.activityFactor * formData.climateFactor;
    return Math.round(rawGoal / 50) * 50;
}

export function readOnboardingFormData() {
    return {
        gender: document.getElementById("gender").value,
        weightKg: Number(document.getElementById("weight").value),
        heightCm: Number(document.getElementById("height").value),
        activityFactor: Number(document.getElementById("activity").value),
        climateFactor: Number(document.getElementById("climate").value)
    };
}

export function arrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binaryText = "";
    bytes.forEach((value) => {
        binaryText += String.fromCharCode(value);
    });
    return btoa(binaryText);
}
