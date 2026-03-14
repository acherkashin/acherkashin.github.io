export const NEW_YEAR_START_MONTH = 11;
export const NEW_YEAR_START_DAY = 20;
export const NEW_YEAR_END_MONTH = 0;
export const NEW_YEAR_END_DAY = 10;
export const NEW_YEAR_SEASON = 'new-year';
export const SEASON_QUERY_PARAM = 'season';
export const SEASON_QUERY_NEW_YEAR_VALUE = NEW_YEAR_SEASON;

export function isNewYear(date = new Date()) {
	const month = date.getMonth();
	const day = date.getDate();

	return (
		(month === NEW_YEAR_START_MONTH && day >= NEW_YEAR_START_DAY) ||
		(month === NEW_YEAR_END_MONTH && day <= NEW_YEAR_END_DAY)
	);
}

export function getSeasonOverride(search = '') {
	const searchParams = new URLSearchParams(search);
	const season = searchParams.get(SEASON_QUERY_PARAM);

	return season === SEASON_QUERY_NEW_YEAR_VALUE ? SEASON_QUERY_NEW_YEAR_VALUE : null;
}

export function resolveSeason(date = new Date(), search = '') {
	return getSeasonOverride(search) ?? (isNewYear(date) ? NEW_YEAR_SEASON : null);
}
