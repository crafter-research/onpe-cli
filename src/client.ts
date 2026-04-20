const DEFAULT_BASE = "https://resultadoelectoral.onpe.gob.pe/presentacion-backend";
const DEFAULT_REFERER = "https://resultadoelectoral.onpe.gob.pe/main/actas";
const DEFAULT_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class OnpeError extends Error {
	constructor(
		public status: number,
		public body: string,
		public url: string,
	) {
		super(`ONPE ${status} on ${url}: ${body.slice(0, 200)}`);
	}
}

type Envelope<T> = { success: boolean; message: string; data: T };

export interface ClientOptions {
	base?: string;
	referer?: string;
	userAgent?: string;
	timeout?: number;
}

export class OnpeClient {
	private base: string;
	private headers: Record<string, string>;
	private timeout: number;

	constructor(opts: ClientOptions = {}) {
		this.base = opts.base ?? DEFAULT_BASE;
		this.timeout = opts.timeout ?? 15_000;
		this.headers = {
			"User-Agent": opts.userAgent ?? DEFAULT_UA,
			Referer: opts.referer ?? DEFAULT_REFERER,
			Accept: "application/json, text/plain, */*",
			"Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
			"Sec-Fetch-Dest": "empty",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Site": "same-origin",
		};
	}

	async get<T>(path: string): Promise<T> {
		const url = path.startsWith("http") ? path : `${this.base}${path}`;
		const res = await fetch(url, {
			headers: this.headers,
			signal: AbortSignal.timeout(this.timeout),
		});
		const text = await res.text();
		if (!res.ok) throw new OnpeError(res.status, text, url);
		if (text.trim().startsWith("<")) {
			throw new OnpeError(res.status, "HTML fallback (CDN blocked — check headers)", url);
		}
		if (!text) return null as T;
		const parsed = JSON.parse(text);
		if (parsed && typeof parsed === "object" && "success" in parsed) {
			return (parsed as Envelope<T>).data;
		}
		return parsed as T;
	}

	async procesoActivo() {
		return this.get<ProcesoElectoral>("/proceso/proceso-electoral-activo");
	}

	async elecciones(idProceso: number) {
		return this.get<Eleccion[]>(`/proceso/${idProceso}/elecciones`);
	}

	async resumenGeneral(idEleccion: number) {
		return this.get<ResumenGeneral>(
			`/resumen-general/totales?idEleccion=${idEleccion}&tipoFiltro=eleccion`,
		);
	}

	async buscarMesa(codigo: string) {
		return this.get<MesaSearch[]>(`/actas/buscar/mesa?codigoMesa=${codigo}`);
	}

	async actaDetalle(idActa: number) {
		return this.get<ActaDetalle>(`/actas/${idActa}`);
	}

	async actaFileUrl(fileId: string): Promise<string> {
		const resp = await this.get<string | { url?: string }>(`/actas/file?id=${fileId}`);
		if (typeof resp === "string") return resp;
		if (resp && typeof resp === "object" && "url" in resp && resp.url) return resp.url;
		throw new Error(`Unexpected file response for ${fileId}: ${JSON.stringify(resp)}`);
	}

	async ubigeos(idEleccion: number, nivel: 1 | 2 | 3, padre?: string) {
		let path = `/ubigeo/${idEleccion}/nivel/${nivel}`;
		if (padre) path += `?padre=${padre}`;
		return this.get<Ubigeo[]>(path);
	}

	async resultadosDepartamento(idEleccion: number, ubigeo: string) {
		return this.get<ResultadoDepartamento>(
			`/resumen-general/totales?idEleccion=${idEleccion}&tipoFiltro=departamento&ubigeo=${ubigeo}`,
		);
	}

	async resolveEleccion(tipo?: string): Promise<{ proceso: ProcesoElectoral; eleccion: Eleccion }> {
		const proceso = await this.procesoActivo();
		const elecciones = await this.elecciones(proceso.id);
		let eleccion: Eleccion | undefined;
		if (tipo) {
			eleccion = elecciones.find(
				(e) => e.nombre.toLowerCase().includes(tipo.toLowerCase()) && e.idEleccion > 0,
			);
		}
		if (!eleccion) {
			eleccion = elecciones.find((e) => e.esPrincipal);
		}
		if (!eleccion) {
			eleccion = elecciones.find((e) => e.idEleccion > 0);
		}
		if (!eleccion) throw new Error("No election found");
		return { proceso, eleccion };
	}

