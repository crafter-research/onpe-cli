import pc from "picocolors";
import type { ActaDetalle, MesaSearch, Participante, ResumenGeneral, Ubigeo } from "./client";
import { partyColor } from "./partidos";

const BAR_WIDTH = 20;

function bar(pct: number, color: (s: string) => string): string {
	const clamped = Math.max(0, Math.min(100, pct));
	const filled = Math.round((clamped / 100) * BAR_WIDTH);
	const empty = BAR_WIDTH - filled;
	return color("#".repeat(filled)) + pc.dim("-".repeat(empty));
}

function estadoBadge(code: string, desc: string): string {
	switch (code) {
		case "C":
			return pc.green(`[${desc}]`);
		case "E":
			return pc.yellow(`[${desc}]`);
		default:
			return pc.dim(`[${desc}]`);
	}
}

export function renderMesa(mesas: MesaSearch[]): void {
	if (mesas.length === 0) {
		console.log(pc.dim("No mesa found"));
		return;
	}
	for (const m of mesas) {
		console.log("");
		console.log(`  ${pc.bold(`Mesa ${m.codigoMesa}`)}  ${estadoBadge(m.codigoEstadoActa, m.descripcionEstadoActa)}`);
		console.log("");
		if (m.nombreLocalVotacion) {
			console.log(`  ${pc.dim("Local")}          ${m.nombreLocalVotacion}`);
		}
		if (m.centroPoblado) {
			console.log(`  ${pc.dim("Centro Poblado")} ${m.centroPoblado}`);
		}
		const participacion = m.porcentajeParticipacionCiudadana ?? 0;
		console.log(`  ${pc.dim("Habiles")}        ${pc.bold(String(m.totalElectoresHabiles))}`);
		console.log(`  ${pc.dim("Emitidos")}       ${m.totalVotosEmitidos ?? "-"}  ${pc.dim("Validos")} ${m.totalVotosValidos ?? "-"}`);
		console.log(`  ${pc.dim("Participacion")}  ${bar(participacion, pc.cyan)} ${pc.bold(`${participacion.toFixed(1)}%`)}`);
		console.log("");
	}
}

export function renderActa(acta: ActaDetalle): void {
	console.log("");
	console.log(`  ${pc.bold(`Mesa ${acta.codigoMesa}`)}  ${estadoBadge(acta.codigoEstadoActa, acta.descripcionEstadoActa)}`);
	console.log(`  ${pc.dim(`${acta.ubigeoNivel01} / ${acta.ubigeoNivel02} / ${acta.ubigeoNivel03}`)}`);
	if (acta.nombreLocalVotacion) {
		console.log(`  ${acta.nombreLocalVotacion}`);
	}
	console.log("");
	console.log(`  ${pc.dim("Habiles")} ${pc.bold(String(acta.totalElectoresHabiles))}  ${pc.dim("Emitidos")} ${pc.bold(String(acta.totalVotosEmitidos))}  ${pc.dim("Validos")} ${pc.bold(String(acta.totalVotosValidos))}`);
	console.log("");

	const sorted = [...acta.detalle]
		.filter((d) => d.grafico === 1)
		.sort((a, b) => b.nvotos - a.nvotos);

	if (sorted.length === 0) return;

	const maxVotes = sorted[0]!.nvotos;
	const maxName = Math.min(Math.max(...sorted.map((d) => d.descripcion.length), 10), 40);

	for (const d of sorted) {
		const pct = d.nporcentajeVotosValidos ?? 0;
		const name = d.descripcion.length > maxName
			? `${d.descripcion.slice(0, maxName - 1)}\u2026`
			: d.descripcion.padEnd(maxName);
		const coloredName = partyColor(d.descripcion, name);
		const relBar = maxVotes > 0 ? (d.nvotos / maxVotes) * 100 : 0;
		const barStr = bar(relBar, (s) => partyColor(d.descripcion, s) || pc.blue(s));
		const votes = String(d.nvotos).padStart(4);
		const pctStr = `${pct.toFixed(1)}%`.padStart(6);

		if (d === sorted[0]) {
			console.log(`  ${coloredName}  ${barStr} ${pc.bold(votes)} ${pc.bold(pctStr)}`);
		} else {
			console.log(`  ${coloredName}  ${barStr} ${votes} ${pc.dim(pctStr)}`);
		}
	}

	const especiales = acta.detalle.filter((d) => d.grafico !== 1);
	if (especiales.length > 0) {
		console.log("");
		for (const d of especiales) {
			console.log(`  ${pc.dim(d.descripcion.padEnd(maxName))}  ${pc.dim(String(d.nvotos).padStart(4))}`);
		}
	}

	if (acta.archivos && acta.archivos.length > 0) {
		console.log("");
		console.log(`  ${pc.dim("Archivos:")}`);
		for (const a of acta.archivos) {
			const tipo = a.tipo === 1 ? pc.cyan("Escrutinio") : pc.dim("Instalacion");
			console.log(`    ${tipo}  ${pc.dim(a.id)}`);
		}
	}
	console.log("");
}

