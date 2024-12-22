export function isNewYear() {
    const today = new Date();
    const month = today.getMonth();
    const day = today.getDate();

    return (month === 11 && day >= 20) || (month === 0 && day <= 10);
}