const PARTY_COLORS: Record<string, string> = {
	"FUERZA POPULAR": "#FF6600",
	"PARTIDO DEMOCRATICO SOMOS PERU": "#0EA5E9",
	"RENOVACION POPULAR": "#0C77A1",
	"ALIANZA PARA EL PROGRESO": "#00529B",
	"JUNTOS POR EL PERU": "#E30613",
	"AVANZA PAIS - PARTIDO DE INTEGRACION SOCIAL": "#F59E0B",
	"PARTIDO POLITICO NACIONAL PERU LIBRE": "#CC0000",
	"PODEMOS PERU": "#16A34A",
	"PARTIDO MORADO": "#6B21A8",
	"PARTIDO FRENTE DE LA ESPERANZA 2021": "#99C48D",
	"PARTIDO DEMOCRATA UNIDO PERU": "#9CD9B6",
	"PARTIDO PATRIOTICO DEL PERU": "#888787",
	"PARTIDO DEMOCRATA VERDE": "#B8E4CC",
	"FE EN EL PERU": "#48AF3E",
	"PERU MODERNO": "#BF615B",
	"PARTIDO POLITICO PERU PRIMERO": "#E79A9D",
	"SALVEMOS AL PERU": "#AE7474",
	"PARTIDO APRISTA PERUANO": "#D71920",
	"PRIMERO LA GENTE - COMUNIDAD, ECOLOGIA, LIBERTAD Y PROGRESO": "#589592",
	"PARTIDO POLITICO PERU ACCION": "#3C2373",
	"LIBERTAD POPULAR": "#D8D802",
	"PARTIDO SICREO": "#D3C2C2",
	"PARTIDO CIVICO OBRAS": "#DEE8DD",
	"PARTIDO PAIS PARA TODOS": "#BE9C18",
	"PARTIDO DEL BUEN GOBIERNO": "#F98D1A",
	"PROGRESEMOS": "#81D018",
	"AHORA NACION - AN": "#EB3537",
	"PARTIDO DEMOCRATICO FEDERAL": "#5DA472",
	"UNIDAD NACIONAL": "#ECEBE9",
	"FUERZA Y LIBERTAD": "#8B62C4",
	"ALIANZA ELECTORAL VENCEREMOS": "#B78277",
	"FRENTE POPULAR AGRICOLA FIA DEL PERU": "#7A9E4D",
};

function normalize(s: string): string {
	return s
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase()
		.trim();
}

const normalizedMap = new Map(
	Object.entries(PARTY_COLORS).map(([k, v]) => [normalize(k), v]),
);

export function getPartyHex(name: string): string | null {
	return normalizedMap.get(normalize(name)) ?? null;
}

export function hexToAnsi(hex: string): string {
	const h = hex.replace("#", "");
	const r = Number.parseInt(h.slice(0, 2), 16);
	const g = Number.parseInt(h.slice(2, 4), 16);
	const b = Number.parseInt(h.slice(4, 6), 16);
	return `\x1b[38;2;${r};${g};${b}m`;
}

const RESET = "\x1b[0m";
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

export function partyColor(name: string, text: string): string {
	if (!useColor) return text;
	const hex = getPartyHex(name);
	if (!hex) return text;
	return `${hexToAnsi(hex)}${text}${RESET}`;
}