export function renderResumen(resumen: ResumenGeneral): void {
	console.log("");
	console.log(`  ${pc.bold("Resumen General")}`);
	console.log("");

	const pctContab = resumen.actasContabilizadas ?? 0;
	console.log(`  ${pc.dim("Contabilizadas")}  ${bar(pctContab, pc.green)} ${pc.bold(String(resumen.contabilizadas))} ${pc.dim(`(${pctContab}%)`)}`);

	const pctJee = resumen.enviadasJee ?? 0;
	console.log(`  ${pc.dim("Enviadas JEE")}    ${bar(pctJee, pc.cyan)} ${pc.bold(String(resumen.actasEnviadasJee))} ${pc.dim(`(${pctJee}%)`)}`);

	const pctPend = resumen.pendientesJee ?? 0;
	console.log(`  ${pc.dim("Pendientes JEE")}  ${bar(pctPend, pc.yellow)} ${pc.bold(String(resumen.actasPendientesJee))} ${pc.dim(`(${pctPend}%)`)}`);

	console.log("");
	console.log(`  ${pc.dim("Total actas")}     ${pc.bold(String(resumen.totalActas))}`);
	console.log(`  ${pc.dim("Participacion")}   ${pc.bold(`${resumen.participacionCiudadana.toFixed(1)}%`)}`);
	console.log(`  ${pc.dim("Actualizado")}     ${pc.dim(resumen.fechaActualizacion)}`);
	console.log("");
}

export function renderRanking(participantes: Participante[]): void {
	const sorted = [...participantes].sort((a, b) => b.totalVotosValidos - a.totalVotosValidos);
	const maxVotes = sorted[0]?.totalVotosValidos ?? 1;

	console.log("");
	console.log(`  ${pc.bold("Ranking Presidencial")}`);
	console.log("");

	for (let i = 0; i < sorted.length; i++) {
		const p = sorted[i]!;
		const pos = String(i + 1).padStart(2);
		const pct = p.porcentajeVotosValidos.toFixed(2);
		const votes = p.totalVotosValidos.toLocaleString("es-PE");
		const relBar = (p.totalVotosValidos / maxVotes) * 100;
		const barStr = bar(relBar, (s) => partyColor(p.nombreAgrupacionPolitica, s) || pc.blue(s));
		const name = p.nombreCandidato.length > 30
			? p.nombreCandidato.slice(0, 29) + "."
			: p.nombreCandidato;
		const party = p.nombreAgrupacionPolitica.length > 20
			? p.nombreAgrupacionPolitica.slice(0, 19) + "."
			: p.nombreAgrupacionPolitica;

		if (i === 0) {
			console.log(`  ${pc.bold(pos)}. ${pc.bold(partyColor(p.nombreAgrupacionPolitica, name))}  ${pc.dim(party)}`);
			console.log(`      ${barStr}  ${pc.bold(votes)}  ${pc.bold(`${pct}%`)}`);
		} else {
			console.log(`  ${pc.dim(pos)}. ${partyColor(p.nombreAgrupacionPolitica, name)}  ${pc.dim(party)}`);
			console.log(`      ${barStr}  ${votes}  ${pc.dim(`${pct}%`)}`);
		}
	}
	console.log("");
}

export function renderUbigeos(ubigeos: Ubigeo[]): void {
	for (const u of ubigeos) {
		console.log(`  ${pc.dim(u.codigo)}  ${pc.bold(u.nombre)}`);
	}
	console.log("");
}