	async doctor(): Promise<DoctorResult> {
		const checks: DoctorCheck[] = [];
		let proceso: ProcesoElectoral | null = null;

		try {
			proceso = await this.procesoActivo();
			checks.push({ name: "proceso-activo", ok: true, detail: proceso.nombre });
		} catch (e) {
			checks.push({
				name: "proceso-activo",
				ok: false,
				detail: e instanceof Error ? e.message : String(e),
			});
		}

		if (proceso) {
			try {
				const elecciones = await this.elecciones(proceso.id);
				checks.push({
					name: "elecciones",
					ok: true,
					detail: `${elecciones.length} elecciones`,
				});

				const presidencial = elecciones.find((e) => e.idEleccion > 0 && e.esPrincipal);
				if (presidencial) {
					try {
						const resumen = await this.resumenGeneral(presidencial.idEleccion);
						checks.push({
							name: "resumen-general",
							ok: true,
							detail: `${resumen.actasContabilizadas} actas contabilizadas`,
						});
					} catch (e) {
						checks.push({
							name: "resumen-general",
							ok: false,
							detail: e instanceof Error ? e.message : String(e),
						});
					}
				}
			} catch (e) {
				checks.push({
					name: "elecciones",
					ok: false,
					detail: e instanceof Error ? e.message : String(e),
				});
			}
		}

		try {
			await this.buscarMesa("000001");
			checks.push({ name: "buscar-mesa", ok: true, detail: "mesa 000001 accesible" });
		} catch (e) {
			checks.push({
				name: "buscar-mesa",
				ok: false,
				detail: e instanceof Error ? e.message : String(e),
			});
		}

		const allOk = checks.every((c) => c.ok);
		return { ok: allOk, checks, proceso };
	}
}

export interface ProcesoElectoral {
	id: number;
	nombre: string;
	acronimo: string;
	fechaProceso: number;
	idEleccionPrincipal: number;
	tipoProcesoElectoral: string;
	activoFechaProceso: boolean;
}

export interface Eleccion {
	id: number;
	nombre: string;
	url: string;
	idEleccion: number;
	padre: number;
	hijos: boolean;
	icono: string;
	orden: number;
	esPrincipal: boolean;
	descripcion: string;
}

export interface ResumenGeneral {
	actasContabilizadas: number;
	contabilizadas: number;
	totalActas: number;
	participacionCiudadana: number;
	actasEnviadasJee: number;
	enviadasJee: number;
	actasPendientesJee: number;
	pendientesJee: number;
	fechaActualizacion: string;
}

export interface MesaSearch {
	id: number;
	codigoMesa: string;
	idEleccion: number;
	idAmbitoGeografico: number;
	idUbigeo: number;
	centroPoblado: string;
	nombreLocalVotacion: string;
	codigoLocalVotacion: string;
	totalElectoresHabiles: number;
	totalVotosEmitidos: number;
	totalVotosValidos: number;
	totalAsistentes: number;
	porcentajeParticipacionCiudadana: number;
	estadoActa: string;
	estadoComputo: string;
	codigoEstadoActa: string;
	descripcionEstadoActa: string;
}

export interface ActaDetalleEntry {
	descripcion: string;
	estado: number;
	grafico: number;
	nagrupacionPolitica: number;
	ccodigo: string;
	nposicion: number;
	nvotos: number;
	nporcentajeVotosValidos: number | null;
	nporcentajeVotosEmitidos: number;
	candidato: Array<{
		apellidoPaterno?: string;
		apellidoMaterno?: string;
		nombres?: string;
		cdocumentoIdentidad?: string;
	}>;
}

export interface ActaArchivo {
	id: string;
	tipo: number;
	nombre: string;
	descripcion: string;
	daudFechaCreacion: number;
}

export interface ActaDetalle {
	id: number;
	codigoMesa: string;
	descripcionMesa: string;
	idEleccion: number;
	ubigeoNivel01: string;
	ubigeoNivel02: string;
	ubigeoNivel03: string;
	centroPoblado: string;
	nombreLocalVotacion: string;
	totalElectoresHabiles: number;
	totalVotosEmitidos: number;
	totalVotosValidos: number;
	totalAsistentes: number;
	porcentajeParticipacionCiudadana: number;
	estadoActa: string;
	codigoEstadoActa: string;
	descripcionEstadoActa: string;
	detalle: ActaDetalleEntry[];
	archivos?: ActaArchivo[];
}

export interface Ubigeo {
	id: number;
	codigo: string;
	nombre: string;
}

export interface ResultadoDepartamento {
	actasContabilizadas: number;
	contabilizadas: number;
	totalActas: number;
	participacionCiudadana: number;
	fechaActualizacion: string;
}

export interface DoctorCheck {
	name: string;
	ok: boolean;
	detail: string;
}

export interface DoctorResult {
	ok: boolean;
	checks: DoctorCheck[];
	proceso: ProcesoElectoral | null;
}
