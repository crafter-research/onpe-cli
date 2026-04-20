#!/usr/bin/env bun
import pc from "picocolors";
import { OnpeClient, OnpeError } from "./client";
import { emit, note, reportError } from "./cli/agent/json-mode";
import { emitNextSteps } from "./cli/agent/next-steps";
import { renderDoctor, runDoctor } from "./cli/agent/doctor";
import { parseGlobalFlags } from "./cli/foundation/global-flags";
import { fromHttp, mapError } from "./cli/foundation/error-map";
import { parseArgv } from "./cli/foundation/argv";
import { printBanner } from "./cli/foundation/banner";
import { ONPE_ERRORS, ONPE_STATUS_MAP } from "./errors";
import { renderActa, renderMesa, renderResumen, renderUbigeos } from "./format";

const VERSION = "0.2.0";

const COMMANDS: [string, string][] = [
	["doctor", "Check API connectivity and status"],
	["mesa <codigo>", "Look up a mesa by code (e.g. 000001, 900001)"],
	["acta <id>", "Get full acta detail by numeric ID"],
	["resumen", "Get general election summary"],
	["ubigeos [nivel] [padre]", "List ubigeos (nivel: 1=dept, 2=prov, 3=dist)"],
	["file-url <fileId>", "Get download URL for an acta file"],
];

const FLAGS: [string, string][] = [
	["--json", "Emit JSON for agents (auto when piped)"],
	["--quiet", "Suppress non-essential output"],
	["--timeout <ms>", "Request timeout in ms (default: 15000)"],
	["--help", "Show this help"],
	["--version", "Show version"],
];

const EXAMPLES = [
	"onpe-cli doctor",
	"onpe-cli mesa 044739",
	"onpe-cli mesa 900001 --json",
	"onpe-cli acta 12345 | jq .detalle",
	"onpe-cli resumen",
	"onpe-cli ubigeos 1",
	"onpe-cli ubigeos 2 150000",
];

function renderHelp(): string {
	const lines: string[] = [];
	const pad = COMMANDS.reduce((max, [cmd]) => Math.max(max, cmd.length), 0);

	lines.push(pc.bold("Commands"));
	for (const [cmd, desc] of COMMANDS) {
		lines.push(`  ${pc.bold(cmd.padEnd(pad + 2))}${pc.dim(desc)}`);
	}
	lines.push("");

	lines.push(pc.bold("Flags"));
	const flagPad = FLAGS.reduce((max, [f]) => Math.max(max, f.length), 0);
	for (const [flag, desc] of FLAGS) {
		lines.push(`  ${flag.padEnd(flagPad + 2)}${pc.dim(desc)}`);
	}
	lines.push("");

	lines.push(pc.bold("Examples"));
	for (const ex of EXAMPLES) {
		lines.push(`  ${pc.dim(ex)}`);
	}
	lines.push("");

	lines.push(pc.dim(`Usage:  onpe-cli <command> [args...]   |   onpe-cli <command> --help`));
	lines.push("");

	return lines.join("\n");
}

