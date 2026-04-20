import type { ActaDetalle, MesaSearch, ResumenGeneral, Ubigeo } from "./client";

export function renderMesa(mesas: MesaSearch[]): void {
	if (mesas.length === 0) {
		console.log("No mesa found");
		return;
	}
	for (const m of mesas) {
		console.log(`Mesa ${m.codigoMesa}`);
		console.log(`  Local:          ${m.nombreLocalVotacion}`);
		console.log(`  Centro Poblado: ${m.centroPoblado}`);
		console.log(`  Habiles:        ${m.totalElectoresHabiles}`);
		console.log(`  Emitidos:       ${m.totalVotosEmitidos}`);
		console.log(`  Validos:        ${m.totalVotosValidos}`);
		console.log(`  Asistentes:     ${m.totalAsistentes}`);
		console.log(`  Participacion:  ${m.porcentajeParticipacionCiudadana.toFixed(1)}%`);
		console.log(`  Estado:         ${m.descripcionEstadoActa} (${m.codigoEstadoActa})`);
		console.log("");
	}
}

export function renderActa(acta: ActaDetalle): void {
	console.log(`Mesa ${acta.codigoMesa} - ${acta.descripcionMesa}`);
	console.log(`  Ubigeo: ${acta.ubigeoNivel01} / ${acta.ubigeoNivel02} / ${acta.ubigeoNivel03}`);
	console.log(`  Local: ${acta.nombreLocalVotacion}`);
	console.log(`  Habiles: ${acta.totalElectoresHabiles}  Emitidos: ${acta.totalVotosEmitidos}  Validos: ${acta.totalVotosValidos}`);
	console.log(`  Estado: ${acta.descripcionEstadoActa}`);
	console.log("");
	console.log("  Resultados:");

	const sorted = [...acta.detalle]
		.filter((d) => d.grafico === 1)
		.sort((a, b) => b.nvotos - a.nvotos);

	const maxName = Math.max(...sorted.map((d) => d.descripcion.length), 10);
	for (const d of sorted) {
		const pct = d.nporcentajeVotosValidos?.toFixed(1) ?? "-";
		console.log(`    ${d.descripcion.padEnd(maxName)}  ${String(d.nvotos).padStart(4)}  ${pct.padStart(5)}%`);
	}

	const especiales = acta.detalle.filter((d) => d.grafico !== 1);
	if (especiales.length > 0) {
		console.log("");
		for (const d of especiales) {
			console.log(`    ${d.descripcion.padEnd(maxName)}  ${String(d.nvotos).padStart(4)}`);
		}
	}

	if (acta.archivos && acta.archivos.length > 0) {
		console.log("");
		console.log("  Archivos:");
		for (const a of acta.archivos) {
			console.log(`    [${a.tipo === 1 ? "Escrutinio" : "Instalacion"}] ${a.id}`);
		}
	}
}

export function renderResumen(resumen: ResumenGeneral): void {
	console.log("Resumen General");
	console.log(`  Actas contabilizadas: ${resumen.actasContabilizadas} (${resumen.contabilizadas.toFixed(1)}%)`);
	console.log(`  Total actas:         ${resumen.totalActas}`);
	console.log(`  Participacion:       ${resumen.participacionCiudadana.toFixed(1)}%`);
	console.log(`  Enviadas JEE:        ${resumen.actasEnviadasJee} (${resumen.enviadasJee.toFixed(1)}%)`);
	console.log(`  Pendientes JEE:      ${resumen.actasPendientesJee} (${resumen.pendientesJee.toFixed(1)}%)`);
	console.log(`  Actualizado:         ${resumen.fechaActualizacion}`);
}

export function renderUbigeos(ubigeos: Ubigeo[]): void {
	for (const u of ubigeos) {
		console.log(`${u.codigo}  ${u.nombre}`);
	}
}