function toOnpeError(err: unknown) {
	if (err instanceof OnpeError) {
		return fromHttp(err.status, err.body, ONPE_STATUS_MAP, ONPE_ERRORS);
	}
	if (err instanceof Error && err.name === "AbortError") {
		return mapError({ code: "TIMEOUT" }, ONPE_ERRORS);
	}
	if (err instanceof Error && (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed"))) {
		return mapError({ code: "NETWORK" }, ONPE_ERRORS);
	}
	return mapError(err, ONPE_ERRORS);
}

async function main() {
	const args = parseArgv();
	const flags = parseGlobalFlags(args);
	const positional = args._;

	const isHelp = args.help || args.h || positional.length === 0 || positional[0] === "help";
	const isJson = flags.json;

	if (args.version) {
		process.stdout.write(`${VERSION}\n`);
		process.exit(0);
	}

	if (isHelp) {
		if (!isJson && process.stdout.isTTY) {
			printBanner({
				name: "ONPE CLI",
				tagline: "Agent-first election data for Peru",
				version: VERSION,
				gradient: ["#6366F1", "#A78BFA"],
			});
		}
		process.stdout.write(renderHelp());
		process.exit(0);
	}

	const timeout = args.timeout ? Number.parseInt(args.timeout as string, 10) : undefined;
	const client = new OnpeClient({ timeout });
	const command = positional[0];

	try {
		switch (command) {
			case "doctor": {
				note("Checking ONPE API endpoints...", flags);
				const result = await runDoctor([
					async () => {
						const p = await client.procesoActivo();
						return { name: "proceso-activo", ok: true, detail: p.nombre };
					},
					async () => {
						const p = await client.procesoActivo();
						const e = await client.elecciones(p.id);
						return { name: "elecciones", ok: true, detail: `${e.length} elecciones` };
					},
					async () => {
						const { eleccion } = await client.resolveEleccion();
						const r = await client.resumenGeneral(eleccion.idEleccion);
						return { name: "resumen-general", ok: true, detail: `${r.contabilizadas} actas (${r.actasContabilizadas}%)` };
					},
					async () => {
						await client.buscarMesa("000001");
						return { name: "buscar-mesa", ok: true, detail: "mesa 000001 accesible" };
					},
				]);
				renderDoctor(result, flags);
				emitNextSteps(
					result.ok
						? [
								{ command: "onpe-cli resumen", description: "view election summary" },
								{ command: "onpe-cli mesa 000001", description: "look up a specific mesa" },
							]
						: [{ command: "onpe-cli doctor", description: "retry after fixing connectivity" }],
					flags,
				);
				process.exit(result.ok ? 0 : 1);
				break;
			}

			case "mesa": {
				const codigo = positional[1];
				if (!codigo) {
					reportError("Missing mesa code. Usage: onpe-cli mesa <codigo>", flags);
					process.exit(1);
				}
				const padded = codigo.padStart(6, "0");
				note(`Looking up mesa ${padded}...`, flags);
				const allMesas = await client.buscarMesa(padded);
				const contabilizadas = allMesas.filter((m) => m.codigoEstadoActa === "C");
				const mesas = contabilizadas.length > 0 ? [contabilizadas[0]!] : allMesas.length > 0 ? [allMesas[0]!] : [];
				emit(mesas, flags, () => renderMesa(mesas));
				if (mesas.length > 0) {
					emitNextSteps(
						[{ command: `onpe-cli acta ${mesas[0]!.id}`, description: "view full vote breakdown" }],
						flags,
					);
				}
				break;
			}

			case "acta": {
				const idStr = positional[1];
				if (!idStr) {
					reportError("Missing acta ID. Usage: onpe-cli acta <id>", flags);
					process.exit(1);
				}
				const id = Number.parseInt(idStr, 10);
				if (Number.isNaN(id)) {
					reportError(`Invalid acta ID: ${idStr}`, flags);
					process.exit(1);
				}
				note(`Fetching acta ${id}...`, flags);
				const acta = await client.actaDetalle(id);
				emit(acta, flags, () => renderActa(acta));
				if (acta.archivos && acta.archivos.length > 0) {
					emitNextSteps(
						acta.archivos.map((a) => ({
							command: `onpe-cli file-url ${a.id}`,
							description: `download ${a.tipo === 1 ? "escrutinio" : "instalacion"} PDF`,
							optional: true,
						})),
						flags,
					);
				}
				break;
			}

			case "resumen": {
				note("Fetching election summary...", flags);
				const { eleccion } = await client.resolveEleccion();
				const resumen = await client.resumenGeneral(eleccion.idEleccion);
				emit(resumen, flags, () => renderResumen(resumen));
				emitNextSteps(
					[
						{ command: "onpe-cli ubigeos 1", description: "list departments" },
						{ command: "onpe-cli mesa <codigo>", description: "look up a specific mesa" },
					],
					flags,
				);
				break;
			}

			case "ubigeos": {
				const nivel = positional[1] ? (Number.parseInt(positional[1], 10) as 1 | 2 | 3) : 1;
				const padre = positional[2];
				note(`Fetching ubigeos nivel ${nivel}${padre ? ` (padre: ${padre})` : ""}...`, flags);
				const { eleccion } = await client.resolveEleccion();
				const ubigeos = await client.ubigeos(eleccion.idEleccion, nivel, padre);
				emit(ubigeos, flags, () => renderUbigeos(ubigeos));
				if (nivel < 3 && ubigeos.length > 0) {
					emitNextSteps(
						[{
							command: `onpe-cli ubigeos ${nivel + 1} ${ubigeos[0]!.codigo}`,
							description: `drill down to nivel ${nivel + 1}`,
						}],
						flags,
					);
				}
				break;
			}

			case "file-url": {
				const fileId = positional[1];
				if (!fileId) {
					reportError("Missing file ID. Usage: onpe-cli file-url <fileId>", flags);
					process.exit(1);
				}
				note(`Resolving file URL for ${fileId}...`, flags);
				const url = await client.actaFileUrl(fileId);
				emit({ url }, flags, () => console.log(url));
				break;
			}

			default:
				reportError(`Unknown command: ${command}`, flags);
				process.stdout.write(renderHelp());
				process.exit(1);
		}
	} catch (err) {
		const appErr = toOnpeError(err);
		reportError(appErr, flags);
		if (appErr.hint) {
			emitNextSteps([{ command: appErr.hint, description: "suggested fix" }], flags);
		}
		process.exit(1);
	}
}

main();
